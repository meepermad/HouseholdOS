-- Launch phase: optional household setup progress (never forced on existing households)

create table public.household_setup_progress (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  steps jsonb not null default '{}'::jsonb,
  current_step text,
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id)
);

create trigger household_setup_progress_set_updated_at
  before update on public.household_setup_progress
  for each row execute function public.set_updated_at();

alter table public.household_setup_progress enable row level security;

create policy household_setup_progress_select
  on public.household_setup_progress
  for select to authenticated
  using (public.is_active_member(household_id));

-- Mutations via SECURITY DEFINER RPCs only
create policy household_setup_progress_no_direct_write
  on public.household_setup_progress
  for all to authenticated
  using (false)
  with check (false);

create or replace function public.ensure_household_setup_progress(p_household_id uuid)
returns public.household_setup_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_setup_progress;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;

  select * into v_row
  from public.household_setup_progress
  where household_id = p_household_id;

  if not found then
    insert into public.household_setup_progress (household_id, current_step)
    values (p_household_id, 'basics')
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.update_household_setup_step(
  p_household_id uuid,
  p_step text,
  p_status text,
  p_draft jsonb default null
)
returns public.household_setup_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_setup_progress;
  v_steps jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  if p_status not in ('pending', 'skipped', 'completed') then
    raise exception 'Invalid setup step status';
  end if;
  if p_step is null or char_length(trim(p_step)) = 0 then
    raise exception 'Step is required';
  end if;

  v_row := public.ensure_household_setup_progress(p_household_id);
  v_steps := coalesce(v_row.steps, '{}'::jsonb);
  v_steps := jsonb_set(
    v_steps,
    array[p_step],
    jsonb_build_object(
      'status', p_status,
      'updatedAt', to_jsonb(now()::text),
      'draft', coalesce(p_draft, 'null'::jsonb)
    ),
    true
  );

  update public.household_setup_progress
  set steps = v_steps,
      current_step = p_step,
      updated_at = now()
  where household_id = p_household_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.dismiss_household_setup(p_household_id uuid)
returns public.household_setup_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_setup_progress;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_row := public.ensure_household_setup_progress(p_household_id);
  update public.household_setup_progress
  set dismissed_at = now(), updated_at = now()
  where household_id = p_household_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.complete_household_setup(p_household_id uuid)
returns public.household_setup_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_setup_progress;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_row := public.ensure_household_setup_progress(p_household_id);
  update public.household_setup_progress
  set completed_at = now(),
      current_step = 'review',
      updated_at = now()
  where household_id = p_household_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.ensure_household_setup_progress(uuid) from public;
revoke all on function public.update_household_setup_step(uuid, text, text, jsonb) from public;
revoke all on function public.dismiss_household_setup(uuid) from public;
revoke all on function public.complete_household_setup(uuid) from public;

grant execute on function public.ensure_household_setup_progress(uuid) to authenticated;
grant execute on function public.update_household_setup_step(uuid, text, text, jsonb) to authenticated;
grant execute on function public.dismiss_household_setup(uuid) to authenticated;
grant execute on function public.complete_household_setup(uuid) to authenticated;
