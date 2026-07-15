-- Allow service-role cleanup (auth.uid() null) and expense RPCs that set payment_mutation

create or replace function public.enforce_payment_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.payment_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Payment settlement records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_obligation_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.expense_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.payment_mutation', true) is distinct from 'rpc' then
    raise exception 'Reimbursement obligations may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;
