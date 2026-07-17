-- Phase 8: templates seed + calendar link helpers

insert into public.governance_templates (
  household_id, template_key, document_class, title, summary, sections,
  approval_rules, acknowledgment_rules, is_system, active
) values
(
  null, 'roommate_agreement', 'household_agreement',
  'General roommate agreement',
  'Starter household agreement for shared expectations. HouseholdOS facilitates household coordination and recordkeeping rather than providing legal advice.',
  '[
    {"section_type":"heading","heading":"Purpose","body":"This household agreement records shared expectations among current members.","payload":{}},
    {"section_type":"rule","heading":"Shared spaces","body":"Common areas should be left reasonably clean after use.","payload":{}},
    {"section_type":"acknowledgment_clause","heading":"Acknowledgment","body":"By acknowledging, members confirm they have read this household agreement. This is not presented as a legally binding signature unless the household separately chooses an approval workflow.","payload":{}}
  ]'::jsonb,
  '{"mode":"unanimous","quorum":1}'::jsonb,
  '{"required":true,"scope":"all_active","deadline_hours":168}'::jsonb,
  true, true
),
(
  null, 'shared_expense_policy', 'financial_policy',
  'Shared expense policy',
  'Records how the household discusses shared purchases and reimbursements. Not legal advice; does not alter confirmed expenses automatically.',
  '[
    {"section_type":"financial_threshold","heading":"Purchase discussion threshold","body":"Purchases above the listed threshold should be discussed before buying when practical.","payload":{"threshold_cents":5000}},
    {"section_type":"rule","heading":"Reimbursement expectations","body":"Members should record shared expenses promptly in Money and confirm allocations intentionally.","payload":{}},
    {"section_type":"explanatory_text","heading":"Important","body":"Approved policies may warn about new expenses but must not retroactively change confirmed payments or settlements.","payload":{}}
  ]'::jsonb,
  '{"mode":"financial_coordinator","quorum":1}'::jsonb,
  '{"required":true,"scope":"all_active"}'::jsonb,
  true, true
),
(
  null, 'guest_overnight_policy', 'guest_policy',
  'Guest and overnight visitor policy',
  'Household coordination template for guests. Not a lease substitute and not legal advice.',
  '[
    {"section_type":"rule","heading":"Advance notice","body":"Members should give reasonable notice before overnight guests when practical.","payload":{}},
    {"section_type":"rule","heading":"Common areas","body":"Guests should not block shared spaces or supplies without agreement.","payload":{}}
  ]'::jsonb,
  '{"mode":"simple_majority","quorum":2}'::jsonb,
  '{"required":true,"scope":"all_active"}'::jsonb,
  true, true
),
(
  null, 'cleaning_chore_expectations', 'cleaning_expectations',
  'Cleaning and chore expectations',
  'Describes chore expectations. Does not silently create chore assignments.',
  '[
    {"section_type":"checklist","heading":"Weekly shared cleaning","body":"Kitchen surfaces, trash, and bathroom basics.","payload":{"items":["Kitchen wipe-down","Trash/recycling","Bathroom basics"]}},
    {"section_type":"responsibility","heading":"Rotation","body":"Use the Chores board for assignments after explicit confirmation.","payload":{}}
  ]'::jsonb,
  '{"mode":"unanimous","quorum":1}'::jsonb,
  '{"required":false}'::jsonb,
  true, true
),
(
  null, 'shared_grocery_meal_policy', 'meal_grocery_expectations',
  'Shared grocery and meal policy',
  'Household meal and grocery expectations. Coordination aid only — not legal advice.',
  '[
    {"section_type":"rule","heading":"Shared staples","body":"Agree which staples are household-shared versus personal.","payload":{}},
    {"section_type":"rule","heading":"Meal plans","body":"Optional shared meals should be planned in Meals with clear participation.","payload":{}}
  ]'::jsonb,
  '{"mode":"simple_majority","quorum":1}'::jsonb,
  '{"required":false}'::jsonb,
  true, true
),
(
  null, 'quiet_hours', 'house_rules',
  'Quiet hours',
  'Household quiet-hours expectations for coordination and recordkeeping.',
  '[
    {"section_type":"date_requirement","heading":"Quiet hours window","body":"Example: 11:00 PM – 7:00 AM on weeknights unless the household agrees otherwise.","payload":{}},
    {"section_type":"rule","heading":"Exceptions","body":"Discuss exceptions in advance when possible.","payload":{}}
  ]'::jsonb,
  '{"mode":"unanimous","quorum":1}'::jsonb,
  '{"required":true,"scope":"all_active"}'::jsonb,
  true, true
),
(
  null, 'shared_item_purchasing', 'shared_item_policy',
  'Shared-item purchasing policy',
  'Ownership and purchasing expectations for shared property. Inventory changes still require confirmation in Inventory.',
  '[
    {"section_type":"rule","heading":"Before buying shared items","body":"Discuss intended shared ownership and cost splitting first.","payload":{}},
    {"section_type":"financial_threshold","heading":"Discussion threshold","body":"Items above this amount should be discussed.","payload":{"threshold_cents":7500}}
  ]'::jsonb,
  '{"mode":"simple_majority","quorum":1}'::jsonb,
  '{"required":false}'::jsonb,
  true, true
),
(
  null, 'maintenance_reporting', 'house_rules',
  'Maintenance reporting expectations',
  'How the household reports and tracks maintenance. Safety emergencies may require contacting appropriate services outside HouseholdOS.',
  '[
    {"section_type":"rule","heading":"Report early","body":"Log issues in Maintenance with photos when safe to do so.","payload":{}},
    {"section_type":"explanatory_text","heading":"Safety note","body":"HouseholdOS does not contact emergency services, landlords, or vendors for you.","payload":{}}
  ]'::jsonb,
  '{"mode":"coordinator","quorum":1}'::jsonb,
  '{"required":false}'::jsonb,
  true, true
),
(
  null, 'move_in_checklist', 'move_in_agreement',
  'Move-in checklist',
  'Coordination checklist for joining the household. Does not create financial obligations automatically.',
  '[
    {"section_type":"checklist","heading":"Move-in steps","body":"Review agreements, room assignment, keys/access, utilities discussion, emergency contact (private).","payload":{}},
    {"section_type":"explanatory_text","heading":"Money note","body":"Any deposit or recurring share must be confirmed explicitly in the financial domain.","payload":{}}
  ]'::jsonb,
  '{"mode":"coordinator","quorum":1}'::jsonb,
  '{"required":true,"scope":"selected"}'::jsonb,
  true, true
),
(
  null, 'move_out_checklist', 'move_out_agreement',
  'Move-out checklist',
  'Coordination checklist for leaving the household. Creating a move-out workflow does not remove membership or authorize deposit deductions.',
  '[
    {"section_type":"checklist","heading":"Move-out steps","body":"Notice date, cleaning, keys, inventory return discussion, expense review, forwarding info (private).","payload":{}},
    {"section_type":"explanatory_text","heading":"Boundaries","body":"HouseholdOS organizes discussion and records. It does not authorize eviction, lock changes, or withholding essential services.","payload":{}}
  ]'::jsonb,
  '{"mode":"coordinator","quorum":1}'::jsonb,
  '{"required":true,"scope":"selected"}'::jsonb,
  true, true
),
(
  null, 'security_deposit_damage_review', 'financial_policy',
  'Security deposit and damage review',
  'Discussion record for deposits and damage. HouseholdOS does not declare a deposit deduction legally valid.',
  '[
    {"section_type":"explanatory_text","heading":"Important boundary","body":"Use this document to organize evidence and household decisions. Confirm any money movement explicitly in Money.","payload":{}},
    {"section_type":"rule","heading":"Evidence","body":"Link maintenance photos and inventory notes; do not treat opening this document as approval of a deduction.","payload":{}}
  ]'::jsonb,
  '{"mode":"mixed","quorum":2}'::jsonb,
  '{"required":true,"scope":"selected"}'::jsonb,
  true, true
)
on conflict (template_key) where household_id is null do nothing;

create or replace function public.link_governance_calendar_event(
  p_household_id uuid,
  p_calendar_event_id uuid,
  p_link_kind text,
  p_document_id uuid default null,
  p_version_id uuid default null,
  p_transition_workflow_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  v_actor := public._governance_active_membership(p_household_id);
  if p_document_id is null and p_transition_workflow_id is null then
    raise exception 'Calendar link requires a document or transition workflow';
  end if;
  if p_document_id is not null and not public.can_manage_governance_document(p_document_id) then
    raise exception 'Not allowed to link calendar for this document';
  end if;
  if p_transition_workflow_id is not null
     and not public.can_manage_transition_workflow(p_transition_workflow_id) then
    raise exception 'Not allowed to link calendar for this transition';
  end if;

  insert into public.governance_calendar_links(
    document_id, version_id, transition_workflow_id, household_id,
    calendar_event_id, link_kind
  ) values (
    p_document_id, p_version_id, p_transition_workflow_id, p_household_id,
    p_calendar_event_id, p_link_kind
  )
  on conflict (calendar_event_id) do update set
    link_kind = excluded.link_kind,
    document_id = coalesce(excluded.document_id, governance_calendar_links.document_id),
    transition_workflow_id = coalesce(excluded.transition_workflow_id, governance_calendar_links.transition_workflow_id)
  returning id into v_id;

  perform public._governance_audit(
    p_household_id, 'governance_calendar_link', v_id, 'governance.calendar_linked',
    null, jsonb_build_object('calendar_event_id', p_calendar_event_id, 'actor', v_actor)
  );
  return v_id;
end $$;

create or replace function public.link_transition_inventory_item(
  p_workflow_id uuid,
  p_inventory_item_id uuid,
  p_link_kind text,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wf public.household_transition_workflows%rowtype;
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_wf from public.household_transition_workflows where id = p_workflow_id;
  if not found then raise exception 'Transition not found'; end if;
  v_actor := public._governance_active_membership(v_wf.household_id);
  if not public.can_manage_transition_workflow(p_workflow_id) then
    raise exception 'Not allowed to link inventory for this transition';
  end if;
  insert into public.household_transition_inventory_links(
    workflow_id, household_id, inventory_item_id, link_kind, note, created_by_membership_id
  ) values (
    p_workflow_id, v_wf.household_id, p_inventory_item_id, p_link_kind,
    nullif(trim(coalesce(p_note,'')),''), v_actor
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.link_transition_maintenance_request(
  p_workflow_id uuid,
  p_maintenance_request_id uuid,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wf public.household_transition_workflows%rowtype;
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_wf from public.household_transition_workflows where id = p_workflow_id;
  if not found then raise exception 'Transition not found'; end if;
  v_actor := public._governance_active_membership(v_wf.household_id);
  if not public.can_manage_transition_workflow(p_workflow_id) then
    raise exception 'Not allowed to link maintenance for this transition';
  end if;
  insert into public.household_transition_maintenance_links(
    workflow_id, household_id, maintenance_request_id, note, created_by_membership_id
  ) values (
    p_workflow_id, v_wf.household_id, p_maintenance_request_id,
    nullif(trim(coalesce(p_note,'')),''), v_actor
  )
  on conflict (workflow_id, maintenance_request_id) do update
    set note = coalesce(excluded.note, household_transition_maintenance_links.note)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.link_governance_calendar_event(uuid,uuid,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.link_transition_inventory_item(uuid,uuid,text,text) to authenticated;
grant execute on function public.link_transition_maintenance_request(uuid,uuid,text) to authenticated;
