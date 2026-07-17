-- Phase 6.6: secure, review-first recipe URL import

alter table public.recipes drop constraint recipes_source_type_check;
alter table public.recipes
  add constraint recipes_source_type_check
  check (source_type in ('manual','url_reference','imported','other'));

alter table public.recipes
  add column source_canonical_url text check (source_canonical_url is null or char_length(source_canonical_url) <= 2000),
  add column source_hostname text check (source_hostname is null or char_length(source_hostname) <= 253),
  add column source_author text check (source_author is null or char_length(source_author) <= 300),
  add column source_published_at timestamptz,
  add column source_image_url text check (source_image_url is null or char_length(source_image_url) <= 2000),
  add column imported_at timestamptz,
  add column import_parser_version text check (import_parser_version is null or char_length(import_parser_version) <= 80),
  add column imported_content_hash text check (imported_content_hash is null or imported_content_hash ~ '^[a-f0-9]{64}$'),
  add column last_source_refresh_at timestamptz,
  add column yield_text text check (yield_text is null or char_length(yield_text) <= 300);

create index recipes_source_canonical_idx
  on public.recipes(household_id, source_canonical_url)
  where source_canonical_url is not null;
create index recipes_import_hash_idx
  on public.recipes(household_id, imported_content_hash)
  where imported_content_hash is not null;

alter table public.recipe_ingredients
  add column original_imported_text text
    check (original_imported_text is null or char_length(original_imported_text) <= 1000),
  add column parser_confidence numeric(4,3)
    check (parser_confidence is null or (parser_confidence >= 0 and parser_confidence <= 1)),
  add column user_confirmed boolean not null default false;

create table public.recipe_import_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  requested_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  source_url text not null check (char_length(source_url) between 8 and 2000),
  canonical_url text check (canonical_url is null or char_length(canonical_url) <= 2000),
  source_hostname text not null check (char_length(source_hostname) between 1 and 253),
  source_title text check (source_title is null or char_length(source_title) <= 300),
  source_author text check (source_author is null or char_length(source_author) <= 300),
  source_image_url text check (source_image_url is null or char_length(source_image_url) <= 2000),
  extraction_strategy text check (extraction_strategy is null or extraction_strategy in ('json_ld','microdata','html_fallback','manual')),
  parser_version text not null check (char_length(parser_version) between 1 and 80),
  status text not null default 'fetching' check (status in (
    'fetching','extracted','needs_review','failed','saved','cancelled','expired'
  )),
  extracted_payload jsonb,
  validation_warnings jsonb not null default '[]'::jsonb,
  confidence_summary jsonb not null default '{}'::jsonb,
  candidate_payloads jsonb not null default '[]'::jsonb,
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  failure_category text check (failure_category is null or failure_category in (
    'invalid_url','blocked_destination','robots_disallowed','fetch_timeout',
    'response_too_large','unsupported_content_type','http_error','rate_limited',
    'no_recipe_found','multiple_recipes_found','invalid_structured_data',
    'parser_failure','login_required','paywall_or_access_denied'
  )),
  saved_recipe_id uuid references public.recipes(id) on delete set null,
  refresh_recipe_id uuid references public.recipes(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create index recipe_import_drafts_creator_idx
  on public.recipe_import_drafts(requested_by_membership_id, created_at desc);
create index recipe_import_drafts_household_idx
  on public.recipe_import_drafts(household_id, created_at desc);
create index recipe_import_drafts_host_idx
  on public.recipe_import_drafts(source_hostname, created_at desc);
create index recipe_import_drafts_expiry_idx
  on public.recipe_import_drafts(expires_at)
  where status in ('fetching','extracted','needs_review');

alter table public.recipe_import_drafts enable row level security;
create policy recipe_import_drafts_creator_select on public.recipe_import_drafts
  for select to authenticated using (
    requested_by_membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );

create trigger recipe_import_drafts_set_updated_at
  before update on public.recipe_import_drafts
  for each row execute function public.set_updated_at();
create trigger recipe_import_drafts_rpc_only
  before insert or update or delete on public.recipe_import_drafts
  for each row execute function public.enforce_meal_rpc_only();

drop function if exists public.create_recipe(
  uuid,text,text,text,numeric,int,int,text,text,text,text[],jsonb,jsonb,jsonb,uuid[]
);

create function public.create_recipe(
  p_household_id uuid,
  p_name text,
  p_description text default null,
  p_category text default 'other',
  p_base_servings numeric default 4,
  p_prep_minutes int default null,
  p_cook_minutes int default null,
  p_difficulty text default 'unknown',
  p_visibility text default 'household',
  p_source_url text default null,
  p_tags text[] default '{}',
  p_ingredients jsonb default '[]'::jsonb,
  p_steps jsonb default '[]'::jsonb,
  p_equipment jsonb default '[]'::jsonb,
  p_visibility_membership_ids uuid[] default '{}',
  p_cuisine_label text default null,
  p_yield_text text default null,
  p_source_type text default null,
  p_source_canonical_url text default null,
  p_source_hostname text default null,
  p_source_author text default null,
  p_source_published_at timestamptz default null,
  p_source_image_url text default null,
  p_import_parser_version text default null,
  p_imported_content_hash text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_ing jsonb; v_step jsonb; v_eq jsonb; v_mid uuid; v_ord int;
  v_source_type text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  if p_base_servings is null or p_base_servings <= 0 then raise exception 'Base servings must be positive'; end if;
  if p_visibility = 'selected_members' and cardinality(coalesce(p_visibility_membership_ids,'{}'::uuid[])) < 1 then
    raise exception 'selected_members visibility requires at least one member';
  end if;
  v_source_type := coalesce(
    p_source_type,
    case when nullif(trim(coalesce(p_source_url,'')),'') is not null then 'url_reference' else 'manual' end
  );
  if v_source_type not in ('manual','url_reference','imported','other') then
    raise exception 'Invalid recipe source type';
  end if;

  insert into public.recipes(
    household_id, created_by_membership_id, name, normalized_name, description, category,
    cuisine_label, base_servings, prep_minutes, cook_minutes, total_minutes, difficulty, visibility,
    source_type, source_url, source_canonical_url, source_hostname, source_author,
    source_published_at, source_image_url, imported_at, import_parser_version,
    imported_content_hash, yield_text, tags
  ) values (
    p_household_id, v_actor, trim(p_name), public._meal_normalize_name(p_name),
    nullif(trim(coalesce(p_description,'')),''), p_category,
    nullif(trim(coalesce(p_cuisine_label,'')),''), p_base_servings,
    p_prep_minutes, p_cook_minutes,
    case when p_prep_minutes is null and p_cook_minutes is null then null
         else coalesce(p_prep_minutes,0) + coalesce(p_cook_minutes,0) end,
    p_difficulty, p_visibility, v_source_type,
    nullif(trim(coalesce(p_source_url,'')),''),
    nullif(trim(coalesce(p_source_canonical_url,'')),''),
    nullif(lower(trim(coalesce(p_source_hostname,''))),''),
    nullif(trim(coalesce(p_source_author,'')),''),
    p_source_published_at,
    nullif(trim(coalesce(p_source_image_url,'')),''),
    case when v_source_type = 'imported' then now() else null end,
    nullif(trim(coalesce(p_import_parser_version,'')),''),
    nullif(trim(coalesce(p_imported_content_hash,'')),''),
    nullif(trim(coalesce(p_yield_text,'')),''),
    coalesce(p_tags,'{}'::text[])
  ) returning id into v_id;

  if p_visibility = 'selected_members' then
    foreach v_mid in array p_visibility_membership_ids loop
      if not exists (
        select 1 from public.household_memberships
        where id = v_mid and household_id = p_household_id and status = 'active'
      ) then raise exception 'Visibility member is not active in this household'; end if;
      insert into public.recipe_visibility_members(recipe_id, household_id, membership_id)
      values (v_id, p_household_id, v_mid) on conflict do nothing;
    end loop;
  end if;

  v_ord := 0;
  for v_ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) loop
    insert into public.recipe_ingredients(
      recipe_id, household_id, display_name, normalized_name, quantity, quantity_unit,
      quantity_mode, preparation_note, ingredient_group, required, sort_order,
      original_imported_text, parser_confidence, user_confirmed
    ) values (
      v_id, p_household_id, trim(v_ing->>'display_name'),
      public._meal_normalize_name(coalesce(v_ing->>'normalized_name', v_ing->>'display_name')),
      nullif(v_ing->>'quantity','')::numeric, coalesce(v_ing->>'quantity_unit','item'),
      coalesce(v_ing->>'quantity_mode','exact'), nullif(v_ing->>'preparation_note',''),
      nullif(v_ing->>'ingredient_group',''), coalesce((v_ing->>'required')::boolean, true), v_ord,
      nullif(v_ing->>'original_imported_text',''),
      nullif(v_ing->>'parser_confidence','')::numeric,
      coalesce((v_ing->>'user_confirmed')::boolean, false)
    );
    v_ord := v_ord + 1;
  end loop;

  v_ord := 1;
  for v_step in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) loop
    insert into public.recipe_steps(
      recipe_id, household_id, step_number, instruction, duration_minutes, phase, equipment_note
    ) values (
      v_id, p_household_id, coalesce((v_step->>'step_number')::int, v_ord),
      trim(v_step->>'instruction'), nullif(v_step->>'duration_minutes','')::int,
      coalesce(v_step->>'phase','cooking'), nullif(v_step->>'equipment_note','')
    );
    v_ord := v_ord + 1;
  end loop;

  v_ord := 0;
  for v_eq in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) loop
    insert into public.recipe_equipment(recipe_id, household_id, display_name, inventory_item_id, required, sort_order)
    values (
      v_id, p_household_id, trim(v_eq->>'display_name'),
      nullif(v_eq->>'inventory_item_id','')::uuid,
      coalesce((v_eq->>'required')::boolean, true), v_ord
    );
    v_ord := v_ord + 1;
  end loop;

  perform public._meal_audit(p_household_id, 'recipe', v_id, 'recipe.created');
  if p_visibility = 'household' then
    perform public._meal_notify(
      p_household_id, 'recipe.created', 'recipe', v_id, v_actor,
      (select array_agg(m.id) from public.household_memberships m
       where m.household_id = p_household_id and m.status = 'active' and m.id <> v_actor),
      'Recipe added', 'A household recipe was added.',
      '/app/' || p_household_id::text || '/recipes/' || v_id::text
    );
  end if;
  return v_id;
end $$;

create function public.create_recipe_import_draft(
  p_household_id uuid, p_source_url text, p_source_hostname text,
  p_parser_version text, p_refresh_recipe_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_id uuid; v_now timestamptz := now();
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  if (select count(*) from public.recipe_import_drafts
      where requested_by_membership_id = v_actor and created_at > v_now - interval '1 hour') >= 8 then
    raise exception 'Recipe import limit reached for this user';
  end if;
  if (select count(*) from public.recipe_import_drafts
      where household_id = p_household_id and created_at > v_now - interval '1 hour') >= 20 then
    raise exception 'Recipe import limit reached for this household';
  end if;
  if (select count(*) from public.recipe_import_drafts
      where source_hostname = lower(p_source_hostname) and created_at > v_now - interval '1 hour') >= 5 then
    raise exception 'Recipe import limit reached for this source';
  end if;
  if (select count(*) from public.recipe_import_drafts
      where requested_by_membership_id = v_actor and status = 'fetching'
        and created_at > v_now - interval '2 minutes') >= 2 then
    raise exception 'Two recipe imports are already in progress';
  end if;
  if p_refresh_recipe_id is not null and not public.can_view_recipe(p_refresh_recipe_id) then
    raise exception 'Recipe not visible';
  end if;
  insert into public.recipe_import_drafts(
    household_id, requested_by_membership_id, source_url, source_hostname,
    parser_version, refresh_recipe_id
  ) values (
    p_household_id, v_actor, p_source_url, lower(p_source_hostname),
    p_parser_version, p_refresh_recipe_id
  ) returning id into v_id;
  perform public._meal_audit(
    p_household_id, 'recipe_import_draft', v_id, 'recipe.import_requested',
    null, jsonb_build_object('source_hostname', lower(p_source_hostname))
  );
  if p_refresh_recipe_id is not null then
    perform public._meal_audit(
      p_household_id, 'recipe', p_refresh_recipe_id, 'recipe.source_refreshed',
      null, jsonb_build_object('source_hostname', lower(p_source_hostname))
    );
  end if;
  return v_id;
end $$;

create function public.complete_recipe_import_draft(
  p_draft_id uuid, p_status text, p_payload jsonb default null,
  p_candidates jsonb default '[]'::jsonb, p_warnings jsonb default '[]'::jsonb,
  p_confidence jsonb default '{}'::jsonb, p_strategy text default null,
  p_canonical_url text default null, p_source_title text default null,
  p_source_author text default null, p_source_image_url text default null,
  p_content_hash text default null, p_failure_category text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_draft public.recipe_import_drafts%rowtype; v_actor uuid; v_event text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_draft from public.recipe_import_drafts where id = p_draft_id for update;
  if not found then raise exception 'Import draft not found'; end if;
  v_actor := public._meal_active_membership(v_draft.household_id);
  if v_actor <> v_draft.requested_by_membership_id then raise exception 'Import draft is private'; end if;
  if p_status not in ('extracted','needs_review','failed') then raise exception 'Invalid import completion status'; end if;
  update public.recipe_import_drafts set
    status = p_status, extracted_payload = p_payload,
    candidate_payloads = coalesce(p_candidates, '[]'::jsonb),
    validation_warnings = coalesce(p_warnings, '[]'::jsonb),
    confidence_summary = coalesce(p_confidence, '{}'::jsonb),
    extraction_strategy = p_strategy, canonical_url = p_canonical_url,
    source_title = p_source_title, source_author = p_source_author,
    source_image_url = p_source_image_url, content_hash = p_content_hash,
    failure_category = p_failure_category,
    completed_at = case when p_status = 'failed' then now() else null end
  where id = p_draft_id;
  v_event := case when p_status = 'failed' then 'recipe.import_failed' else 'recipe.import_extracted' end;
  perform public._meal_audit(
    v_draft.household_id, 'recipe_import_draft', p_draft_id, v_event, null,
    jsonb_strip_nulls(jsonb_build_object(
      'source_hostname', v_draft.source_hostname,
      'extraction_strategy', p_strategy,
      'result_category', p_failure_category
    ))
  );
  return p_draft_id;
end $$;

create function public.cancel_recipe_import_draft(p_draft_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_draft public.recipe_import_drafts%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_draft from public.recipe_import_drafts where id = p_draft_id for update;
  if not found then raise exception 'Import draft not found'; end if;
  v_actor := public._meal_active_membership(v_draft.household_id);
  if v_actor <> v_draft.requested_by_membership_id then raise exception 'Import draft is private'; end if;
  if v_draft.status = 'saved' then raise exception 'Saved imports cannot be cancelled'; end if;
  update public.recipe_import_drafts set status = 'cancelled', completed_at = now() where id = p_draft_id;
  perform public._meal_audit(
    v_draft.household_id, 'recipe_import_draft', p_draft_id, 'recipe.import_cancelled',
    null, jsonb_build_object('source_hostname', v_draft.source_hostname)
  );
  return p_draft_id;
end $$;

create function public.save_imported_recipe(
  p_draft_id uuid, p_recipe jsonb, p_visibility text default 'household',
  p_import_as_copy boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_draft public.recipe_import_drafts%rowtype; v_actor uuid; v_recipe_id uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_draft from public.recipe_import_drafts where id = p_draft_id for update;
  if not found then raise exception 'Import draft not found'; end if;
  v_actor := public._meal_active_membership(v_draft.household_id);
  if v_actor <> v_draft.requested_by_membership_id then raise exception 'Import draft is private'; end if;
  if v_draft.status not in ('extracted','needs_review') or v_draft.expires_at <= now() then
    raise exception 'Import draft is not available for saving';
  end if;
  if not p_import_as_copy and exists (
    select 1 from public.recipes r
    where r.household_id = v_draft.household_id and r.archived_at is null
      and (
        (v_draft.canonical_url is not null and r.source_canonical_url = v_draft.canonical_url)
        or (v_draft.content_hash is not null and r.imported_content_hash = v_draft.content_hash)
      )
  ) then raise exception 'An imported recipe from this source already exists'; end if;

  v_recipe_id := public.create_recipe(
    p_household_id => v_draft.household_id,
    p_name => p_recipe->>'name',
    p_description => p_recipe->>'description',
    p_category => coalesce(p_recipe->>'category','other'),
    p_base_servings => coalesce(nullif(p_recipe->>'baseServings','')::numeric, 4),
    p_prep_minutes => nullif(p_recipe->>'prepMinutes','')::int,
    p_cook_minutes => nullif(p_recipe->>'cookMinutes','')::int,
    p_visibility => p_visibility,
    p_source_url => v_draft.source_url,
    p_tags => coalesce(array(select jsonb_array_elements_text(p_recipe->'tags')), '{}'),
    p_ingredients => coalesce(p_recipe->'ingredients','[]'::jsonb),
    p_steps => coalesce(p_recipe->'steps','[]'::jsonb),
    p_equipment => coalesce(p_recipe->'equipment','[]'::jsonb),
    p_cuisine_label => p_recipe->>'cuisine',
    p_yield_text => p_recipe->>'yieldText',
    p_source_type => 'imported',
    p_source_canonical_url => v_draft.canonical_url,
    p_source_hostname => v_draft.source_hostname,
    p_source_author => coalesce(p_recipe->>'author', v_draft.source_author),
    p_source_published_at => nullif(p_recipe->>'datePublished','')::timestamptz,
    p_source_image_url => p_recipe->>'imageUrl',
    p_import_parser_version => v_draft.parser_version,
    p_imported_content_hash => v_draft.content_hash
  );
  update public.recipe_import_drafts
  set status = 'saved', saved_recipe_id = v_recipe_id, completed_at = now()
  where id = p_draft_id;
  perform public._meal_audit(
    v_draft.household_id, 'recipe_import_draft', p_draft_id, 'recipe.import_saved',
    null, jsonb_build_object(
      'source_hostname', v_draft.source_hostname,
      'extraction_strategy', v_draft.extraction_strategy,
      'saved_recipe_id', v_recipe_id
    )
  );
  return v_recipe_id;
end $$;

create function public.expire_recipe_import_drafts()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  update public.recipe_import_drafts
  set status = 'expired', completed_at = now()
  where expires_at <= now() and status in ('fetching','extracted','needs_review');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on table public.recipe_import_drafts from public, anon;
grant select on table public.recipe_import_drafts to authenticated;

revoke all on function public.create_recipe(
  uuid,text,text,text,numeric,int,int,text,text,text,text[],jsonb,jsonb,jsonb,uuid[],
  text,text,text,text,text,text,timestamptz,text,text,text
) from public, anon;
grant execute on function public.create_recipe(
  uuid,text,text,text,numeric,int,int,text,text,text,text[],jsonb,jsonb,jsonb,uuid[],
  text,text,text,text,text,text,timestamptz,text,text,text
) to authenticated;
grant execute on function public.create_recipe_import_draft(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.complete_recipe_import_draft(uuid,text,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.cancel_recipe_import_draft(uuid) to authenticated;
grant execute on function public.save_imported_recipe(uuid,jsonb,text,boolean) to authenticated;
revoke all on function public.expire_recipe_import_drafts() from public, anon, authenticated;
grant execute on function public.expire_recipe_import_drafts() to service_role;
