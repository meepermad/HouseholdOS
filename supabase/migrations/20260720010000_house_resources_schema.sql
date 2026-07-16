-- Phase 6: house resources — locations, inventory, supplies, pantry, shopping, expense links

-- ---------------------------------------------------------------------------
-- household_locations
-- ---------------------------------------------------------------------------
create table public.household_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  parent_id uuid,
  archived_at timestamptz,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, name),
  foreign key (parent_id, household_id) references public.household_locations(id, household_id) on delete set null
);

create index household_locations_household_idx on public.household_locations(household_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- inventory_items
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text not null check (category in (
    'appliance','kitchenware','furniture','electronics','cleaning_equipment',
    'bathroom','bedroom','tool','safety','decor','outdoor','documented_property','other'
  )),
  ownership_mode text not null default 'household' check (ownership_mode in (
    'household','personal','shared_selected','temporary','unknown'
  )),
  owner_membership_id uuid references public.household_memberships(id) on delete restrict,
  visibility text not null default 'household' check (visibility in (
    'household','owner_only','selected_members'
  )),
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  quantity_unit text not null default 'item' check (quantity_unit in (
    'item','pack','roll','bottle','box','bag','can','jar','ounce','pound','gram',
    'kilogram','milliliter','liter','cup','tablespoon','teaspoon','serving','unknown'
  )),
  quantity_is_approximate boolean not null default false,
  location_id uuid,
  condition text not null default 'unknown' check (condition in (
    'new','good','fair','worn','damaged','repair_needed','unknown'
  )),
  status text not null default 'active' check (status in (
    'active','loaned','missing','damaged','repair_needed','disposed','donated',
    'sold','moved_out','returned'
  )),
  brand text check (brand is null or char_length(brand) <= 200),
  model text check (model is null or char_length(model) <= 200),
  serial_number text check (serial_number is null or char_length(serial_number) <= 200),
  purchase_date date,
  purchase_price_cents integer check (purchase_price_cents is null or purchase_price_cents >= 0),
  acquired_by_membership_id uuid references public.household_memberships(id) on delete restrict,
  warranty_expires_at date,
  loan_return_at date,
  move_out_disposition text check (move_out_disposition is null or char_length(move_out_disposition) <= 2000),
  responsibility_area_id uuid,
  responsible_membership_id uuid references public.household_memberships(id) on delete restrict,
  related_chore_definition_id uuid,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (location_id, household_id) references public.household_locations(id, household_id) on delete set null,
  foreign key (responsibility_area_id, household_id) references public.responsibility_areas(id, household_id) on delete set null,
  foreign key (related_chore_definition_id, household_id) references public.chore_definitions(id, household_id) on delete set null,
  check (
    (ownership_mode in ('personal','temporary') and owner_membership_id is not null)
    or (ownership_mode in ('household','unknown','shared_selected'))
  ),
  check (
    (ownership_mode <> 'household' and ownership_mode <> 'unknown')
    or owner_membership_id is null
  )
);

create index inventory_items_household_status_idx on public.inventory_items(household_id, status);
create index inventory_items_household_category_idx on public.inventory_items(household_id, category);
create index inventory_items_location_idx on public.inventory_items(location_id);
create index inventory_items_owner_idx on public.inventory_items(owner_membership_id) where owner_membership_id is not null;

create table public.inventory_condition_events (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  previous_condition text not null,
  new_condition text not null,
  changed_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  reason text check (reason is null or char_length(reason) <= 500),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete cascade
);

create index inventory_condition_events_item_idx on public.inventory_condition_events(inventory_item_id, created_at desc);

create table public.inventory_ownership_members (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (inventory_item_id, membership_id),
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- supply_items
-- ---------------------------------------------------------------------------
create table public.supply_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  category text not null check (category in (
    'paper_goods','cleaning','laundry','dishwashing','bathroom','trash_recycling',
    'maintenance','safety','office','other'
  )),
  ownership_mode text not null default 'household' check (ownership_mode in (
    'household','personal','temporary','unknown'
  )),
  owner_membership_id uuid references public.household_memberships(id) on delete restrict,
  visibility text not null default 'household' check (visibility in (
    'household','owner_only','selected_members'
  )),
  quantity numeric(12,3),
  quantity_unit text not null default 'item' check (quantity_unit in (
    'item','pack','roll','bottle','box','bag','can','jar','ounce','pound','gram',
    'kilogram','milliliter','liter','cup','tablespoon','teaspoon','serving','unknown'
  )),
  quantity_is_approximate boolean not null default true,
  stock_state text not null default 'unknown' check (stock_state in (
    'in_stock','low','out','unknown'
  )),
  reorder_threshold numeric(12,3) check (reorder_threshold is null or reorder_threshold >= 0),
  target_quantity numeric(12,3) check (target_quantity is null or target_quantity >= 0),
  location_id uuid,
  responsible_membership_id uuid references public.household_memberships(id) on delete restrict,
  responsibility_area_id uuid,
  related_chore_definition_id uuid,
  preferred_brand text check (preferred_brand is null or char_length(preferred_brand) <= 200),
  notes text check (notes is null or char_length(notes) <= 4000),
  last_purchased_at date,
  last_restocked_at timestamptz,
  last_stock_check_at timestamptz,
  restock_policy text not null default 'suggest' check (restock_policy in (
    'manual','suggest','automatic'
  )),
  active boolean not null default true,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (location_id, household_id) references public.household_locations(id, household_id) on delete set null,
  foreign key (responsibility_area_id, household_id) references public.responsibility_areas(id, household_id) on delete set null,
  foreign key (related_chore_definition_id, household_id) references public.chore_definitions(id, household_id) on delete set null,
  check (
    (ownership_mode in ('personal','temporary') and owner_membership_id is not null)
    or (ownership_mode in ('household','unknown'))
  )
);

create index supply_items_household_stock_idx on public.supply_items(household_id, stock_state) where active;
create index supply_items_household_category_idx on public.supply_items(household_id, category);

create table public.supply_stock_events (
  id uuid primary key default gen_random_uuid(),
  supply_item_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','counted','restocked','used','adjusted','finished','discarded','transferred','corrected'
  )),
  previous_quantity numeric(12,3),
  new_quantity numeric(12,3),
  delta_quantity numeric(12,3),
  previous_stock_state text,
  new_stock_state text,
  reason text check (reason is null or char_length(reason) <= 500),
  note text check (note is null or char_length(note) <= 2000),
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (supply_item_id, household_id) references public.supply_items(id, household_id) on delete cascade
);

create index supply_stock_events_item_idx on public.supply_stock_events(supply_item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- pantry_items
-- ---------------------------------------------------------------------------
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  normalized_name text check (normalized_name is null or char_length(normalized_name) <= 200),
  name_aliases text[] not null default '{}',
  category text not null check (category in (
    'produce','meat','seafood','dairy','eggs','grains','pasta','bread','canned','frozen',
    'snacks','beverages','condiments','spices','baking','prepared_food','leftovers','other'
  )),
  ownership_mode text not null default 'household' check (ownership_mode in (
    'household','personal','temporary','unknown'
  )),
  owner_membership_id uuid references public.household_memberships(id) on delete restrict,
  visibility text not null default 'household' check (visibility in (
    'household','owner_only','selected_members'
  )),
  quantity numeric(12,3),
  quantity_unit text not null default 'item' check (quantity_unit in (
    'item','pack','roll','bottle','box','bag','can','jar','ounce','pound','gram',
    'kilogram','milliliter','liter','cup','tablespoon','teaspoon','serving','unknown'
  )),
  quantity_is_approximate boolean not null default true,
  location_id uuid,
  purchased_at date,
  prepared_at date,
  best_by date,
  use_by date,
  opened_at date,
  use_soon_at date,
  state text not null default 'available' check (state in (
    'available','low','use_soon','expired','finished','discarded','unknown'
  )),
  communal_available boolean not null default true,
  remaining_state text check (remaining_state is null or remaining_state in (
    'plenty','about_half','low','finished','unknown'
  )),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (location_id, household_id) references public.household_locations(id, household_id) on delete set null,
  check (
    (ownership_mode in ('personal','temporary') and owner_membership_id is not null)
    or (ownership_mode in ('household','unknown'))
  )
);

create index pantry_items_household_state_idx on public.pantry_items(household_id, state);
create index pantry_items_use_soon_idx on public.pantry_items(household_id, use_soon_at) where use_soon_at is not null;
create index pantry_items_owner_idx on public.pantry_items(owner_membership_id) where owner_membership_id is not null;
create index pantry_items_normalized_name_idx on public.pantry_items(household_id, normalized_name);

create table public.pantry_visibility_members (
  id uuid primary key default gen_random_uuid(),
  pantry_item_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (pantry_item_id, membership_id),
  foreign key (pantry_item_id, household_id) references public.pantry_items(id, household_id) on delete cascade
);

create table public.pantry_stock_events (
  id uuid primary key default gen_random_uuid(),
  pantry_item_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','counted','restocked','used','adjusted','finished','discarded','transferred','corrected'
  )),
  previous_quantity numeric(12,3),
  new_quantity numeric(12,3),
  delta_quantity numeric(12,3),
  previous_state text,
  new_state text,
  reason text check (reason is null or char_length(reason) <= 500),
  note text check (note is null or char_length(note) <= 2000),
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (pantry_item_id, household_id) references public.pantry_items(id, household_id) on delete cascade
);

create index pantry_stock_events_item_idx on public.pantry_stock_events(pantry_item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- shopping_lists / shopping_list_items
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  is_default boolean not null default false,
  store_label text check (store_label is null or char_length(store_label) <= 200),
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  responsibility_area_id uuid,
  archived_at timestamptz,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (responsibility_area_id, household_id) references public.responsibility_areas(id, household_id) on delete set null
);

create unique index shopping_lists_default_uidx on public.shopping_lists(household_id)
  where is_default and archived_at is null;
create index shopping_lists_household_idx on public.shopping_lists(household_id) where archived_at is null;

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category text not null default 'other' check (category in (
    'groceries','supplies','household','hardware','personal','other'
  )),
  requested_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  intended_ownership text not null default 'household' check (intended_ownership in (
    'household','personal','temporary','unknown'
  )),
  intended_owner_membership_id uuid references public.household_memberships(id) on delete restrict,
  quantity numeric(12,3),
  quantity_unit text not null default 'item' check (quantity_unit in (
    'item','pack','roll','bottle','box','bag','can','jar','ounce','pound','gram',
    'kilogram','milliliter','liter','cup','tablespoon','teaspoon','serving','unknown'
  )),
  quantity_is_approximate boolean not null default true,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  needed_by date,
  assigned_shopper_membership_id uuid references public.household_memberships(id) on delete restrict,
  status text not null default 'requested' check (status in (
    'requested','approved','assigned','in_cart','purchased','unavailable','cancelled'
  )),
  estimated_cost_cents integer check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  approval_hint boolean not null default false,
  related_supply_id uuid,
  related_pantry_id uuid,
  related_inventory_id uuid,
  related_chore_occurrence_id uuid,
  related_calendar_event_id uuid references public.calendar_events(id) on delete set null,
  purchaser_membership_id uuid references public.household_memberships(id) on delete restrict,
  purchased_quantity numeric(12,3),
  purchased_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (list_id, household_id) references public.shopping_lists(id, household_id) on delete cascade,
  foreign key (related_supply_id, household_id) references public.supply_items(id, household_id) on delete set null,
  foreign key (related_pantry_id, household_id) references public.pantry_items(id, household_id) on delete set null,
  foreign key (related_inventory_id, household_id) references public.inventory_items(id, household_id) on delete set null,
  foreign key (related_chore_occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete set null,
  check (
    (intended_ownership in ('personal','temporary') and intended_owner_membership_id is not null)
    or (intended_ownership in ('household','unknown'))
  )
);

create index shopping_list_items_list_status_idx on public.shopping_list_items(list_id, status);
create index shopping_list_items_household_status_idx on public.shopping_list_items(household_id, status);
create index shopping_list_items_shopper_idx on public.shopping_list_items(assigned_shopper_membership_id)
  where assigned_shopper_membership_id is not null;
create unique index shopping_list_items_active_supply_uidx
  on public.shopping_list_items(related_supply_id)
  where related_supply_id is not null
    and status in ('requested','approved','assigned','in_cart');

-- ---------------------------------------------------------------------------
-- resource_expense_links
-- ---------------------------------------------------------------------------
create table public.resource_expense_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid not null,
  expense_item_id uuid not null,
  resource_type text not null check (resource_type in (
    'inventory','supply','pantry','shopping_item'
  )),
  resource_id uuid not null,
  link_kind text not null check (link_kind in (
    'acquisition','restock','purchase_completion'
  )),
  unlinked_at timestamptz,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (expense_item_id, household_id) references public.expense_items(id, household_id) on delete restrict,
  foreign key (expense_id) references public.expenses(id) on delete restrict
);

create unique index resource_expense_links_active_uidx
  on public.resource_expense_links(expense_item_id, resource_type, resource_id)
  where unlinked_at is null;
create index resource_expense_links_resource_idx
  on public.resource_expense_links(resource_type, resource_id)
  where unlinked_at is null;
create index resource_expense_links_household_idx on public.resource_expense_links(household_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger household_locations_set_updated_at before update on public.household_locations
  for each row execute function public.set_updated_at();
create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger supply_items_set_updated_at before update on public.supply_items
  for each row execute function public.set_updated_at();
create trigger pantry_items_set_updated_at before update on public.pantry_items
  for each row execute function public.set_updated_at();
create trigger shopping_lists_set_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();
create trigger shopping_list_items_set_updated_at before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC-only mutation guards
-- ---------------------------------------------------------------------------
create or replace function public.enforce_resource_rpc_only() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and current_setting('householdos.resource_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'House resource records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end $$;

create trigger household_locations_rpc_only before insert or update or delete on public.household_locations
  for each row execute function public.enforce_resource_rpc_only();
create trigger inventory_items_rpc_only before insert or update or delete on public.inventory_items
  for each row execute function public.enforce_resource_rpc_only();
create trigger inventory_condition_events_rpc_only before insert or update or delete on public.inventory_condition_events
  for each row execute function public.enforce_resource_rpc_only();
create trigger inventory_ownership_members_rpc_only before insert or update or delete on public.inventory_ownership_members
  for each row execute function public.enforce_resource_rpc_only();
create trigger supply_items_rpc_only before insert or update or delete on public.supply_items
  for each row execute function public.enforce_resource_rpc_only();
create trigger supply_stock_events_rpc_only before insert or update or delete on public.supply_stock_events
  for each row execute function public.enforce_resource_rpc_only();
create trigger pantry_items_rpc_only before insert or update or delete on public.pantry_items
  for each row execute function public.enforce_resource_rpc_only();
create trigger pantry_visibility_members_rpc_only before insert or update or delete on public.pantry_visibility_members
  for each row execute function public.enforce_resource_rpc_only();
create trigger pantry_stock_events_rpc_only before insert or update or delete on public.pantry_stock_events
  for each row execute function public.enforce_resource_rpc_only();
create trigger shopping_lists_rpc_only before insert or update or delete on public.shopping_lists
  for each row execute function public.enforce_resource_rpc_only();
create trigger shopping_list_items_rpc_only before insert or update or delete on public.shopping_list_items
  for each row execute function public.enforce_resource_rpc_only();
create trigger resource_expense_links_rpc_only before insert or update or delete on public.resource_expense_links
  for each row execute function public.enforce_resource_rpc_only();
