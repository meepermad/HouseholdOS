-- Soften personal calendar owner check so SET NULL on membership delete works
alter table public.household_calendars
  drop constraint if exists household_calendars_check;

alter table public.household_calendars
  add constraint household_calendars_check check (
    (
      calendar_type = 'personal'
      and (owner_membership_id is not null or is_archived = true)
    )
    or (calendar_type <> 'personal')
  );

-- On membership hard-delete (test cleanup), archive before FK nulls
create or replace function public._archive_personal_calendar_on_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  update public.household_calendars
  set is_archived = true,
      owner_membership_id = null,
      updated_at = now()
  where owner_membership_id = old.id
    and calendar_type = 'personal';
  return old;
end;
$$;

drop trigger if exists memberships_archive_personal_calendar_delete on public.household_memberships;
create trigger memberships_archive_personal_calendar_delete
  before delete on public.household_memberships
  for each row execute function public._archive_personal_calendar_on_membership_delete();
