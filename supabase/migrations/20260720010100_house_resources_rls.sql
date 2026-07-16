-- Phase 6: house resource row-level security

alter table public.household_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_condition_events enable row level security;
alter table public.inventory_ownership_members enable row level security;
alter table public.supply_items enable row level security;
alter table public.supply_stock_events enable row level security;
alter table public.pantry_items enable row level security;
alter table public.pantry_visibility_members enable row level security;
alter table public.pantry_stock_events enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.resource_expense_links enable row level security;

create or replace function public._resource_active_membership(p_household_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select m.id into v_id from public.household_memberships m
  where m.household_id = p_household_id and m.user_id = auth.uid() and m.status = 'active';
  if v_id is null then raise exception 'Active membership required for this household'; end if;
  return v_id;
end $$;
revoke all on function public._resource_active_membership(uuid) from public, anon;

-- Coordinators must NOT bypass owner_only personal resources.
create or replace function public.can_view_inventory_item(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inventory_items i
    where i.id = p_item_id
      and public.is_active_member(i.household_id)
      and (
        i.visibility = 'household'
        or (
          i.visibility = 'owner_only'
          and i.owner_membership_id = public.current_membership_id(i.household_id)
        )
        or (
          i.visibility = 'selected_members'
          and (
            i.owner_membership_id = public.current_membership_id(i.household_id)
            or exists (
              select 1 from public.inventory_ownership_members om
              where om.inventory_item_id = i.id
                and om.membership_id = public.current_membership_id(i.household_id)
            )
          )
        )
      )
  )
$$;
revoke all on function public.can_view_inventory_item(uuid) from public, anon;
grant execute on function public.can_view_inventory_item(uuid) to authenticated;

create or replace function public.can_view_supply_item(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.supply_items s
    where s.id = p_item_id
      and public.is_active_member(s.household_id)
      and (
        s.visibility = 'household'
        or (
          s.visibility = 'owner_only'
          and s.owner_membership_id = public.current_membership_id(s.household_id)
        )
      )
  )
$$;
revoke all on function public.can_view_supply_item(uuid) from public, anon;
grant execute on function public.can_view_supply_item(uuid) to authenticated;

create or replace function public.can_view_pantry_item(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pantry_items p
    where p.id = p_item_id
      and public.is_active_member(p.household_id)
      and (
        p.visibility = 'household'
        or (
          p.visibility = 'owner_only'
          and p.owner_membership_id = public.current_membership_id(p.household_id)
        )
        or (
          p.visibility = 'selected_members'
          and (
            p.owner_membership_id = public.current_membership_id(p.household_id)
            or exists (
              select 1 from public.pantry_visibility_members vm
              where vm.pantry_item_id = p.id
                and vm.membership_id = public.current_membership_id(p.household_id)
            )
          )
        )
      )
  )
$$;
revoke all on function public.can_view_pantry_item(uuid) from public, anon;
grant execute on function public.can_view_pantry_item(uuid) to authenticated;

create policy household_locations_select on public.household_locations
  for select to authenticated using (public.is_active_member(household_id));

create policy inventory_items_select on public.inventory_items
  for select to authenticated using (public.can_view_inventory_item(id));

create policy inventory_condition_events_select on public.inventory_condition_events
  for select to authenticated using (public.can_view_inventory_item(inventory_item_id));

create policy inventory_ownership_members_select on public.inventory_ownership_members
  for select to authenticated using (public.can_view_inventory_item(inventory_item_id));

create policy supply_items_select on public.supply_items
  for select to authenticated using (public.can_view_supply_item(id));

create policy supply_stock_events_select on public.supply_stock_events
  for select to authenticated using (public.can_view_supply_item(supply_item_id));

create policy pantry_items_select on public.pantry_items
  for select to authenticated using (public.can_view_pantry_item(id));

create policy pantry_visibility_members_select on public.pantry_visibility_members
  for select to authenticated using (public.can_view_pantry_item(pantry_item_id));

create policy pantry_stock_events_select on public.pantry_stock_events
  for select to authenticated using (public.can_view_pantry_item(pantry_item_id));

create policy shopping_lists_select on public.shopping_lists
  for select to authenticated using (public.is_active_member(household_id));

create policy shopping_list_items_select on public.shopping_list_items
  for select to authenticated using (public.is_active_member(household_id));

create policy resource_expense_links_select on public.resource_expense_links
  for select to authenticated using (public.is_active_member(household_id));

revoke all on table
  public.household_locations,
  public.inventory_items,
  public.inventory_condition_events,
  public.inventory_ownership_members,
  public.supply_items,
  public.supply_stock_events,
  public.pantry_items,
  public.pantry_visibility_members,
  public.pantry_stock_events,
  public.shopping_lists,
  public.shopping_list_items,
  public.resource_expense_links
from public, anon, authenticated;

grant select on table
  public.household_locations,
  public.inventory_items,
  public.inventory_condition_events,
  public.inventory_ownership_members,
  public.supply_items,
  public.supply_stock_events,
  public.pantry_items,
  public.pantry_visibility_members,
  public.pantry_stock_events,
  public.shopping_lists,
  public.shopping_list_items,
  public.resource_expense_links
to authenticated;

grant all on table
  public.household_locations,
  public.inventory_items,
  public.inventory_condition_events,
  public.inventory_ownership_members,
  public.supply_items,
  public.supply_stock_events,
  public.pantry_items,
  public.pantry_visibility_members,
  public.pantry_stock_events,
  public.shopping_lists,
  public.shopping_list_items,
  public.resource_expense_links
to service_role;
