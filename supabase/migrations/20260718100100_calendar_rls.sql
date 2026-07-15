-- Phase 4: calendar RLS
-- Visibility is also enforced in calendar_events_for_member() projection view helper.

alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;
alter table public.calendar_event_reminders enable row level security;
alter table public.calendar_event_exceptions enable row level security;
alter table public.calendar_event_occurrences enable row level security;
alter table public.calendar_feed_tokens enable row level security;

-- Helper: is the caller organizer or an attendee of this event?
create or replace function public.is_calendar_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_events e
    join public.household_memberships m
      on m.id = e.organizer_membership_id
     and m.user_id = auth.uid()
     and m.status = 'active'
    where e.id = p_event_id
  )
  or exists (
    select 1
    from public.calendar_event_attendees a
    join public.household_memberships m
      on m.id = a.membership_id
     and m.user_id = auth.uid()
     and m.status = 'active'
    where a.event_id = p_event_id
  );
$$;

revoke all on function public.is_calendar_event_participant(uuid) from public;
grant execute on function public.is_calendar_event_participant(uuid) to authenticated;

-- SELECT policies: active household members can see row existence for household-visible,
-- participants for participant events, and private_busy shells for others.
-- Sensitive column projection is handled by list_calendar_occurrences / get_calendar_event RPCs.
-- Table SELECT still filters which rows leak at all.

create policy calendar_events_select on public.calendar_events
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      visibility = 'household'
      or public.is_calendar_event_participant(id)
      or visibility = 'private_busy'
    )
  );

create policy calendar_event_attendees_select on public.calendar_event_attendees
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      exists (
        select 1 from public.calendar_events e
        where e.id = event_id
          and e.visibility = 'household'
      )
      or public.is_calendar_event_participant(event_id)
    )
  );

create policy calendar_event_reminders_select on public.calendar_event_reminders
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and public.is_calendar_event_participant(event_id)
  );

create policy calendar_event_exceptions_select on public.calendar_event_exceptions
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      exists (
        select 1 from public.calendar_events e
        where e.id = event_id and e.visibility = 'household'
      )
      or public.is_calendar_event_participant(event_id)
    )
  );

create policy calendar_event_occurrences_select on public.calendar_event_occurrences
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      exists (
        select 1 from public.calendar_events e
        where e.id = event_id
          and (
            e.visibility = 'household'
            or e.visibility = 'private_busy'
            or public.is_calendar_event_participant(e.id)
          )
      )
    )
  );

-- Feed tokens: owner only (never expose hash meaningfully to others — SELECT own rows only)
create policy calendar_feed_tokens_select on public.calendar_feed_tokens
  for select to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated — writes go through SECURITY DEFINER RPCs.
revoke all on table public.calendar_events from public;
revoke all on table public.calendar_event_attendees from public;
revoke all on table public.calendar_event_reminders from public;
revoke all on table public.calendar_event_exceptions from public;
revoke all on table public.calendar_event_occurrences from public;
revoke all on table public.calendar_feed_tokens from public;

grant select on table public.calendar_events to authenticated;
grant select on table public.calendar_event_attendees to authenticated;
grant select on table public.calendar_event_reminders to authenticated;
grant select on table public.calendar_event_exceptions to authenticated;
grant select on table public.calendar_event_occurrences to authenticated;
grant select on table public.calendar_feed_tokens to authenticated;

grant all on table public.calendar_events to service_role;
grant all on table public.calendar_event_attendees to service_role;
grant all on table public.calendar_event_reminders to service_role;
grant all on table public.calendar_event_exceptions to service_role;
grant all on table public.calendar_event_occurrences to service_role;
grant all on table public.calendar_feed_tokens to service_role;
