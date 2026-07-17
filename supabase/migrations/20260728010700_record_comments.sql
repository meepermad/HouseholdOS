-- Contextual record comments (not household chat)
-- Mutations require: can view parent AND can comment on parent AND same household.

create table public.record_comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  parent_type text not null check (parent_type in (
    'expense','payment_dispute','chore','maintenance_request','poll',
    'governance_document','meal_request','shopping_list'
  )),
  parent_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  author_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  mentioned_membership_ids uuid[] not null default '{}',
  edited_at timestamptz,
  edit_window_ends_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create index record_comments_parent_idx
  on public.record_comments(household_id, parent_type, parent_id, created_at);

create trigger record_comments_set_updated_at
  before update on public.record_comments
  for each row execute function public.set_updated_at();

create or replace function public.can_view_comment_parent(
  p_household_id uuid,
  p_parent_type text,
  p_parent_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_member(p_household_id) then
    return false;
  end if;

  case p_parent_type
    when 'expense' then
      return exists (
        select 1 from public.expenses e
        where e.id = p_parent_id
          and e.household_id = p_household_id
          and public.can_view_expense(e.id)
      );
    when 'payment_dispute' then
      return exists (
        select 1 from public.reimbursement_disputes d
        where d.id = p_parent_id
          and d.household_id = p_household_id
          and public.is_active_member(d.household_id)
      );
    when 'chore' then
      return (
        public.can_view_chore_occurrence(p_parent_id)
        or public.can_view_chore_definition(p_parent_id)
      )
      and (
        exists (
          select 1 from public.chore_occurrences o
          where o.id = p_parent_id and o.household_id = p_household_id
        )
        or exists (
          select 1 from public.chore_definitions d
          where d.id = p_parent_id and d.household_id = p_household_id
        )
      );
    when 'maintenance_request' then
      return exists (
        select 1 from public.maintenance_requests m
        where m.id = p_parent_id
          and m.household_id = p_household_id
          and public.can_view_maintenance_request(m.id)
      );
    when 'poll' then
      return exists (
        select 1 from public.household_polls p
        where p.id = p_parent_id
          and p.household_id = p_household_id
          and public.is_active_member(p.household_id)
      );
    when 'governance_document' then
      return exists (
        select 1 from public.governance_documents g
        where g.id = p_parent_id
          and g.household_id = p_household_id
          and public.can_view_governance_document(g.id)
      );
    when 'meal_request' then
      return exists (
        select 1 from public.meal_requests m
        where m.id = p_parent_id
          and m.household_id = p_household_id
          and public.is_active_member(m.household_id)
      );
    when 'shopping_list' then
      return exists (
        select 1 from public.shopping_lists s
        where s.id = p_parent_id
          and s.household_id = p_household_id
          and public.is_active_member(s.household_id)
      );
    else
      return false;
  end case;
end;
$$;

-- Comment permission matches parent visibility for v1 (active members who can view).
create or replace function public.can_comment_on_parent(
  p_household_id uuid,
  p_parent_type text,
  p_parent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_comment_parent(p_household_id, p_parent_type, p_parent_id);
$$;

revoke all on function public.can_view_comment_parent(uuid, text, uuid) from public, anon;
revoke all on function public.can_comment_on_parent(uuid, text, uuid) from public, anon;
grant execute on function public.can_view_comment_parent(uuid, text, uuid) to authenticated;
grant execute on function public.can_comment_on_parent(uuid, text, uuid) to authenticated;

alter table public.record_comments enable row level security;

create policy record_comments_select on public.record_comments
  for select to authenticated
  using (
    deleted_at is null
    and public.can_view_comment_parent(household_id, parent_type, parent_id)
  );

create policy record_comments_no_direct_write on public.record_comments
  for all to authenticated
  using (false)
  with check (false);

create or replace function public.add_record_comment(
  p_household_id uuid,
  p_parent_type text,
  p_parent_id uuid,
  p_body text,
  p_mentioned_membership_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_id uuid;
  v_mentions uuid[] := '{}';
  v_mid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  if not public.can_view_comment_parent(p_household_id, p_parent_type, p_parent_id) then
    raise exception 'Parent record is not visible or does not belong to this household';
  end if;
  if not public.can_comment_on_parent(p_household_id, p_parent_type, p_parent_id) then
    raise exception 'Not authorized to comment on this parent';
  end if;
  v_membership_id := public.current_membership_id(p_household_id);

  -- Mentions limited to active household members
  if p_mentioned_membership_ids is not null then
    foreach v_mid in array p_mentioned_membership_ids
    loop
      if exists (
        select 1 from public.household_memberships m
        where m.id = v_mid and m.household_id = p_household_id and m.status = 'active'
      ) then
        v_mentions := array_append(v_mentions, v_mid);
      end if;
    end loop;
  end if;

  insert into public.record_comments (
    household_id, parent_type, parent_id, body, author_membership_id,
    mentioned_membership_ids, edit_window_ends_at
  ) values (
    p_household_id, p_parent_type, p_parent_id, trim(p_body), v_membership_id,
    v_mentions, now() + interval '15 minutes'
  ) returning id into v_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'record_comment', v_id, 'comment.added',
    jsonb_build_object('parent_type', p_parent_type, 'parent_id', p_parent_id)
  );

  return v_id;
end;
$$;

create or replace function public.edit_record_comment(
  p_comment_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.record_comments%rowtype;
  v_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.record_comments where id = p_comment_id for update;
  if not found or v_row.deleted_at is not null then
    raise exception 'Comment not found';
  end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if not public.can_view_comment_parent(v_row.household_id, v_row.parent_type, v_row.parent_id) then
    raise exception 'Parent record is not visible';
  end if;
  v_membership_id := public.current_membership_id(v_row.household_id);
  if v_row.author_membership_id <> v_membership_id then
    raise exception 'Only the author can edit this comment';
  end if;
  if now() > v_row.edit_window_ends_at then
    raise exception 'Edit window has expired';
  end if;

  update public.record_comments
  set body = trim(p_body), edited_at = now(), updated_at = now()
  where id = p_comment_id;
end;
$$;

create or replace function public.soft_delete_record_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.record_comments%rowtype;
  v_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.record_comments where id = p_comment_id for update;
  if not found then raise exception 'Comment not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if not public.can_view_comment_parent(v_row.household_id, v_row.parent_type, v_row.parent_id) then
    raise exception 'Parent record is not visible';
  end if;
  v_membership_id := public.current_membership_id(v_row.household_id);
  if v_row.author_membership_id <> v_membership_id
     and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Not allowed to delete this comment';
  end if;

  update public.record_comments
  set deleted_at = now(), updated_at = now()
  where id = p_comment_id;
end;
$$;

revoke all on function public.add_record_comment(uuid, text, uuid, text, uuid[]) from public;
revoke all on function public.edit_record_comment(uuid, text) from public;
revoke all on function public.soft_delete_record_comment(uuid) from public;

grant execute on function public.add_record_comment(uuid, text, uuid, text, uuid[]) to authenticated;
grant execute on function public.edit_record_comment(uuid, text) to authenticated;
grant execute on function public.soft_delete_record_comment(uuid) to authenticated;
