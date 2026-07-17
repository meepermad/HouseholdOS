-- Phase 6.5: notification category mapping for meal/recipe events

create or replace function public._notification_meta_for_event_type(p_event_type text)
returns table (
  category text,
  urgency text,
  action_oriented boolean
)
language sql
immutable
as $$
  select
    case
      when p_event_type like 'dispute.%' then 'disputes'
      when p_event_type like 'payment.%'
        or p_event_type like 'waiver.%'
        or p_event_type like 'refund_obligation.%'
        or p_event_type like 'expense.%' then 'payments'
      when p_event_type like 'membership.%' then 'membership'
      when p_event_type like 'chore.%' then 'chores'
      when p_event_type like 'calendar.%' then 'calendar'
      when p_event_type like 'inventory.%'
        or p_event_type like 'pantry.%'
        or p_event_type like 'shopping.%'
        or p_event_type like 'house.%' then 'house'
      when p_event_type like 'recipe.%'
        or p_event_type like 'meal.%'
        or p_event_type like 'meal_prep.%'
        or p_event_type like 'meal_batch.%' then 'meals'
      when p_event_type like 'system.%' then 'system'
      else 'system'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'payment.reversed',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'meal.cancelled',
        'meal.shopping_needed'
      ) then 'high'
      when p_event_type like 'system.%urgent%' then 'urgent'
      else 'normal'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'waiver.created',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'expense.amended',
        'meal.rsvp_requested',
        'meal.shopping_needed',
        'meal.cleanup_assigned'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;
