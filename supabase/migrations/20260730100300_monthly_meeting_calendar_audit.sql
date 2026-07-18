-- Link optional calendar event after explicit confirm; lifecycle audit via trigger.

create or replace function public.link_meeting_calendar_event(
  p_meeting_id uuid,
  p_calendar_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_event public.calendar_events%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor
     and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can link a calendar event';
  end if;
  if v_row.status in ('cancelled', 'archived') then
    raise exception 'Cannot link calendar for status %', v_row.status;
  end if;

  select * into v_event
  from public.calendar_events
  where id = p_calendar_event_id and household_id = v_row.household_id;
  if not found then raise exception 'Calendar event not found'; end if;

  update public.household_meetings
  set calendar_event_id = p_calendar_event_id, updated_at = now()
  where id = v_row.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state
  ) values (
    v_row.household_id,
    auth.uid(),
    'household_meeting',
    v_row.id,
    'meeting.calendar_linked',
    jsonb_build_object('calendar_event_id', v_row.calendar_event_id),
    jsonb_build_object('calendar_event_id', p_calendar_event_id)
  );
end;
$$;

revoke all on function public.link_meeting_calendar_event(uuid, uuid) from public;
grant execute on function public.link_meeting_calendar_event(uuid, uuid) to authenticated;

create or replace function public._meeting_status_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (
      household_id, actor_user_id, entity_type, entity_id, event_type,
      before_state, after_state
    ) values (
      new.household_id,
      auth.uid(),
      'household_meeting',
      new.id,
      'meeting.created',
      null,
      jsonb_build_object(
        'status', new.status,
        'period_start', new.period_start,
        'period_end', new.period_end
      )
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.audit_events (
      household_id, actor_user_id, entity_type, entity_id, event_type,
      before_state, after_state
    ) values (
      new.household_id,
      auth.uid(),
      'household_meeting',
      new.id,
      'meeting.status_changed',
      jsonb_build_object('status', old.status),
      jsonb_build_object(
        'status', new.status,
        'locked_at', new.locked_at,
        'started_at', new.started_at,
        'completed_at', new.completed_at,
        'published_at', new.published_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists household_meetings_audit on public.household_meetings;
create trigger household_meetings_audit
  after insert or update of status on public.household_meetings
  for each row execute function public._meeting_status_audit();

revoke all on function public._meeting_status_audit() from public;
