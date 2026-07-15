-- Fix upsert_push_subscription endpoint hashing for Supabase pgcrypto (extensions.digest).
-- digest(text, unknown) is not resolvable; cast to bytea explicitly.

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent_summary text default null,
  p_device_label text default null,
  p_platform_category text default null,
  p_installation_id text default null,
  p_expiration_time timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_endpoint is null or char_length(trim(p_endpoint)) < 8 then
    raise exception 'Invalid push endpoint';
  end if;
  if p_p256dh is null or char_length(trim(p_p256dh)) < 8 then
    raise exception 'Invalid push p256dh';
  end if;
  if p_auth is null or char_length(trim(p_auth)) < 8 then
    raise exception 'Invalid push auth';
  end if;

  v_hash := encode(digest(convert_to(trim(p_endpoint), 'UTF8'), 'sha256'), 'hex');

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    endpoint_hash,
    p256dh,
    auth,
    user_agent_summary,
    device_label,
    platform_category,
    installation_id,
    expiration_time,
    active,
    disabled_reason,
    failure_count,
    updated_at
  ) values (
    v_uid,
    trim(p_endpoint),
    v_hash,
    trim(p_p256dh),
    trim(p_auth),
    nullif(trim(coalesce(p_user_agent_summary, '')), ''),
    nullif(trim(coalesce(p_device_label, '')), ''),
    nullif(trim(coalesce(p_platform_category, '')), ''),
    nullif(trim(coalesce(p_installation_id, '')), ''),
    p_expiration_time,
    true,
    null,
    0,
    now()
  )
  on conflict (endpoint_hash) do update
    set
      user_id = excluded.user_id,
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent_summary = coalesce(excluded.user_agent_summary, public.push_subscriptions.user_agent_summary),
      device_label = coalesce(excluded.device_label, public.push_subscriptions.device_label),
      platform_category = coalesce(excluded.platform_category, public.push_subscriptions.platform_category),
      installation_id = coalesce(excluded.installation_id, public.push_subscriptions.installation_id),
      expiration_time = excluded.expiration_time,
      active = true,
      disabled_reason = null,
      failure_count = 0,
      updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text, text, text, text, timestamptz) from public;
grant execute on function public.upsert_push_subscription(text, text, text, text, text, text, text, timestamptz) to authenticated;
