-- Boolean invite check for registration (mirrors Auth hook match rules).
-- Returns only true/false — no household or email leakage beyond the boolean.

create or replace function public.has_pending_household_invitation(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;

  return exists (
    select 1
    from public.household_invitations i
    where lower(i.invited_email) = v_email
      and i.status = 'pending'
      and i.expires_at > now()
  );
end;
$$;

revoke all on function public.has_pending_household_invitation(text) from public;
grant execute on function public.has_pending_household_invitation(text) to anon, authenticated;

comment on function public.has_pending_household_invitation(text) is
  'True when a pending non-expired household invitation exists for the email. Used by app registration policy; same match rules as hook_before_user_created.';
