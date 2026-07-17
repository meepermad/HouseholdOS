-- CSV import batches + household export jobs

create table public.household_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  domain text not null check (domain in (
    'inventory','supplies','pantry','shopping','chores','responsibilities','utilities','calendar_events'
  )),
  status text not null default 'uploaded' check (status in (
    'uploaded','mapped','validated','previewed','executing','completed','failed','cancelled'
  )),
  file_name text not null,
  row_count int not null default 0 check (row_count >= 0 and row_count <= 5000),
  column_map jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  error_summary text,
  result_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, household_id),
  unique (household_id, idempotency_key)
);

create table public.household_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  household_id uuid not null,
  row_number int not null,
  raw jsonb not null default '{}'::jsonb,
  mapped jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending','valid','warning','error','imported','skipped'
  )),
  messages text[] not null default '{}',
  created_entity_id uuid,
  created_at timestamptz not null default now(),
  foreign key (batch_id, household_id) references public.household_import_batches(id, household_id) on delete cascade
);

create index household_import_rows_batch_idx
  on public.household_import_rows(batch_id, row_number);

create table public.household_export_jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  requested_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  storage_path text,
  expires_at timestamptz,
  error_text text,
  result_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, household_id)
);

create index household_export_jobs_claim_idx
  on public.household_export_jobs(status, created_at);

create trigger household_import_batches_set_updated_at
  before update on public.household_import_batches
  for each row execute function public.set_updated_at();

create trigger household_export_jobs_set_updated_at
  before update on public.household_export_jobs
  for each row execute function public.set_updated_at();

alter table public.household_import_batches enable row level security;
alter table public.household_import_rows enable row level security;
alter table public.household_export_jobs enable row level security;

create policy household_import_batches_select on public.household_import_batches
  for select to authenticated using (public.is_active_member(household_id));
create policy household_import_rows_select on public.household_import_rows
  for select to authenticated using (public.is_active_member(household_id));
create policy household_export_jobs_select on public.household_export_jobs
  for select to authenticated using (public.is_active_member(household_id));

create policy household_import_batches_no_write on public.household_import_batches
  for all to authenticated using (false) with check (false);
create policy household_import_rows_no_write on public.household_import_rows
  for all to authenticated using (false) with check (false);
create policy household_export_jobs_no_write on public.household_export_jobs
  for all to authenticated using (false) with check (false);

-- Export storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'household-exports',
  'household-exports',
  false,
  52428800,
  array['application/json','text/csv','application/zip']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists household_exports_storage_select on storage.objects;
drop policy if exists household_exports_storage_insert on storage.objects;

create policy household_exports_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'household-exports'
    and public.is_household_coordinator((storage.foldername(name))[1]::uuid)
  );

create policy household_exports_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'household-exports'
    and public.is_household_coordinator((storage.foldername(name))[1]::uuid)
  );
