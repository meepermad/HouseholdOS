-- Allow membership cleanup: personal calendar owner FK should SET NULL
alter table public.household_calendars
  drop constraint if exists household_calendars_owner_membership_id_fkey;

alter table public.household_calendars
  add constraint household_calendars_owner_membership_id_fkey
  foreign key (owner_membership_id)
  references public.household_memberships (id)
  on delete set null;

-- Soft-archive personal calendars when membership leaves (via trigger)
create or replace function public._archive_personal_calendar_on_membership_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'active' and old.status = 'active' then
    perform set_config('householdos.calendar_mutation', 'rpc', true);
    update public.household_calendars
    set is_archived = true, updated_at = now()
    where owner_membership_id = new.id
      and calendar_type = 'personal'
      and is_archived = false;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_archive_personal_calendar on public.household_memberships;
create trigger memberships_archive_personal_calendar
  after update of status on public.household_memberships
  for each row execute function public._archive_personal_calendar_on_membership_leave();
