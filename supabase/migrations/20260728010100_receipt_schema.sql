-- Launch phase: receipt capture + OCR review tables

create table public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  uploaded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  storage_path text not null check (char_length(storage_path) between 1 and 1000),
  mime_type text not null,
  file_name text not null check (char_length(file_name) between 1 and 260),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  file_hash text,
  perceptual_hash text,
  status text not null default 'uploaded' check (status in (
    'uploaded','extracting','needs_review','confirmed','rejected','failed'
  )),
  expense_id uuid,
  confirm_idempotency_key text,
  merchant_corrected text check (merchant_corrected is null or char_length(merchant_corrected) <= 200),
  purchase_date_corrected date,
  currency text not null default 'USD' check (char_length(currency) = 3),
  declared_total_cents int check (declared_total_cents is null or declared_total_cents >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (confirm_idempotency_key),
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete set null
);

create index expense_receipts_household_status_idx
  on public.expense_receipts(household_id, status, created_at desc);
create index expense_receipts_file_hash_idx
  on public.expense_receipts(household_id, file_hash)
  where file_hash is not null and deleted_at is null;

create table public.expense_receipt_extractions (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null,
  adapter_name text not null,
  confidence numeric,
  proposed jsonb not null default '{}'::jsonb,
  content_hash text,
  raw_response_redacted jsonb,
  created_at timestamptz not null default now(),
  foreign key (receipt_id, household_id) references public.expense_receipts(id, household_id) on delete cascade,
  unique (id, household_id)
);

create table public.expense_receipt_line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null,
  sort_index int not null default 0,
  ocr_text text,
  corrected_name text,
  quantity numeric,
  unit_price_cents int check (unit_price_cents is null or unit_price_cents >= 0),
  total_price_cents int check (total_price_cents is null or total_price_cents >= 0),
  classification text not null default 'needs_review' check (classification in (
    'shared_household','personal_purchaser','personal_other','shared_selected','excluded','needs_review'
  )),
  category text,
  participant_membership_ids uuid[] not null default '{}',
  resource_destination text not null default 'none' check (resource_destination in (
    'none','pantry_add','pantry_restock','supply_add','supply_restock','inventory_add','shopping_complete','do_not_track'
  )),
  confidence numeric,
  review_status text not null default 'pending' check (review_status in (
    'pending','accepted','corrected','excluded'
  )),
  expense_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (receipt_id, household_id) references public.expense_receipts(id, household_id) on delete cascade,
  unique (id, household_id)
);

create table public.expense_receipt_duplicates (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null,
  match_receipt_id uuid,
  match_expense_id uuid,
  outcome text not null check (outcome in ('none','exact','possible','existing_expense')),
  signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (receipt_id, household_id) references public.expense_receipts(id, household_id) on delete cascade
);

create table public.expense_receipt_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  household_id uuid not null,
  status text not null default 'queued' check (status in ('queued','claimed','succeeded','failed')),
  attempts int not null default 0,
  claimed_by uuid,
  claimed_at timestamptz,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (receipt_id, household_id) references public.expense_receipts(id, household_id) on delete cascade
);

create index expense_receipt_jobs_claim_idx
  on public.expense_receipt_jobs(status, available_at, created_at);

create trigger expense_receipts_set_updated_at
  before update on public.expense_receipts
  for each row execute function public.set_updated_at();

create trigger expense_receipt_line_items_set_updated_at
  before update on public.expense_receipt_line_items
  for each row execute function public.set_updated_at();

create trigger expense_receipt_jobs_set_updated_at
  before update on public.expense_receipt_jobs
  for each row execute function public.set_updated_at();
