-- Phase 8: governance RLS + visibility helpers

create or replace function public._governance_active_membership(p_household_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  select m.id into v_id from public.household_memberships m
  where m.household_id = p_household_id and m.user_id = auth.uid() and m.status = 'active';
  if v_id is null then raise exception 'Not an active household member'; end if;
  return v_id;
end $$;
revoke all on function public._governance_active_membership(uuid) from public, anon;

create or replace function public._is_financial_coordinator(p_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.role = 'financial_coordinator'
  );
$$;
revoke all on function public._is_financial_coordinator(uuid) from public, anon;
grant execute on function public._is_financial_coordinator(uuid) to authenticated;

create or replace function public.can_view_governance_document(p_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.governance_documents d
    where d.id = p_document_id
      and public.is_active_member(d.household_id)
      and (
        -- Active household-wide policies visible to all members
        (d.status = 'active' and d.visibility = 'household')
        or d.created_by_membership_id = public.current_membership_id(d.household_id)
        or exists (
          select 1 from public.governance_participants p
          where p.document_id = d.id
            and p.membership_id = public.current_membership_id(d.household_id)
        )
        or (
          d.visibility = 'household'
          and d.status not in ('draft')
        )
        or (
          d.visibility = 'participants'
          and (
            d.created_by_membership_id = public.current_membership_id(d.household_id)
            or exists (
              select 1 from public.governance_participants p
              where p.document_id = d.id
                and p.membership_id = public.current_membership_id(d.household_id)
            )
            or public.is_household_coordinator(d.household_id)
          )
        )
        or (
          d.visibility = 'coordinators'
          and public.is_household_coordinator(d.household_id)
        )
        or (
          d.visibility = 'private_draft'
          and d.created_by_membership_id = public.current_membership_id(d.household_id)
        )
        or (
          public.is_household_coordinator(d.household_id)
          and d.status not in ('draft')
          and d.visibility <> 'private_draft'
        )
      )
  );
$$;
revoke all on function public.can_view_governance_document(uuid) from public, anon;
grant execute on function public.can_view_governance_document(uuid) to authenticated;

create or replace function public.can_manage_governance_document(p_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.governance_documents d
    where d.id = p_document_id
      and public.is_active_member(d.household_id)
      and (
        public.is_household_coordinator(d.household_id)
        or d.created_by_membership_id = public.current_membership_id(d.household_id)
      )
  );
$$;
revoke all on function public.can_manage_governance_document(uuid) from public, anon;
grant execute on function public.can_manage_governance_document(uuid) to authenticated;

create or replace function public.can_view_transition_workflow(p_workflow_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_transition_workflows w
    where w.id = p_workflow_id
      and public.is_active_member(w.household_id)
      and (
        w.subject_membership_id = public.current_membership_id(w.household_id)
        or w.created_by_membership_id = public.current_membership_id(w.household_id)
        or w.coordinator_membership_id = public.current_membership_id(w.household_id)
        or w.visibility = 'household'
        or (
          w.visibility = 'coordinators'
          and public.is_household_coordinator(w.household_id)
        )
        or (
          w.visibility = 'participants'
          and (
            public.is_household_coordinator(w.household_id)
            or exists (
              select 1 from public.household_transition_tasks t
              where t.workflow_id = w.id
                and t.assignee_membership_id = public.current_membership_id(w.household_id)
            )
          )
        )
      )
  );
$$;
revoke all on function public.can_view_transition_workflow(uuid) from public, anon;
grant execute on function public.can_view_transition_workflow(uuid) to authenticated;

create or replace function public.can_manage_transition_workflow(p_workflow_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_transition_workflows w
    where w.id = p_workflow_id
      and public.is_active_member(w.household_id)
      and (
        public.is_household_coordinator(w.household_id)
        or w.created_by_membership_id = public.current_membership_id(w.household_id)
        or w.coordinator_membership_id = public.current_membership_id(w.household_id)
      )
  );
$$;
revoke all on function public.can_manage_transition_workflow(uuid) from public, anon;
grant execute on function public.can_manage_transition_workflow(uuid) to authenticated;

create or replace function public.can_view_transition_private_field(p_field_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_transition_private_fields f
    where f.id = p_field_id
      and public.is_active_member(f.household_id)
      and (
        f.owner_membership_id = public.current_membership_id(f.household_id)
        or exists (
          select 1 from public.household_transition_private_grants g
          where g.private_field_id = f.id
            and g.grantee_membership_id = public.current_membership_id(f.household_id)
        )
      )
  );
$$;
revoke all on function public.can_view_transition_private_field(uuid) from public, anon;
grant execute on function public.can_view_transition_private_field(uuid) to authenticated;

-- Unique composite keys for FK attachments
alter table public.governance_approval_responses
  add constraint governance_approval_responses_id_household_unique unique (id, household_id);

alter table public.governance_attachments
  add constraint governance_attachments_approval_response_fk
  foreign key (approval_response_id, household_id)
  references public.governance_approval_responses(id, household_id)
  on delete set null;

create unique index governance_templates_system_key_idx
  on public.governance_templates(template_key)
  where household_id is null;

-- Enable RLS
alter table public.governance_templates enable row level security;
alter table public.governance_documents enable row level security;
alter table public.governance_document_versions enable row level security;
alter table public.governance_sections enable row level security;
alter table public.governance_participants enable row level security;
alter table public.governance_approval_requests enable row level security;
alter table public.governance_approval_responses enable row level security;
alter table public.governance_acknowledgments enable row level security;
alter table public.governance_comments enable row level security;
alter table public.governance_events enable row level security;
alter table public.governance_attachments enable row level security;
alter table public.governance_expense_refs enable row level security;
alter table public.governance_calendar_links enable row level security;
alter table public.household_transition_workflows enable row level security;
alter table public.household_transition_tasks enable row level security;
alter table public.household_transition_events enable row level security;
alter table public.household_transition_private_fields enable row level security;
alter table public.household_transition_private_grants enable row level security;
alter table public.household_transition_inventory_links enable row level security;
alter table public.household_transition_maintenance_links enable row level security;

create policy governance_templates_select on public.governance_templates
  for select to authenticated using (
    is_system = true
    or (household_id is not null and public.is_active_member(household_id))
  );

create policy governance_documents_select on public.governance_documents
  for select to authenticated using (public.can_view_governance_document(id));

create policy governance_versions_select on public.governance_document_versions
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_sections_select on public.governance_sections
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_participants_select on public.governance_participants
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_approval_requests_select on public.governance_approval_requests
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_approval_responses_select on public.governance_approval_responses
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_acknowledgments_select on public.governance_acknowledgments
  for select to authenticated using (
    public.can_view_governance_document(document_id)
    or membership_id = public.current_membership_id(household_id)
  );

create policy governance_comments_select on public.governance_comments
  for select to authenticated using (
    deleted_at is null and public.can_view_governance_document(document_id)
  );

create policy governance_events_select on public.governance_events
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_attachments_select on public.governance_attachments
  for select to authenticated using (
    deleted_at is null
    and permanently_deleted_at is null
    and (
      (document_id is not null and public.can_view_governance_document(document_id))
      or (
        transition_task_id is not null
        and exists (
          select 1 from public.household_transition_tasks t
          where t.id = transition_task_id
            and public.can_view_transition_workflow(t.workflow_id)
        )
      )
    )
  );

create policy governance_expense_refs_select on public.governance_expense_refs
  for select to authenticated using (public.can_view_governance_document(document_id));

create policy governance_calendar_links_select on public.governance_calendar_links
  for select to authenticated using (
    (document_id is not null and public.can_view_governance_document(document_id))
    or (
      transition_workflow_id is not null
      and public.can_view_transition_workflow(transition_workflow_id)
    )
  );

create policy household_transitions_select on public.household_transition_workflows
  for select to authenticated using (public.can_view_transition_workflow(id));

create policy household_transition_tasks_select on public.household_transition_tasks
  for select to authenticated using (public.can_view_transition_workflow(workflow_id));

create policy household_transition_events_select on public.household_transition_events
  for select to authenticated using (public.can_view_transition_workflow(workflow_id));

create policy household_transition_private_select on public.household_transition_private_fields
  for select to authenticated using (public.can_view_transition_private_field(id));

create policy household_transition_private_grants_select on public.household_transition_private_grants
  for select to authenticated using (
    public.can_view_transition_private_field(private_field_id)
    or grantee_membership_id = public.current_membership_id(household_id)
  );

create policy household_transition_inventory_select on public.household_transition_inventory_links
  for select to authenticated using (public.can_view_transition_workflow(workflow_id));

create policy household_transition_maintenance_select on public.household_transition_maintenance_links
  for select to authenticated using (public.can_view_transition_workflow(workflow_id));

-- SELECT-only for authenticated; service_role full access
do $$
declare t text;
begin
  foreach t in array array[
    'governance_templates','governance_documents','governance_document_versions',
    'governance_sections','governance_participants','governance_approval_requests',
    'governance_approval_responses','governance_acknowledgments','governance_comments',
    'governance_events','governance_attachments','governance_expense_refs',
    'governance_calendar_links','household_transition_workflows',
    'household_transition_tasks','household_transition_events',
    'household_transition_private_fields','household_transition_private_grants',
    'household_transition_inventory_links','household_transition_maintenance_links'
  ]
  loop
    execute format('revoke all on table public.%I from public', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;
