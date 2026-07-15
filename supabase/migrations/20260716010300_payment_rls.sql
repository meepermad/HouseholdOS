-- Phase 3: RLS for payments, waivers, disputes, notifications

alter table public.payments enable row level security;
alter table public.payment_private_details enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_reversals enable row level security;
alter table public.reimbursement_waivers enable row level security;
alter table public.reimbursement_waiver_reversals enable row level security;
alter table public.reimbursement_disputes enable row level security;
alter table public.dispute_events enable row level security;
alter table public.notification_events enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_deliveries enable row level security;

-- payments: active members see public payment fields
create policy payments_select
  on public.payments for select
  to authenticated
  using (public.is_active_member(household_id));

-- No direct insert/update/delete policies (RPC-only via trigger)

-- private details: sender or recipient membership only
create policy payment_private_details_select
  on public.payment_private_details for select
  to authenticated
  using (
    exists (
      select 1
      from public.payments p
      where p.id = payment_private_details.payment_id
        and public.is_active_member(p.household_id)
        and (
          p.sender_membership_id = public.current_membership_id(p.household_id)
          or p.recipient_membership_id = public.current_membership_id(p.household_id)
        )
    )
  );

create policy payment_allocations_select
  on public.payment_allocations for select
  to authenticated
  using (public.is_active_member(household_id));

create policy payment_reversals_select
  on public.payment_reversals for select
  to authenticated
  using (public.is_active_member(household_id));

create policy reimbursement_waivers_select
  on public.reimbursement_waivers for select
  to authenticated
  using (public.is_active_member(household_id));

create policy reimbursement_waiver_reversals_select
  on public.reimbursement_waiver_reversals for select
  to authenticated
  using (public.is_active_member(household_id));

create policy reimbursement_disputes_select
  on public.reimbursement_disputes for select
  to authenticated
  using (public.is_active_member(household_id));

create policy dispute_events_select
  on public.dispute_events for select
  to authenticated
  using (public.is_active_member(household_id));

-- Notification events: active household members (payload never includes private refs)
create policy notification_events_select
  on public.notification_events for select
  to authenticated
  using (
    household_id is not null
    and public.is_active_member(household_id)
  );

-- User notifications: owner only
create policy user_notifications_select
  on public.user_notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy user_notifications_update
  on public.user_notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deliveries: owner may see own delivery status (Phase 3.1 readiness)
create policy notification_deliveries_select
  on public.notification_deliveries for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.payments to authenticated;
grant select on public.payment_private_details to authenticated;
grant select on public.payment_allocations to authenticated;
grant select on public.payment_reversals to authenticated;
grant select on public.reimbursement_waivers to authenticated;
grant select on public.reimbursement_waiver_reversals to authenticated;
grant select on public.reimbursement_disputes to authenticated;
grant select on public.dispute_events to authenticated;
grant select on public.notification_events to authenticated;
grant select, update on public.user_notifications to authenticated;
grant select on public.notification_deliveries to authenticated;
