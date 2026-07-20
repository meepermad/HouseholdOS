-- Security-B1: poll integrity, authorization, anonymity

-- Option must belong to the same poll as the vote
alter table public.household_poll_votes
  drop constraint if exists household_poll_votes_option_poll_fkey;

-- Enforce via trigger: option.poll_id = vote.poll_id
create or replace function public._poll_vote_option_belongs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opt_poll uuid;
begin
  select poll_id into v_opt_poll
  from public.household_poll_options
  where id = new.option_id and household_id = new.household_id;
  if v_opt_poll is null or v_opt_poll is distinct from new.poll_id then
    raise exception 'Poll option does not belong to this poll';
  end if;
  return new;
end;
$$;

drop trigger if exists household_poll_votes_option_belongs on public.household_poll_votes;
create trigger household_poll_votes_option_belongs
  before insert or update on public.household_poll_votes
  for each row execute function public._poll_vote_option_belongs();

-- Single-choice: at most one active selection set per member (enforced in cast_poll_vote)
create or replace function public.can_manage_poll(p_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_polls p
    where p.id = p_poll_id
      and public.is_active_member(p.household_id)
      and (
        p.created_by_membership_id = public.current_membership_id(p.household_id)
        or public.is_household_coordinator(p.household_id)
      )
  );
$$;

revoke all on function public.can_manage_poll(uuid) from public;
grant execute on function public.can_manage_poll(uuid) to authenticated;

-- Tighten RLS: revoke broad writes
drop policy if exists household_polls_insert on public.household_polls;
drop policy if exists household_polls_update on public.household_polls;
drop policy if exists household_poll_options_insert on public.household_poll_options;
drop policy if exists household_poll_votes_insert on public.household_poll_votes;
drop policy if exists household_poll_votes_select on public.household_poll_votes;

create policy household_polls_no_direct_write on public.household_polls
  for insert to authenticated with check (false);
create policy household_polls_no_direct_update on public.household_polls
  for update to authenticated using (false);
create policy household_poll_options_no_direct_write on public.household_poll_options
  for insert to authenticated with check (false);
create policy household_poll_votes_no_direct_write on public.household_poll_votes
  for insert to authenticated with check (false);

-- Anonymous: votes readable only by self (has_voted) or poll managers; never expose others' membership on anonymous polls
create policy household_poll_votes_select on public.household_poll_votes
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or public.can_manage_poll(poll_id)
      or exists (
        select 1 from public.household_polls p
        where p.id = poll_id and p.anonymous = false
      )
    )
  );

-- Aggregate projection for anonymous (and general) results
create or replace function public.poll_option_tallies(p_poll_id uuid)
returns table (
  option_id uuid,
  label text,
  vote_count bigint,
  sort_order int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hh uuid;
begin
  select household_id into v_hh from public.household_polls where id = p_poll_id;
  if v_hh is null or not public.is_active_member(v_hh) then
    raise exception 'Poll not found';
  end if;
  return query
  select o.id, o.label, count(v.id)::bigint, o.sort_order
  from public.household_poll_options o
  left join public.household_poll_votes v on v.option_id = o.id and v.poll_id = o.poll_id
  where o.poll_id = p_poll_id
  group by o.id, o.label, o.sort_order
  order by o.sort_order, o.label;
end;
$$;

create or replace function public.poll_current_member_has_voted(p_poll_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hh uuid;
  v_mem uuid;
begin
  select household_id into v_hh from public.household_polls where id = p_poll_id;
  if v_hh is null or not public.is_active_member(v_hh) then
    return false;
  end if;
  v_mem := public.current_membership_id(v_hh);
  return exists (
    select 1 from public.household_poll_votes
    where poll_id = p_poll_id and membership_id = v_mem
  );
end;
$$;

revoke all on function public.poll_option_tallies(uuid) from public;
revoke all on function public.poll_current_member_has_voted(uuid) from public;
grant execute on function public.poll_option_tallies(uuid) to authenticated;
grant execute on function public.poll_current_member_has_voted(uuid) to authenticated;

-- RPCs
create or replace function public.create_poll(
  p_household_id uuid,
  p_question text,
  p_options text[],
  p_allow_multiple boolean default false,
  p_anonymous boolean default false,
  p_deadline_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_i int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  if p_options is null or cardinality(p_options) < 2 then
    raise exception 'At least two options required';
  end if;
  v_actor := public.current_membership_id(p_household_id);

  insert into public.household_polls (
    household_id, created_by_membership_id, question, allow_multiple, anonymous, deadline_at, status
  ) values (
    p_household_id, v_actor, trim(p_question), coalesce(p_allow_multiple, false),
    coalesce(p_anonymous, false), p_deadline_at, 'open'
  ) returning id into v_id;

  for v_i in 1 .. cardinality(p_options) loop
    insert into public.household_poll_options (poll_id, household_id, label, sort_order)
    values (v_id, p_household_id, trim(p_options[v_i]), v_i - 1);
  end loop;

  return v_id;
end;
$$;

create or replace function public.update_poll(
  p_poll_id uuid,
  p_question text default null,
  p_deadline_at timestamptz default null,
  p_clear_deadline boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.household_polls%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.household_polls where id = p_poll_id for update;
  if not found then raise exception 'Poll not found'; end if;
  if not public.can_manage_poll(p_poll_id) then
    raise exception 'Not authorized to update this poll';
  end if;
  if exists (select 1 from public.household_poll_votes where poll_id = p_poll_id) then
    raise exception 'Cannot edit poll after voting has begun';
  end if;
  update public.household_polls
  set question = coalesce(nullif(trim(p_question), ''), question),
      deadline_at = case
        when p_clear_deadline then null
        when p_deadline_at is not null then p_deadline_at
        else deadline_at
      end,
      updated_at = now()
  where id = p_poll_id;
end;
$$;

create or replace function public.add_poll_option(
  p_poll_id uuid,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.household_polls%rowtype;
  v_id uuid;
  v_ord int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.household_polls where id = p_poll_id for update;
  if not found then raise exception 'Poll not found'; end if;
  if not public.can_manage_poll(p_poll_id) then
    raise exception 'Not authorized to add options';
  end if;
  if v_p.status <> 'open' then raise exception 'Poll is not open'; end if;
  if exists (select 1 from public.household_poll_votes where poll_id = p_poll_id) then
    raise exception 'Cannot add options after voting has begun';
  end if;
  select coalesce(max(sort_order), -1) + 1 into v_ord
  from public.household_poll_options where poll_id = p_poll_id;
  insert into public.household_poll_options (poll_id, household_id, label, sort_order)
  values (p_poll_id, v_p.household_id, trim(p_label), v_ord)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.open_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_poll(p_poll_id) then
    raise exception 'Not authorized';
  end if;
  update public.household_polls set status = 'open', updated_at = now() where id = p_poll_id;
end;
$$;

create or replace function public.close_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_poll(p_poll_id) then
    raise exception 'Not authorized';
  end if;
  update public.household_polls set status = 'closed', updated_at = now() where id = p_poll_id;
end;
$$;

create or replace function public.cast_poll_vote(
  p_poll_id uuid,
  p_option_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.household_polls%rowtype;
  v_actor uuid;
  v_opt uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.household_polls where id = p_poll_id for update;
  if not found then raise exception 'Poll not found'; end if;
  if not public.is_active_member(v_p.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_p.status <> 'open' then raise exception 'Poll is closed'; end if;
  if v_p.deadline_at is not null and v_p.deadline_at < now() then
    raise exception 'Poll deadline has passed';
  end if;
  if p_option_ids is null or cardinality(p_option_ids) < 1 then
    raise exception 'Select at least one option';
  end if;
  if not v_p.allow_multiple and cardinality(p_option_ids) > 1 then
    raise exception 'Single-choice poll allows only one option';
  end if;

  v_actor := public.current_membership_id(v_p.household_id);

  foreach v_opt in array p_option_ids loop
    if not exists (
      select 1 from public.household_poll_options
      where id = v_opt and poll_id = p_poll_id and household_id = v_p.household_id
    ) then
      raise exception 'Option does not belong to this poll';
    end if;
  end loop;

  -- Replace prior votes for this member (single or multi)
  delete from public.household_poll_votes
  where poll_id = p_poll_id and membership_id = v_actor;

  foreach v_opt in array p_option_ids loop
    insert into public.household_poll_votes (poll_id, option_id, household_id, membership_id)
    values (p_poll_id, v_opt, v_p.household_id, v_actor);
  end loop;
end;
$$;

create or replace function public.remove_poll_vote(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.household_polls%rowtype;
  v_actor uuid;
begin
  select * into v_p from public.household_polls where id = p_poll_id;
  if not found then raise exception 'Poll not found'; end if;
  if v_p.status <> 'open' then raise exception 'Poll is closed'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  delete from public.household_poll_votes
  where poll_id = p_poll_id and membership_id = v_actor;
end;
$$;

create or replace function public.publish_poll_results(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Closing publishes aggregate results; anonymity remains enforced by SELECT policies.
  perform public.close_poll(p_poll_id);
end;
$$;

revoke all on function public.create_poll(uuid, text, text[], boolean, boolean, timestamptz) from public;
revoke all on function public.update_poll(uuid, text, timestamptz, boolean) from public;
revoke all on function public.add_poll_option(uuid, text) from public;
revoke all on function public.open_poll(uuid) from public;
revoke all on function public.close_poll(uuid) from public;
revoke all on function public.cast_poll_vote(uuid, uuid[]) from public;
revoke all on function public.remove_poll_vote(uuid) from public;
revoke all on function public.publish_poll_results(uuid) from public;

grant execute on function public.create_poll(uuid, text, text[], boolean, boolean, timestamptz) to authenticated;
grant execute on function public.update_poll(uuid, text, timestamptz, boolean) to authenticated;
grant execute on function public.add_poll_option(uuid, text) to authenticated;
grant execute on function public.open_poll(uuid) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;
grant execute on function public.cast_poll_vote(uuid, uuid[]) to authenticated;
grant execute on function public.remove_poll_vote(uuid) to authenticated;
grant execute on function public.publish_poll_results(uuid) to authenticated;
