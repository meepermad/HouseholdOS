-- Import / export RPCs

create or replace function public.create_import_batch(
  p_household_id uuid,
  p_domain text,
  p_file_name text,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_membership_id := public.current_membership_id(p_household_id);

  if p_idempotency_key is not null then
    select id into v_id from public.household_import_batches
    where household_id = p_household_id and idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  insert into public.household_import_batches (
    household_id, domain, file_name, created_by_membership_id, idempotency_key, status
  ) values (
    p_household_id, p_domain, p_file_name, v_membership_id, p_idempotency_key, 'uploaded'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.save_import_mapping(
  p_batch_id uuid,
  p_column_map jsonb,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.household_import_batches%rowtype;
  v_row jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_batch from public.household_import_batches where id = p_batch_id for update;
  if not found then raise exception 'Import batch not found'; end if;
  if not public.is_active_member(v_batch.household_id) then
    raise exception 'Not an active household member';
  end if;

  update public.household_import_batches
  set column_map = coalesce(p_column_map, '{}'::jsonb),
      status = 'mapped',
      row_count = jsonb_array_length(coalesce(p_rows, '[]'::jsonb)),
      updated_at = now()
  where id = p_batch_id;

  delete from public.household_import_rows where batch_id = p_batch_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    insert into public.household_import_rows (
      batch_id, household_id, row_number, raw, mapped, status, messages
    ) values (
      p_batch_id, v_batch.household_id,
      coalesce((v_row->>'rowNumber')::int, 0),
      coalesce(v_row->'raw', '{}'::jsonb),
      coalesce(v_row->'mapped', '{}'::jsonb),
      coalesce(v_row->>'status', 'pending'),
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'messages', '[]'::jsonb)) as x),
        '{}'::text[]
      )
    );
  end loop;
end;
$$;

create or replace function public.mark_import_batch_status(
  p_batch_id uuid,
  p_status text,
  p_result_summary jsonb default null,
  p_error_summary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select household_id into v_household_id from public.household_import_batches where id = p_batch_id;
  if not found then raise exception 'Import batch not found'; end if;
  if not public.is_active_member(v_household_id) then
    raise exception 'Not an active household member';
  end if;

  update public.household_import_batches
  set status = p_status,
      result_summary = coalesce(p_result_summary, result_summary),
      error_summary = coalesce(p_error_summary, error_summary),
      completed_at = case when p_status in ('completed','failed','cancelled') then now() else completed_at end,
      updated_at = now()
  where id = p_batch_id;
end;
$$;

create or replace function public.request_household_export(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  if not public.is_household_coordinator(p_household_id) then
    raise exception 'Only coordinators can export household data';
  end if;
  v_membership_id := public.current_membership_id(p_household_id);

  insert into public.household_export_jobs (
    household_id, requested_by_membership_id, status
  ) values (
    p_household_id, v_membership_id, 'queued'
  ) returning id into v_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'household_export', v_id, 'export.requested',
    jsonb_build_object('status', 'queued')
  );

  return v_id;
end;
$$;

create or replace function public.claim_export_jobs(
  p_batch_size int default 5,
  p_worker_id uuid default gen_random_uuid()
)
returns setof public.household_export_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_batch_size, 5), 20));
begin
  return query
  with picked as (
    select j.id from public.household_export_jobs j
    where j.status = 'queued'
    order by j.created_at
    for update of j skip locked
    limit v_limit
  )
  update public.household_export_jobs j
  set status = 'running', updated_at = now()
  from picked where j.id = picked.id
  returning j.*;
end;
$$;

create or replace function public.complete_export_job(
  p_job_id uuid,
  p_storage_path text,
  p_expires_at timestamptz,
  p_result_meta jsonb default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error is not null then
    update public.household_export_jobs
    set status = 'failed', error_text = p_error, completed_at = now(), updated_at = now()
    where id = p_job_id;
    return;
  end if;

  update public.household_export_jobs
  set status = 'succeeded',
      storage_path = p_storage_path,
      expires_at = p_expires_at,
      result_meta = p_result_meta,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  )
  select household_id, null, 'household_export', id, 'export.completed',
    jsonb_build_object('storage_path_present', p_storage_path is not null)
  from public.household_export_jobs where id = p_job_id;
end;
$$;

revoke all on function public.create_import_batch(uuid, text, text, text) from public;
revoke all on function public.save_import_mapping(uuid, jsonb, jsonb) from public;
revoke all on function public.mark_import_batch_status(uuid, text, jsonb, text) from public;
revoke all on function public.request_household_export(uuid) from public;
revoke all on function public.claim_export_jobs(int, uuid) from public;
revoke all on function public.complete_export_job(uuid, text, timestamptz, jsonb, text) from public;

grant execute on function public.create_import_batch(uuid, text, text, text) to authenticated;
grant execute on function public.save_import_mapping(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.mark_import_batch_status(uuid, text, jsonb, text) to authenticated;
grant execute on function public.request_household_export(uuid) to authenticated;
grant execute on function public.claim_export_jobs(int, uuid) to service_role;
grant execute on function public.complete_export_job(uuid, text, timestamptz, jsonb, text) to service_role;
