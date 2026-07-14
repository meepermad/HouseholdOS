-- Allow service-role / maintenance sessions (auth.uid() null) to manage financial rows for cleanup.

create or replace function public.enforce_expense_immutability()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('confirmed', 'amended', 'voided') then
      raise exception 'Confirmed financial records cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('confirmed', 'amended', 'voided') then
    if current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
      raise exception 'Confirmed expenses are immutable; use amendment or void workflows';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('draft', 'ready_for_review')
     and new.status in ('confirmed', 'amended', 'voided')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Expense confirmation must use confirm_expense RPC';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_draft_child_mutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_expense_id uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  v_expense_id := coalesce(new.expense_id, old.expense_id);
  select e.status into v_status from public.expenses e where e.id = v_expense_id;
  if v_status is null then
    return coalesce(new, old);
  end if;
  if v_status not in ('draft', 'ready_for_review')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Cannot modify items on a confirmed expense';
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
  if current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Reimbursement obligations may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;
