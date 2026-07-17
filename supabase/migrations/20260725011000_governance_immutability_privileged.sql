-- Allow privileged test cleanup to remove immutable governance versions/sections

create or replace function public.enforce_governance_version_immutability()
returns trigger language plpgsql as $$
begin
  if current_setting('householdos.privileged_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and old.status in ('approved','active','superseded') then
    if new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.plain_text is distinct from old.plain_text
       or new.content_hash is distinct from old.content_hash
       or new.approval_rules is distinct from old.approval_rules
       or new.acknowledgment_rules is distinct from old.acknowledgment_rules
       or new.activation_mode is distinct from old.activation_mode then
      raise exception 'Approved or active governance versions are immutable; create a new version';
    end if;
  end if;
  if tg_op = 'DELETE' and old.status in ('approved','active','superseded') then
    raise exception 'Cannot delete approved or active governance versions';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.enforce_governance_section_immutability()
returns trigger language plpgsql as $$
declare v_status text;
begin
  if current_setting('householdos.privileged_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  select status into v_status from public.governance_document_versions
  where id = coalesce(new.version_id, old.version_id);
  if v_status in ('approved','active','superseded') then
    raise exception 'Cannot modify sections of an approved or active governance version';
  end if;
  return coalesce(new, old);
end $$;
