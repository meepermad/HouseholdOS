-- Phase 8: core governance document / version / comment RPCs

create or replace function public._governance_audit(
  p_household_id uuid, p_entity_type text, p_entity_id uuid, p_event_type text,
  p_before jsonb default null, p_after jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, correlation_id
  ) values (
    p_household_id, auth.uid(), p_entity_type, p_entity_id, p_event_type,
    p_before, p_after, gen_random_uuid()
  );
end $$;
revoke all on function public._governance_audit(uuid,text,uuid,text,jsonb,jsonb) from public, anon;

create or replace function public._governance_append_event(
  p_document_id uuid, p_household_id uuid, p_actor uuid,
  p_event_type text, p_version_id uuid default null,
  p_body text default null, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.governance_events(
    document_id, version_id, household_id, event_type, actor_membership_id, body, payload
  ) values (
    p_document_id, p_version_id, p_household_id, p_event_type, p_actor,
    nullif(trim(coalesce(p_body,'')),''), coalesce(p_payload, '{}'::jsonb)
  );
end $$;
revoke all on function public._governance_append_event(uuid,uuid,uuid,text,uuid,text,jsonb) from public, anon;

create or replace function public._governance_notify(
  p_household_id uuid, p_event_type text, p_entity_id uuid,
  p_actor_membership_id uuid, p_memberships uuid[], p_title text, p_body text,
  p_deep_link text
) returns void language plpgsql security definer set search_path = public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id = any(coalesce(p_memberships, '{}'::uuid[]))
    and m.status = 'active' and m.user_id <> auth.uid();
  if cardinality(coalesce(v_users, '{}'::uuid[])) > 0 then
    perform public._emit_notification_event(
      p_household_id, p_event_type, 'governance_document', p_entity_id,
      p_actor_membership_id, '{}'::jsonb,
      p_event_type || ':' || p_entity_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
      v_users, p_title, p_body, p_deep_link
    );
  end if;
end $$;
revoke all on function public._governance_notify(uuid,text,uuid,uuid,uuid[],text,text,text) from public, anon;

create or replace function public._governance_assert_lifecycle(
  p_from text, p_to text
) returns void language plpgsql immutable as $$
begin
  if p_from = p_to then return; end if;
  if not (
    (p_from = 'draft' and p_to in ('proposed','archived','withdrawn'))
    or (p_from = 'proposed' and p_to in ('under_review','withdrawn','rejected'))
    or (p_from = 'under_review' and p_to in ('approved','rejected','withdrawn','proposed'))
    or (p_from = 'approved' and p_to in ('active','archived','superseded'))
    or (p_from = 'active' and p_to in ('superseded','archived'))
    or (p_from = 'rejected' and p_to in ('draft','archived'))
    or (p_from = 'withdrawn' and p_to in ('draft','archived'))
    or (p_from = 'superseded' and p_to = 'archived')
  ) then
    raise exception 'Invalid governance lifecycle transition: % -> %', p_from, p_to;
  end if;
end $$;
revoke all on function public._governance_assert_lifecycle(text,text) from public, anon;

create or replace function public._governance_hash_content(
  p_title text, p_summary text, p_plain_text text, p_sections jsonb
) returns text language sql immutable as $$
  select md5(
    coalesce(p_title,'') || E'\n' || coalesce(p_summary,'') || E'\n' ||
    coalesce(p_plain_text,'') || E'\n' || coalesce(p_sections::text,'[]')
  );
$$;
revoke all on function public._governance_hash_content(text,text,text,jsonb) from public, anon;

create or replace function public._governance_sections_to_plain(p_sections jsonb)
returns text language plpgsql immutable as $$
declare
  v_item jsonb;
  v_out text := '';
  v_i int := 0;
begin
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    return '';
  end if;
  for v_item in select * from jsonb_array_elements(p_sections)
  loop
    v_i := v_i + 1;
    if v_i > 1 then v_out := v_out || E'\n\n'; end if;
    if coalesce(v_item->>'heading','') <> '' then
      v_out := v_out || (v_item->>'heading') || E'\n';
    end if;
    if coalesce(v_item->>'body','') <> '' then
      v_out := v_out || (v_item->>'body');
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function public._governance_sections_to_plain(jsonb) from public, anon;

create or replace function public._governance_insert_sections(
  p_version_id uuid, p_document_id uuid, p_household_id uuid, p_sections jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_pos int := 0;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb))
  loop
    insert into public.governance_sections(
      version_id, document_id, household_id, position, section_type, heading, body, payload
    ) values (
      p_version_id, p_document_id, p_household_id, v_pos,
      coalesce(nullif(v_item->>'section_type',''), 'freeform'),
      nullif(trim(coalesce(v_item->>'heading','')),''),
      nullif(trim(coalesce(v_item->>'body','')),''),
      coalesce(v_item->'payload', '{}'::jsonb)
    );
    v_pos := v_pos + 1;
  end loop;
end $$;
revoke all on function public._governance_insert_sections(uuid,uuid,uuid,jsonb) from public, anon;

-- Create draft document + version 1
create or replace function public.create_governance_document(
  p_household_id uuid,
  p_document_class text,
  p_title text,
  p_summary text default null,
  p_visibility text default 'private_draft',
  p_is_financial boolean default false,
  p_sections jsonb default '[]'::jsonb,
  p_approval_rules jsonb default '{"mode":"unanimous","quorum":1}'::jsonb,
  p_acknowledgment_rules jsonb default '{"required":false}'::jsonb,
  p_template_id uuid default null,
  p_participant_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_doc uuid; v_ver uuid; v_plain text; v_hash text; v_mid uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  v_actor := public._governance_active_membership(p_household_id);
  v_plain := public._governance_sections_to_plain(p_sections);
  v_hash := public._governance_hash_content(trim(p_title), p_summary, v_plain, p_sections);

  insert into public.governance_documents(
    household_id, document_class, status, visibility, title, summary,
    is_financial, template_id, created_by_membership_id
  ) values (
    p_household_id, p_document_class, 'draft',
    coalesce(nullif(p_visibility,''), 'private_draft'),
    trim(p_title), nullif(trim(coalesce(p_summary,'')),''),
    coalesce(p_is_financial, false), p_template_id, v_actor
  ) returning id into v_doc;

  insert into public.governance_document_versions(
    document_id, household_id, version_number, title, summary, plain_text,
    content_hash, author_membership_id, change_summary, approval_rules,
    acknowledgment_rules, status
  ) values (
    v_doc, p_household_id, 1, trim(p_title),
    nullif(trim(coalesce(p_summary,'')),''), v_plain, v_hash, v_actor,
    'Initial draft', coalesce(p_approval_rules, '{"mode":"unanimous","quorum":1}'::jsonb),
    coalesce(p_acknowledgment_rules, '{"required":false}'::jsonb), 'draft'
  ) returning id into v_ver;

  update public.governance_documents
  set current_version_id = v_ver
  where id = v_doc;

  perform public._governance_insert_sections(v_ver, v_doc, p_household_id, p_sections);

  insert into public.governance_participants(document_id, household_id, membership_id, role)
  values (v_doc, p_household_id, v_actor, 'author')
  on conflict do nothing;

  foreach v_mid in array coalesce(p_participant_membership_ids, '{}'::uuid[])
  loop
    if not exists (
      select 1 from public.household_memberships m
      where m.id = v_mid and m.household_id = p_household_id and m.status = 'active'
    ) then raise exception 'Participant must be an active household member'; end if;
    insert into public.governance_participants(document_id, household_id, membership_id, role)
    values (v_doc, p_household_id, v_mid, 'participant')
    on conflict do nothing;
  end loop;

  perform public._governance_append_event(v_doc, p_household_id, v_actor, 'draft_created', v_ver);
  perform public._governance_audit(p_household_id, 'governance_document', v_doc, 'governance.draft_created',
    null, jsonb_build_object('class', p_document_class, 'version_id', v_ver));
  return v_doc;
end $$;

create or replace function public.save_governance_draft(
  p_document_id uuid,
  p_title text default null,
  p_summary text default null,
  p_visibility text default null,
  p_sections jsonb default null,
  p_approval_rules jsonb default null,
  p_acknowledgment_rules jsonb default null,
  p_change_summary text default null,
  p_create_new_version boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_ver public.governance_document_versions%rowtype;
  v_actor uuid; v_new uuid; v_plain text; v_hash text; v_sections jsonb;
  v_title text; v_summary text;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);

  if v_doc.status not in ('draft','rejected','withdrawn') then
    raise exception 'Only draft documents can be autosaved; create a revision for reviewed documents';
  end if;
  if v_doc.created_by_membership_id <> v_actor
     and not public.is_household_coordinator(v_doc.household_id) then
    raise exception 'Only the author or a household coordinator may edit this draft';
  end if;

  select * into v_ver from public.governance_document_versions
  where id = v_doc.current_version_id for update;
  if not found then raise exception 'Current version not found'; end if;
  if v_ver.frozen_at is not null or v_ver.status not in ('draft','rejected','withdrawn') then
    raise exception 'This version is frozen; create a new version';
  end if;

  if p_sections is not null then
    v_sections := p_sections;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'section_type', section_type,
        'heading', heading,
        'body', body,
        'payload', payload
      ) order by position
    ), '[]'::jsonb)
    into v_sections
    from public.governance_sections where version_id = v_ver.id;
  end if;

  v_title := coalesce(nullif(trim(coalesce(p_title,'')),''), v_ver.title);
  v_summary := case
    when p_summary is null then v_ver.summary
    else nullif(trim(p_summary),'')
  end;
  v_plain := public._governance_sections_to_plain(v_sections);
  v_hash := public._governance_hash_content(v_title, v_summary, v_plain, v_sections);

  if coalesce(p_create_new_version, false) then
    insert into public.governance_document_versions(
      document_id, household_id, version_number, title, summary, plain_text,
      content_hash, author_membership_id, change_summary, approval_rules,
      acknowledgment_rules, status, prior_version_id
    ) values (
      v_doc.id, v_doc.household_id, v_ver.version_number + 1, v_title, v_summary,
      v_plain, v_hash, v_actor,
      coalesce(nullif(trim(coalesce(p_change_summary,'')),''), 'Revised draft'),
      coalesce(p_approval_rules, v_ver.approval_rules),
      coalesce(p_acknowledgment_rules, v_ver.acknowledgment_rules),
      'draft', v_ver.id
    ) returning id into v_new;
    perform public._governance_insert_sections(v_new, v_doc.id, v_doc.household_id, v_sections);
    update public.governance_documents set
      current_version_id = v_new,
      title = v_title,
      summary = v_summary,
      visibility = coalesce(nullif(p_visibility,''), visibility),
      status = 'draft'
    where id = v_doc.id;
    perform public._governance_append_event(
      v_doc.id, v_doc.household_id, v_actor, 'version_revised', v_new, p_change_summary
    );
    return v_new;
  end if;

  -- In-place draft update
  delete from public.governance_sections where version_id = v_ver.id;
  perform public._governance_insert_sections(v_ver.id, v_doc.id, v_doc.household_id, v_sections);

  update public.governance_document_versions set
    title = v_title,
    summary = v_summary,
    plain_text = v_plain,
    content_hash = v_hash,
    approval_rules = coalesce(p_approval_rules, approval_rules),
    acknowledgment_rules = coalesce(p_acknowledgment_rules, acknowledgment_rules),
    change_summary = coalesce(nullif(trim(coalesce(p_change_summary,'')),''), change_summary),
    status = 'draft'
  where id = v_ver.id;

  update public.governance_documents set
    title = v_title,
    summary = v_summary,
    visibility = coalesce(nullif(p_visibility,''), visibility),
    status = 'draft'
  where id = v_doc.id;

  perform public._governance_append_event(
    v_doc.id, v_doc.household_id, v_actor, 'version_revised', v_ver.id, 'Draft saved'
  );
  return v_ver.id;
end $$;

create or replace function public.add_governance_comment(
  p_document_id uuid,
  p_body text,
  p_version_id uuid default null,
  p_requests_changes boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_actor uuid; v_id uuid; v_ver uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  if not public.can_view_governance_document(p_document_id) then
    raise exception 'Not allowed to comment on this document';
  end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  v_ver := coalesce(p_version_id, v_doc.current_version_id);

  insert into public.governance_comments(
    document_id, version_id, household_id, author_membership_id, body, requests_changes
  ) values (
    p_document_id, v_ver, v_doc.household_id, v_actor, trim(p_body),
    coalesce(p_requests_changes, false)
  ) returning id into v_id;

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor,
    case when coalesce(p_requests_changes,false) then 'changes_requested' else 'comment_added' end,
    v_ver, left(trim(p_body), 200)
  );
  perform public._governance_audit(
    v_doc.household_id, 'governance_document', p_document_id, 'governance.comment_added',
    null, jsonb_build_object('comment_id', v_id)
  );
  return v_id;
end $$;

create or replace function public.archive_governance_document(
  p_document_id uuid,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  if not public.is_household_coordinator(v_doc.household_id)
     and v_doc.created_by_membership_id <> v_actor then
    raise exception 'Only a household coordinator or the author may archive this document';
  end if;
  perform public._governance_assert_lifecycle(v_doc.status, 'archived');

  update public.governance_documents set
    status = 'archived', archived_at = now()
  where id = p_document_id;

  if v_doc.current_version_id is not null then
    update public.governance_document_versions set status = 'archived'
    where id = v_doc.current_version_id and status not in ('active','superseded');
  end if;

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor, 'archived', v_doc.current_version_id, p_reason
  );
  perform public._governance_audit(
    v_doc.household_id, 'governance_document', p_document_id, 'governance.archived',
    jsonb_build_object('status', v_doc.status), jsonb_build_object('status', 'archived')
  );
  return p_document_id;
end $$;

create or replace function public.instantiate_governance_template(
  p_household_id uuid,
  p_template_id uuid,
  p_title text default null,
  p_visibility text default 'private_draft'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tpl public.governance_templates%rowtype;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  perform public._governance_active_membership(p_household_id);
  select * into v_tpl from public.governance_templates
  where id = p_template_id and active
    and (is_system or household_id = p_household_id);
  if not found then raise exception 'Template not found'; end if;

  return public.create_governance_document(
    p_household_id,
    v_tpl.document_class,
    coalesce(nullif(trim(coalesce(p_title,'')),''), v_tpl.title),
    v_tpl.summary,
    coalesce(nullif(p_visibility,''), 'private_draft'),
    v_tpl.document_class = 'financial_policy',
    v_tpl.sections,
    v_tpl.approval_rules,
    v_tpl.acknowledgment_rules,
    v_tpl.id,
    '{}'::uuid[]
  );
end $$;

-- Grants
grant execute on function public.create_governance_document(uuid,text,text,text,text,boolean,jsonb,jsonb,jsonb,uuid,uuid[]) to authenticated;
grant execute on function public.save_governance_draft(uuid,text,text,text,jsonb,jsonb,jsonb,text,boolean) to authenticated;
grant execute on function public.add_governance_comment(uuid,text,uuid,boolean) to authenticated;
grant execute on function public.archive_governance_document(uuid,text) to authenticated;
grant execute on function public.instantiate_governance_template(uuid,uuid,text,text) to authenticated;
