-- Phase 8: household governance — agreements, policies, approvals, transitions

-- ---------------------------------------------------------------------------
-- Templates (system + household-scoped starter content)
-- ---------------------------------------------------------------------------
create table public.governance_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  template_key text not null check (char_length(trim(template_key)) between 1 and 80),
  document_class text not null check (document_class in (
    'household_agreement','house_rules','financial_policy','guest_policy',
    'cleaning_expectations','shared_item_policy','meal_grocery_expectations',
    'safety_emergency','move_in_agreement','move_out_agreement','custom'
  )),
  title text not null check (char_length(trim(title)) between 1 and 200),
  summary text check (summary is null or char_length(summary) <= 2000),
  sections jsonb not null default '[]'::jsonb,
  approval_rules jsonb not null default '{"mode":"unanimous","quorum":1}'::jsonb,
  acknowledgment_rules jsonb not null default '{"required":false}'::jsonb,
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, template_key)
);

create index governance_templates_household_idx
  on public.governance_templates(household_id) where active;

-- ---------------------------------------------------------------------------
-- Documents (stable logical records)
-- ---------------------------------------------------------------------------
create table public.governance_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  document_class text not null check (document_class in (
    'household_agreement','house_rules','financial_policy','guest_policy',
    'cleaning_expectations','shared_item_policy','meal_grocery_expectations',
    'safety_emergency','move_in_agreement','move_out_agreement','custom'
  )),
  status text not null default 'draft' check (status in (
    'draft','proposed','under_review','approved','active','superseded',
    'archived','rejected','withdrawn'
  )),
  visibility text not null default 'private_draft' check (visibility in (
    'household','participants','coordinators','private_draft'
  )),
  title text not null check (char_length(trim(title)) between 1 and 200),
  summary text check (summary is null or char_length(summary) <= 2000),
  is_financial boolean not null default false,
  template_id uuid,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  current_version_id uuid,
  active_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create index governance_documents_household_status_idx
  on public.governance_documents(household_id, status, updated_at desc);
create index governance_documents_household_class_idx
  on public.governance_documents(household_id, document_class);

-- ---------------------------------------------------------------------------
-- Versions (immutable once approved/active)
-- ---------------------------------------------------------------------------
create table public.governance_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  version_number integer not null check (version_number >= 1),
  title text not null check (char_length(trim(title)) between 1 and 200),
  summary text check (summary is null or char_length(summary) <= 2000),
  plain_text text not null default '',
  content_hash text not null check (char_length(content_hash) between 8 and 128),
  author_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  change_summary text check (change_summary is null or char_length(change_summary) <= 2000),
  effective_at timestamptz,
  expires_at timestamptz,
  review_at timestamptz,
  superseded_by_version_id uuid,
  prior_version_id uuid,
  approval_rules jsonb not null default '{"mode":"unanimous","quorum":1}'::jsonb,
  acknowledgment_rules jsonb not null default '{"required":false}'::jsonb,
  activation_mode text not null default 'manual' check (activation_mode in (
    'immediate','scheduled','after_acknowledgments','after_approval_condition','manual'
  )),
  status text not null default 'draft' check (status in (
    'draft','proposed','under_review','approved','active','superseded',
    'archived','rejected','withdrawn'
  )),
  frozen_at timestamptz,
  activated_at timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (document_id, version_number),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade
);

create index governance_versions_document_idx
  on public.governance_document_versions(document_id, version_number desc);

alter table public.governance_documents
  add constraint governance_documents_current_version_fk
  foreign key (current_version_id, household_id)
  references public.governance_document_versions(id, household_id)
  on delete set null;

alter table public.governance_documents
  add constraint governance_documents_active_version_fk
  foreign key (active_version_id, household_id)
  references public.governance_document_versions(id, household_id)
  on delete set null;

alter table public.governance_document_versions
  add constraint governance_versions_superseded_by_fk
  foreign key (superseded_by_version_id, household_id)
  references public.governance_document_versions(id, household_id)
  on delete set null;

alter table public.governance_document_versions
  add constraint governance_versions_prior_fk
  foreign key (prior_version_id, household_id)
  references public.governance_document_versions(id, household_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------------
create table public.governance_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  document_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  position integer not null check (position >= 0),
  section_type text not null check (section_type in (
    'heading','explanatory_text','rule','financial_threshold','checklist',
    'responsibility','date_requirement','acknowledgment_clause','freeform'
  )),
  heading text check (heading is null or char_length(heading) <= 200),
  body text check (body is null or char_length(body) <= 8000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (version_id, position),
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete cascade,
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade
);

create index governance_sections_version_idx
  on public.governance_sections(version_id, position);

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------
create table public.governance_participants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  role text not null default 'participant' check (role in (
    'author','participant','required_approver','observer','coordinator'
  )),
  created_at timestamptz not null default now(),
  unique (document_id, membership_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade
);

create index governance_participants_membership_idx
  on public.governance_participants(membership_id, document_id);

-- ---------------------------------------------------------------------------
-- Approval requests / responses
-- ---------------------------------------------------------------------------
create table public.governance_approval_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  requested_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  approval_mode text not null check (approval_mode in (
    'unanimous','simple_majority','percentage','required_approvers',
    'coordinator','financial_coordinator','acknowledgment_only','mixed'
  )),
  quorum integer not null default 1 check (quorum >= 1),
  percentage_threshold integer check (
    percentage_threshold is null or (percentage_threshold between 1 and 100)
  ),
  status text not null default 'open' check (status in (
    'open','approved','rejected','changes_requested','withdrawn','superseded'
  )),
  outcome_reason text check (outcome_reason is null or char_length(outcome_reason) <= 2000),
  coordinator_override boolean not null default false,
  override_reason text check (override_reason is null or char_length(override_reason) <= 2000),
  override_by_membership_id uuid references public.household_memberships(id) on delete restrict,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete cascade
);

create index governance_approval_requests_version_idx
  on public.governance_approval_requests(version_id, status);

create table public.governance_approval_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  responder_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  decision text not null check (decision in (
    'approve','reject','abstain','request_changes'
  )),
  comment text check (comment is null or char_length(comment) <= 4000),
  version_content_hash text not null,
  created_at timestamptz not null default now(),
  unique (request_id, responder_membership_id),
  foreign key (request_id, household_id)
    references public.governance_approval_requests(id, household_id) on delete cascade,
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete cascade
);

create index governance_approval_responses_request_idx
  on public.governance_approval_responses(request_id, created_at);

-- ---------------------------------------------------------------------------
-- Acknowledgments
-- ---------------------------------------------------------------------------
create table public.governance_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  status text not null default 'pending' check (status in (
    'pending','acknowledged','overdue','waived'
  )),
  due_at timestamptz,
  acknowledged_at timestamptz,
  comment text check (comment is null or char_length(comment) <= 2000),
  version_content_hash text,
  reminder_cadence_hours integer check (
    reminder_cadence_hours is null or reminder_cadence_hours >= 1
  ),
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (version_id, membership_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete cascade
);

create index governance_acknowledgments_pending_idx
  on public.governance_acknowledgments(household_id, status, due_at)
  where status in ('pending','overdue');

-- ---------------------------------------------------------------------------
-- Comments / events / attachments
-- ---------------------------------------------------------------------------
create table public.governance_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid,
  household_id uuid not null references public.households(id) on delete restrict,
  author_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  requests_changes boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, household_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete set null
);

create table public.governance_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'draft_created','version_revised','proposed','withdrawn','comment_added',
    'changes_requested','approval_response','approved','rejected',
    'activated','acknowledged','acknowledgment_overdue','superseded',
    'archived','override','attachment_added','attachment_removed',
    'retention_action','exported'
  )),
  actor_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  body text check (body is null or char_length(body) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete set null
);

create index governance_events_document_idx
  on public.governance_events(document_id, created_at);

create table public.governance_attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  document_id uuid,
  version_id uuid,
  comment_id uuid,
  approval_response_id uuid,
  transition_task_id uuid,
  storage_path text not null check (char_length(storage_path) between 1 and 1000),
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','application/pdf','text/plain'
  )),
  file_name text not null check (char_length(trim(file_name)) between 1 and 260),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  uploaded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  permanently_deleted_at timestamptz,
  deletion_reason text check (deletion_reason is null or char_length(deletion_reason) <= 2000),
  unique (id, household_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete set null,
  foreign key (comment_id, household_id)
    references public.governance_comments(id, household_id) on delete set null
);

create index governance_attachments_document_idx
  on public.governance_attachments(document_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Domain cross-links (governance side only; no duplicated balances)
-- ---------------------------------------------------------------------------
create table public.governance_expense_refs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid,
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid,
  category_label text check (category_label is null or char_length(category_label) <= 120),
  threshold_cents integer check (threshold_cents is null or threshold_cents >= 0),
  note text check (note is null or char_length(note) <= 1000),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete set null
);

create table public.governance_calendar_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  version_id uuid,
  transition_workflow_id uuid,
  household_id uuid not null references public.households(id) on delete restrict,
  calendar_event_id uuid not null,
  link_kind text not null check (link_kind in (
    'review_meeting','effective_date','acknowledgment_deadline','policy_review',
    'move_in','move_out','transition_appointment'
  )),
  created_at timestamptz not null default now(),
  unique (calendar_event_id),
  foreign key (document_id, household_id)
    references public.governance_documents(id, household_id) on delete cascade,
  foreign key (version_id, household_id)
    references public.governance_document_versions(id, household_id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Household transition workflows
-- ---------------------------------------------------------------------------
create table public.household_transition_workflows (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  workflow_type text not null check (workflow_type in ('move_in','move_out')),
  status text not null default 'draft' check (status in (
    'draft','in_progress','blocked','ready_to_complete','completed','cancelled'
  )),
  subject_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  coordinator_membership_id uuid references public.household_memberships(id) on delete restrict,
  planned_date date,
  notice_date date,
  room_assignment text check (room_assignment is null or char_length(room_assignment) <= 200),
  linked_document_id uuid,
  visibility text not null default 'participants' check (visibility in (
    'participants','coordinators','household'
  )),
  completion_notes text check (completion_notes is null or char_length(completion_notes) <= 4000),
  membership_removal_scheduled_at timestamptz,
  membership_removed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (linked_document_id, household_id)
    references public.governance_documents(id, household_id) on delete set null
);

create index household_transitions_household_status_idx
  on public.household_transition_workflows(household_id, status, planned_date);

alter table public.governance_calendar_links
  add constraint governance_calendar_links_transition_fk
  foreign key (transition_workflow_id, household_id)
  references public.household_transition_workflows(id, household_id)
  on delete cascade;

create table public.household_transition_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  task_key text not null check (char_length(trim(task_key)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'open' check (status in (
    'open','in_progress','blocked','done','cancelled','skipped'
  )),
  assignee_membership_id uuid references public.household_memberships(id) on delete restrict,
  due_at timestamptz,
  requires_explicit_confirmation boolean not null default false,
  linked_chore_occurrence_id uuid,
  linked_inventory_item_id uuid,
  linked_maintenance_request_id uuid,
  linked_expense_id uuid,
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  completed_by_membership_id uuid references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (workflow_id, task_key),
  foreign key (workflow_id, household_id)
    references public.household_transition_workflows(id, household_id) on delete cascade
);

create index household_transition_tasks_workflow_idx
  on public.household_transition_tasks(workflow_id, position);

alter table public.governance_attachments
  add constraint governance_attachments_transition_task_fk
  foreign key (transition_task_id, household_id)
  references public.household_transition_tasks(id, household_id)
  on delete set null;

create table public.household_transition_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','advanced','task_assigned','task_completed','task_skipped',
    'blocked','unblocked','completed','cancelled','export_generated',
    'membership_removal_scheduled','note_added'
  )),
  actor_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  body text check (body is null or char_length(body) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (workflow_id, household_id)
    references public.household_transition_workflows(id, household_id) on delete cascade
);

create index household_transition_events_workflow_idx
  on public.household_transition_events(workflow_id, created_at);

-- Sensitive personal fields — narrow access (not auto-visible to coordinators)
create table public.household_transition_private_fields (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  owner_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  field_kind text not null check (field_kind in (
    'emergency_contact','forwarding_address','forwarding_email','forwarding_phone','other_private'
  )),
  label text check (label is null or char_length(label) <= 120),
  value_text text not null check (char_length(trim(value_text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (workflow_id, household_id)
    references public.household_transition_workflows(id, household_id) on delete cascade
);

create table public.household_transition_private_grants (
  id uuid primary key default gen_random_uuid(),
  private_field_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  grantee_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  granted_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (private_field_id, grantee_membership_id),
  foreign key (private_field_id, household_id)
    references public.household_transition_private_fields(id, household_id) on delete cascade
);

create table public.household_transition_inventory_links (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  inventory_item_id uuid not null,
  link_kind text not null check (link_kind in (
    'contribution','condition_review','return','transfer','disposal','replacement'
  )),
  note text check (note is null or char_length(note) <= 1000),
  confirmed boolean not null default false,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (workflow_id, household_id)
    references public.household_transition_workflows(id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id)
    references public.inventory_items(id, household_id) on delete cascade
);

create table public.household_transition_maintenance_links (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  maintenance_request_id uuid not null,
  note text check (note is null or char_length(note) <= 1000),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workflow_id, maintenance_request_id),
  foreign key (workflow_id, household_id)
    references public.household_transition_workflows(id, household_id) on delete cascade,
  foreign key (maintenance_request_id, household_id)
    references public.maintenance_requests(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- RPC-only write enforcement
-- ---------------------------------------------------------------------------
create or replace function public.enforce_governance_rpc_only()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and current_setting('householdos.governance_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'Governance records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end $$;

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
    execute format(
      'create trigger %I_rpc_only before insert or update or delete on public.%I
       for each row execute function public.enforce_governance_rpc_only()',
      t, t
    );
  end loop;
end $$;

create trigger governance_documents_set_updated_at before update on public.governance_documents
  for each row execute function public.set_updated_at();
create trigger household_transitions_set_updated_at before update on public.household_transition_workflows
  for each row execute function public.set_updated_at();
create trigger household_transition_private_set_updated_at before update on public.household_transition_private_fields
  for each row execute function public.set_updated_at();

-- Prevent silent mutation of approved/active version substantive content
create or replace function public.enforce_governance_version_immutability()
returns trigger language plpgsql as $$
begin
  if current_setting('householdos.privileged_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and old.status in ('approved','active','superseded') then
    if new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.plain_text is distinct from old.plain_text
       or new.content_hash is distinct from old.content_hash
       or new.approval_rules is distinct from old.approval_rules
       or new.acknowledgment_rules is distinct from old.acknowledgment_rules
       or new.activation_mode is distinct from old.activation_mode then
      raise exception 'Approved or active governance versions are immutable; create a new version';
    end if;
  end if;
  if tg_op = 'DELETE' and old.status in ('approved','active','superseded') then
    raise exception 'Cannot delete approved or active governance versions';
  end if;
  return coalesce(new, old);
end $$;

create trigger governance_versions_immutability
  before update or delete on public.governance_document_versions
  for each row execute function public.enforce_governance_version_immutability();

create or replace function public.enforce_governance_section_immutability()
returns trigger language plpgsql as $$
declare v_status text;
begin
  if current_setting('householdos.privileged_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  select status into v_status from public.governance_document_versions
  where id = coalesce(new.version_id, old.version_id);
  if v_status in ('approved','active','superseded') then
    raise exception 'Cannot modify sections of an approved or active governance version';
  end if;
  return coalesce(new, old);
end $$;

create trigger governance_sections_immutability
  before insert or update or delete on public.governance_sections
  for each row execute function public.enforce_governance_section_immutability();
