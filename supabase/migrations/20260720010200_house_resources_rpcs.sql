-- Phase 6: secure house resource RPCs — locations, inventory, supplies,
-- pantry, shopping lists, and expense links.
-- Note: create_shopping_item's parameters are ordered household_id,name,list_id,...
-- (not list_id first) because Postgres requires all parameters after the first
-- one with a default value to also have defaults.

create or replace function public._resource_assert_member(p_household_id uuid, p_membership_id uuid)
returns void language plpgsql stable security definer set search_path=public as $$
begin
  if not exists (select 1 from public.household_memberships where id=p_membership_id and household_id=p_household_id and status='active')
  then raise exception 'Membership is not active in this household'; end if;
end $$;
revoke all on function public._resource_assert_member(uuid,uuid) from public,anon;

create or replace function public._resource_audit(p_household_id uuid,p_entity_type text,p_entity_id uuid,p_event_type text,p_before jsonb default null,p_after jsonb default null,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_events(household_id,actor_user_id,entity_type,entity_id,event_type,before_state,after_state,reason,correlation_id)
  values(p_household_id,auth.uid(),p_entity_type,p_entity_id,p_event_type,p_before,p_after,p_reason,gen_random_uuid());
end $$;
revoke all on function public._resource_audit(uuid,text,uuid,text,jsonb,jsonb,text) from public,anon;

create or replace function public._resource_notify(p_household_id uuid,p_event_type text,p_entity_type text,p_entity_id uuid,p_actor_membership_id uuid,p_memberships uuid[],p_title text,p_body text,p_action_href text)
returns void language plpgsql security definer set search_path=public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id=any(coalesce(p_memberships,'{}'::uuid[])) and m.status='active' and m.user_id<>auth.uid();
  if cardinality(coalesce(v_users,'{}'::uuid[]))>0 then
    perform public._emit_notification_event(p_household_id,p_event_type,p_entity_type,p_entity_id,p_actor_membership_id,'{}'::jsonb,
      p_event_type||':'||p_entity_id::text||':'||extract(epoch from clock_timestamp())::bigint::text,v_users,p_title,p_body,p_action_href);
  end if;
end $$;
revoke all on function public._resource_notify(uuid,text,text,uuid,uuid,uuid[],text,text,text) from public,anon;

-- Shared ownership validation for inventory/supply/pantry create+ownership-change RPCs.
create or replace function public._resource_validate_ownership(p_household_id uuid,p_ownership_mode text,p_owner_membership_id uuid,p_shared_membership_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare v_mid uuid;
begin
  if p_ownership_mode in ('household','unknown') then
    if p_owner_membership_id is not null then raise exception '% ownership must not set a personal owner',p_ownership_mode; end if;
    if cardinality(coalesce(p_shared_membership_ids,'{}'::uuid[]))>0 then raise exception '% ownership must not list shared members',p_ownership_mode; end if;
  elsif p_ownership_mode in ('personal','temporary') then
    if p_owner_membership_id is null then raise exception '% ownership requires an owner membership',p_ownership_mode; end if;
    perform public._resource_assert_member(p_household_id,p_owner_membership_id);
  elsif p_ownership_mode='shared_selected' then
    if cardinality(coalesce(p_shared_membership_ids,'{}'::uuid[]))<2 then raise exception 'shared_selected ownership requires at least two members'; end if;
    foreach v_mid in array p_shared_membership_ids loop perform public._resource_assert_member(p_household_id,v_mid); end loop;
  else raise exception 'Unknown ownership mode: %',p_ownership_mode;
  end if;
end $$;
revoke all on function public._resource_validate_ownership(uuid,text,uuid,uuid[]) from public,anon;

create or replace function public._resource_default_visibility(p_ownership_mode text)
returns text language sql immutable set search_path=public as $$
  select case when p_ownership_mode in ('personal','temporary') then 'owner_only'
              when p_ownership_mode='shared_selected' then 'selected_members'
              else 'household' end
$$;
revoke all on function public._resource_default_visibility(text) from public,anon;

-- Who should be notified about an inventory item, honoring its visibility.
create or replace function public._resource_inventory_recipients(p_item_id uuid)
returns uuid[] language sql stable security definer set search_path=public as $$
  select case i.visibility
    when 'household' then (select array_agg(m.id) from public.household_memberships m where m.household_id=i.household_id and m.status='active')
    when 'owner_only' then array_remove(array[i.owner_membership_id],null)
    else (select array_agg(distinct x) from (
      select i.owner_membership_id as x
      union select om.membership_id from public.inventory_ownership_members om where om.inventory_item_id=i.id
    ) s where x is not null)
  end
  from public.inventory_items i where i.id=p_item_id
$$;
revoke all on function public._resource_inventory_recipients(uuid) from public,anon;

-- ---------------------------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------------------------
create or replace function public.create_household_location(p_household_id uuid,p_name text,p_parent_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  insert into public.household_locations(household_id,name,parent_id,created_by_membership_id)
  values(p_household_id,trim(p_name),p_parent_id,v_actor) returning id into v_id;
  perform public._resource_audit(p_household_id,'household_location',v_id,'house.location_created');
  return v_id;
end $$;

create or replace function public.rename_household_location(p_location_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_loc public.household_locations%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_loc from public.household_locations where id=p_location_id for update;
  if not found then raise exception 'Location not found'; end if;
  v_actor:=public._resource_active_membership(v_loc.household_id);
  update public.household_locations set name=trim(p_name) where id=p_location_id;
  perform public._resource_audit(v_loc.household_id,'household_location',p_location_id,'house.location_renamed',
    jsonb_build_object('name',v_loc.name),jsonb_build_object('name',trim(p_name)));
  return p_location_id;
end $$;

create or replace function public.archive_household_location(p_location_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_loc public.household_locations%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_loc from public.household_locations where id=p_location_id for update;
  if not found then raise exception 'Location not found'; end if;
  v_actor:=public._resource_active_membership(v_loc.household_id);
  update public.household_locations set archived_at=coalesce(archived_at,now()) where id=p_location_id;
  perform public._resource_audit(v_loc.household_id,'household_location',p_location_id,'house.location_archived');
  return p_location_id;
end $$;

-- ---------------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------------
create or replace function public.create_inventory_item(
  p_household_id uuid,p_name text,p_category text,
  p_ownership_mode text default 'household',p_owner_membership_id uuid default null,
  p_visibility text default null,p_quantity numeric default 1,p_quantity_unit text default 'item',
  p_location_id uuid default null,p_condition text default 'unknown',p_description text default null,
  p_shared_membership_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid; v_owner uuid; v_visibility text; v_mid uuid; v_recipients uuid[];
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  perform public._resource_validate_ownership(p_household_id,p_ownership_mode,p_owner_membership_id,p_shared_membership_ids);
  v_owner:=case when p_ownership_mode in ('personal','temporary') then p_owner_membership_id else null end;
  v_visibility:=coalesce(p_visibility,public._resource_default_visibility(p_ownership_mode));
  insert into public.inventory_items(household_id,name,description,category,ownership_mode,owner_membership_id,visibility,
    quantity,quantity_unit,location_id,condition,created_by_membership_id)
  values(p_household_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_category,p_ownership_mode,v_owner,v_visibility,
    coalesce(p_quantity,1),p_quantity_unit,p_location_id,p_condition,v_actor)
  returning id into v_id;
  if p_ownership_mode='shared_selected' then
    foreach v_mid in array coalesce(p_shared_membership_ids,'{}') loop
      insert into public.inventory_ownership_members(inventory_item_id,household_id,membership_id) values(v_id,p_household_id,v_mid) on conflict do nothing;
    end loop;
  end if;
  perform public._resource_audit(p_household_id,'inventory_item',v_id,'inventory.item_created');
  if v_visibility<>'owner_only' then
    v_recipients:=public._resource_inventory_recipients(v_id);
    perform public._resource_notify(p_household_id,'inventory.item_created','inventory_item',v_id,v_actor,v_recipients,
      'Inventory item added','A household item was added.','/app/'||p_household_id::text||'/house/inventory/'||v_id::text);
  end if;
  return v_id;
end $$;

create or replace function public.update_inventory_item(p_item_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  if v_item.ownership_mode in ('personal','temporary') and v_actor<>v_item.owner_membership_id and not public.is_household_coordinator(v_item.household_id) then
    raise exception 'Owner or household coordinator required';
  end if;
  update public.inventory_items set
    name=coalesce(nullif(trim(coalesce(p_patch->>'name','')),''),name),
    description=case when p_patch?'description' then nullif(trim(p_patch->>'description'),'') else description end,
    category=coalesce(p_patch->>'category',category),
    location_id=case when p_patch?'location_id' then (p_patch->>'location_id')::uuid else location_id end,
    brand=case when p_patch?'brand' then nullif(trim(p_patch->>'brand'),'') else brand end,
    model=case when p_patch?'model' then nullif(trim(p_patch->>'model'),'') else model end,
    serial_number=case when p_patch?'serial_number' then nullif(trim(p_patch->>'serial_number'),'') else serial_number end,
    purchase_date=case when p_patch?'purchase_date' then (p_patch->>'purchase_date')::date else purchase_date end,
    purchase_price_cents=case when p_patch?'purchase_price_cents' then (p_patch->>'purchase_price_cents')::int else purchase_price_cents end,
    warranty_expires_at=case when p_patch?'warranty_expires_at' then (p_patch->>'warranty_expires_at')::date else warranty_expires_at end,
    loan_return_at=case when p_patch?'loan_return_at' then (p_patch->>'loan_return_at')::date else loan_return_at end
  where id=p_item_id;
  if p_patch?'warranty_expires_at' or p_patch?'loan_return_at' then perform public._reconcile_inventory_reminders(p_item_id); end if;
  perform public._resource_audit(v_item.household_id,'inventory_item',p_item_id,'inventory.item_updated',null,p_patch);
  return p_item_id;
end $$;

create or replace function public.change_inventory_condition(p_item_id uuid,p_new_condition text,p_reason text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_actor uuid; v_status text; v_recipients uuid[];
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  insert into public.inventory_condition_events(inventory_item_id,household_id,previous_condition,new_condition,changed_by_membership_id,reason,note)
  values(p_item_id,v_item.household_id,v_item.condition,p_new_condition,v_actor,nullif(trim(coalesce(p_reason,'')),''),nullif(trim(coalesce(p_note,'')),''));
  v_status:=case when p_new_condition in ('damaged','repair_needed') then p_new_condition
                 when v_item.status in ('damaged','repair_needed') then 'active'
                 else v_item.status end;
  update public.inventory_items set condition=p_new_condition,status=v_status where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'inventory_item',p_item_id,'inventory.condition_changed',
    jsonb_build_object('condition',v_item.condition),jsonb_build_object('condition',p_new_condition),p_reason);
  if p_new_condition in ('damaged','repair_needed') then
    v_recipients:=public._resource_inventory_recipients(p_item_id);
    perform public._resource_notify(v_item.household_id,'inventory.condition_changed','inventory_item',p_item_id,v_actor,v_recipients,
      'Item condition updated','An item condition changed and may need attention.','/app/'||v_item.household_id::text||'/house/inventory/'||p_item_id::text);
  end if;
  return p_item_id;
end $$;

create or replace function public.change_inventory_ownership(p_item_id uuid,p_ownership_mode text,p_owner_membership_id uuid default null,p_shared_membership_ids uuid[] default '{}',p_visibility text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_actor uuid; v_owner uuid; v_visibility text; v_mid uuid; v_is_owner boolean;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  v_is_owner:=v_item.owner_membership_id is not null and v_actor=v_item.owner_membership_id;
  if not v_is_owner and not public.is_household_coordinator(v_item.household_id) then raise exception 'Current owner or household coordinator required'; end if;
  perform public._resource_validate_ownership(v_item.household_id,p_ownership_mode,p_owner_membership_id,p_shared_membership_ids);
  v_owner:=case when p_ownership_mode in ('personal','temporary') then p_owner_membership_id else null end;
  v_visibility:=coalesce(p_visibility,public._resource_default_visibility(p_ownership_mode));
  update public.inventory_items set ownership_mode=p_ownership_mode,owner_membership_id=v_owner,visibility=v_visibility where id=p_item_id;
  delete from public.inventory_ownership_members where inventory_item_id=p_item_id;
  if p_ownership_mode='shared_selected' then
    foreach v_mid in array coalesce(p_shared_membership_ids,'{}') loop
      insert into public.inventory_ownership_members(inventory_item_id,household_id,membership_id) values(p_item_id,v_item.household_id,v_mid) on conflict do nothing;
    end loop;
  end if;
  perform public._reconcile_inventory_reminders(p_item_id);
  perform public._resource_audit(v_item.household_id,'inventory_item',p_item_id,'inventory.ownership_changed',
    jsonb_build_object('ownership_mode',v_item.ownership_mode),jsonb_build_object('ownership_mode',p_ownership_mode));
  return p_item_id;
end $$;

create or replace function public.move_inventory_item(p_item_id uuid,p_location_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.inventory_items set location_id=p_location_id where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'inventory_item',p_item_id,'inventory.location_changed',
    jsonb_build_object('location_id',v_item.location_id),jsonb_build_object('location_id',p_location_id));
  return p_item_id;
end $$;

create or replace function public.dispose_inventory_item(p_item_id uuid,p_status text,p_disposition text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  if p_status not in ('disposed','donated','sold','moved_out','returned') then raise exception 'Invalid disposition status: %',p_status; end if;
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.inventory_items set status=p_status,
    move_out_disposition=coalesce(nullif(trim(coalesce(p_disposition,'')),''),move_out_disposition)
  where id=p_item_id;
  perform public._reconcile_inventory_reminders(p_item_id);
  perform public._resource_audit(v_item.household_id,'inventory_item',p_item_id,'inventory.item_disposed',
    jsonb_build_object('status',v_item.status),jsonb_build_object('status',p_status));
  return p_item_id;
end $$;

-- ---------------------------------------------------------------------------
-- SUPPLY
-- ---------------------------------------------------------------------------
create or replace function public.create_supply_item(
  p_household_id uuid,p_name text,p_category text,
  p_ownership_mode text default 'household',p_owner_membership_id uuid default null,
  p_stock_state text default 'unknown',p_quantity numeric default null,p_quantity_unit text default 'item',
  p_reorder_threshold numeric default null,p_target_quantity numeric default null,p_location_id uuid default null,
  p_responsible_membership_id uuid default null,p_responsibility_area_id uuid default null,
  p_restock_policy text default 'suggest',p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid; v_owner uuid; v_visibility text;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  perform public._resource_validate_ownership(p_household_id,p_ownership_mode,p_owner_membership_id,'{}'::uuid[]);
  v_owner:=case when p_ownership_mode in ('personal','temporary') then p_owner_membership_id else null end;
  v_visibility:=public._resource_default_visibility(p_ownership_mode);
  if p_responsible_membership_id is not null then perform public._resource_assert_member(p_household_id,p_responsible_membership_id); end if;
  insert into public.supply_items(household_id,name,category,ownership_mode,owner_membership_id,visibility,
    quantity,quantity_unit,stock_state,reorder_threshold,target_quantity,location_id,responsible_membership_id,
    responsibility_area_id,restock_policy,notes,created_by_membership_id)
  values(p_household_id,trim(p_name),p_category,p_ownership_mode,v_owner,v_visibility,
    p_quantity,p_quantity_unit,p_stock_state,p_reorder_threshold,p_target_quantity,p_location_id,p_responsible_membership_id,
    p_responsibility_area_id,p_restock_policy,nullif(trim(coalesce(p_notes,'')),''),v_actor)
  returning id into v_id;
  insert into public.supply_stock_events(supply_item_id,household_id,event_type,new_quantity,new_stock_state,recorded_by_membership_id)
  values(v_id,p_household_id,'created',p_quantity,p_stock_state,v_actor);
  perform public._resource_audit(p_household_id,'supply_item',v_id,'supply.item_created');
  return v_id;
end $$;

create or replace function public.record_supply_stock(p_item_id uuid,p_event_type text,p_new_quantity numeric default null,p_stock_state text default null,p_reason text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.supply_items%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  if p_event_type not in ('counted','restocked','used','adjusted','corrected') then raise exception 'Invalid stock event type: %',p_event_type; end if;
  select * into v_item from public.supply_items where id=p_item_id for update;
  if not found then raise exception 'Supply item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.supply_items set
    quantity=coalesce(p_new_quantity,quantity),
    stock_state=coalesce(p_stock_state,stock_state),
    last_stock_check_at=case when p_event_type='counted' then now() else last_stock_check_at end,
    last_restocked_at=case when p_event_type='restocked' then now() else last_restocked_at end
  where id=p_item_id;
  insert into public.supply_stock_events(supply_item_id,household_id,event_type,previous_quantity,new_quantity,
    delta_quantity,previous_stock_state,new_stock_state,reason,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,p_event_type,v_item.quantity,coalesce(p_new_quantity,v_item.quantity),
    case when p_new_quantity is not null and v_item.quantity is not null then p_new_quantity-v_item.quantity else null end,
    v_item.stock_state,coalesce(p_stock_state,v_item.stock_state),nullif(trim(coalesce(p_reason,'')),''),nullif(trim(coalesce(p_note,'')),''),v_actor)
  returning id into v_id;
  perform public._resource_audit(v_item.household_id,'supply_item',p_item_id,'supply.stock_updated');
  return v_id;
end $$;

create or replace function public.mark_supply_low(p_item_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.supply_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.supply_items where id=p_item_id for update;
  if not found then raise exception 'Supply item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.supply_items set stock_state='low' where id=p_item_id;
  insert into public.supply_stock_events(supply_item_id,household_id,event_type,previous_stock_state,new_stock_state,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,'adjusted',v_item.stock_state,'low',nullif(trim(coalesce(p_note,'')),''),v_actor);
  perform public._resource_audit(v_item.household_id,'supply_item',p_item_id,'supply.stock_updated',
    jsonb_build_object('stock_state',v_item.stock_state),jsonb_build_object('stock_state','low'));
  if v_item.responsible_membership_id is not null then
    perform public._resource_notify(v_item.household_id,'supply.low','supply_item',p_item_id,v_actor,array[v_item.responsible_membership_id],
      'Supply running low','A household supply may need restocking.','/app/'||v_item.household_id::text||'/house/supplies/'||p_item_id::text);
  end if;
  return p_item_id;
end $$;

create or replace function public.restock_supply_item(p_item_id uuid,p_quantity numeric default null,p_stock_state text default 'in_stock',p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.supply_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.supply_items where id=p_item_id for update;
  if not found then raise exception 'Supply item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.supply_items set quantity=coalesce(p_quantity,quantity),stock_state=p_stock_state,
    last_restocked_at=now(),last_purchased_at=current_date where id=p_item_id;
  insert into public.supply_stock_events(supply_item_id,household_id,event_type,previous_quantity,new_quantity,
    previous_stock_state,new_stock_state,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,'restocked',v_item.quantity,coalesce(p_quantity,v_item.quantity),
    v_item.stock_state,p_stock_state,nullif(trim(coalesce(p_note,'')),''),v_actor);
  perform public._resource_audit(v_item.household_id,'supply_item',p_item_id,'supply.restocked');
  if v_item.responsible_membership_id is not null then
    perform public._resource_notify(v_item.household_id,'supply.restocked','supply_item',p_item_id,v_actor,array[v_item.responsible_membership_id],
      'Supply restocked','A household supply was restocked.','/app/'||v_item.household_id::text||'/house/supplies/'||p_item_id::text);
  end if;
  return p_item_id;
end $$;

create or replace function public.touch_supply_stock_check(p_item_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.supply_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.supply_items where id=p_item_id for update;
  if not found then raise exception 'Supply item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.supply_items set last_stock_check_at=now() where id=p_item_id;
  return p_item_id;
end $$;

-- ---------------------------------------------------------------------------
-- PANTRY
-- ---------------------------------------------------------------------------
create or replace function public.create_pantry_item(
  p_household_id uuid,p_name text,p_category text,
  p_ownership_mode text default 'household',p_owner_membership_id uuid default null,
  p_visibility text default null,p_quantity numeric default null,p_quantity_unit text default 'item',
  p_location_id uuid default null,p_use_soon_at date default null,p_use_by date default null,p_best_by date default null,
  p_communal_available boolean default true,p_remaining_state text default null,p_notes text default null,
  p_normalized_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid; v_owner uuid; v_visibility text; v_state text;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  perform public._resource_validate_ownership(p_household_id,p_ownership_mode,p_owner_membership_id,'{}'::uuid[]);
  v_owner:=case when p_ownership_mode in ('personal','temporary') then p_owner_membership_id else null end;
  v_visibility:=coalesce(p_visibility,case when p_ownership_mode in ('personal','temporary') then 'owner_only' else 'household' end);
  v_state:=case
    when p_use_by is not null and p_use_by<=current_date then 'expired'
    when p_best_by is not null and p_best_by<=current_date then 'expired'
    when p_use_soon_at is not null and p_use_soon_at<=current_date then 'use_soon'
    else 'available' end;
  insert into public.pantry_items(household_id,name,normalized_name,category,ownership_mode,owner_membership_id,visibility,
    quantity,quantity_unit,location_id,use_by,best_by,use_soon_at,communal_available,remaining_state,state,notes,created_by_membership_id)
  values(p_household_id,trim(p_name),coalesce(nullif(trim(coalesce(p_normalized_name,'')),''),lower(trim(p_name))),p_category,p_ownership_mode,v_owner,v_visibility,
    p_quantity,p_quantity_unit,p_location_id,p_use_by,p_best_by,p_use_soon_at,p_communal_available,p_remaining_state,v_state,
    nullif(trim(coalesce(p_notes,'')),''),v_actor)
  returning id into v_id;
  insert into public.pantry_stock_events(pantry_item_id,household_id,event_type,new_quantity,new_state,recorded_by_membership_id)
  values(v_id,p_household_id,'created',p_quantity,v_state,v_actor);
  perform public._reconcile_pantry_reminders(v_id);
  perform public._resource_audit(p_household_id,'pantry_item',v_id,'pantry.item_created');
  return v_id;
end $$;

create or replace function public.record_pantry_stock(p_item_id uuid,p_event_type text,p_new_quantity numeric default null,p_state text default null,p_remaining_state text default null,p_reason text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.pantry_items%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  if p_event_type not in ('counted','restocked','used','adjusted','corrected') then raise exception 'Invalid stock event type: %',p_event_type; end if;
  select * into v_item from public.pantry_items where id=p_item_id for update;
  if not found then raise exception 'Pantry item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.pantry_items set
    quantity=coalesce(p_new_quantity,quantity),
    state=coalesce(p_state,state),
    remaining_state=coalesce(p_remaining_state,remaining_state)
  where id=p_item_id;
  insert into public.pantry_stock_events(pantry_item_id,household_id,event_type,previous_quantity,new_quantity,
    delta_quantity,previous_state,new_state,reason,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,p_event_type,v_item.quantity,coalesce(p_new_quantity,v_item.quantity),
    case when p_new_quantity is not null and v_item.quantity is not null then p_new_quantity-v_item.quantity else null end,
    v_item.state,coalesce(p_state,v_item.state),nullif(trim(coalesce(p_reason,'')),''),nullif(trim(coalesce(p_note,'')),''),v_actor)
  returning id into v_id;
  perform public._reconcile_pantry_reminders(p_item_id);
  perform public._resource_audit(v_item.household_id,'pantry_item',p_item_id,'pantry.stock_updated');
  return v_id;
end $$;

create or replace function public.mark_pantry_finished(p_item_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.pantry_items%rowtype; v_actor uuid; v_recipients uuid[];
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.pantry_items where id=p_item_id for update;
  if not found then raise exception 'Pantry item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.pantry_items set state='finished',remaining_state='finished' where id=p_item_id;
  insert into public.pantry_stock_events(pantry_item_id,household_id,event_type,previous_state,new_state,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,'finished',v_item.state,'finished',nullif(trim(coalesce(p_note,'')),''),v_actor);
  perform public._cancel_resource_source_reminders('pantry_item',p_item_id);
  perform public._resource_audit(v_item.household_id,'pantry_item',p_item_id,'pantry.finished');
  v_recipients:=case when v_item.ownership_mode='personal' then array_remove(array[v_item.owner_membership_id],null)
    else (select array_agg(m.id) from public.household_memberships m where m.household_id=v_item.household_id and m.status='active') end;
  perform public._resource_notify(v_item.household_id,'pantry.finished','pantry_item',p_item_id,v_actor,v_recipients,
    'Pantry item finished','A pantry item was marked finished.','/app/'||v_item.household_id::text||'/house/pantry/'||p_item_id::text);
  return p_item_id;
end $$;

create or replace function public.discard_pantry_item(p_item_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.pantry_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.pantry_items where id=p_item_id for update;
  if not found then raise exception 'Pantry item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.pantry_items set state='discarded' where id=p_item_id;
  insert into public.pantry_stock_events(pantry_item_id,household_id,event_type,previous_state,new_state,note,recorded_by_membership_id)
  values(p_item_id,v_item.household_id,'discarded',v_item.state,'discarded',nullif(trim(coalesce(p_note,'')),''),v_actor);
  perform public._cancel_resource_source_reminders('pantry_item',p_item_id);
  perform public._resource_audit(v_item.household_id,'pantry_item',p_item_id,'pantry.discarded');
  return p_item_id;
end $$;

-- ---------------------------------------------------------------------------
-- SHOPPING
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_shopping_list(p_household_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  select id into v_id from public.shopping_lists where household_id=p_household_id and is_default and archived_at is null;
  if v_id is not null then return v_id; end if;
  insert into public.shopping_lists(household_id,name,is_default,created_by_membership_id)
  values(p_household_id,'Household shopping',true,v_actor) returning id into v_id;
  perform public._resource_audit(p_household_id,'shopping_list',v_id,'shopping.list_created');
  return v_id;
end $$;

create or replace function public.create_shopping_list(p_household_id uuid,p_name text,p_store_label text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  insert into public.shopping_lists(household_id,name,store_label,created_by_membership_id)
  values(p_household_id,trim(p_name),nullif(trim(coalesce(p_store_label,'')),''),v_actor) returning id into v_id;
  perform public._resource_audit(p_household_id,'shopping_list',v_id,'shopping.list_created');
  return v_id;
end $$;

create or replace function public.create_shopping_item(
  p_household_id uuid,p_name text,p_list_id uuid default null,p_category text default 'other',
  p_quantity numeric default null,p_quantity_unit text default 'item',p_priority text default 'normal',
  p_intended_ownership text default 'household',p_intended_owner_membership_id uuid default null,
  p_needed_by date default null,p_estimated_cost_cents int default null,
  p_related_supply_id uuid default null,p_related_pantry_id uuid default null,p_related_inventory_id uuid default null,
  p_description text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_list_id uuid; v_id uuid; v_hint boolean; v_recipients uuid[];
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  if p_intended_ownership in ('personal','temporary') and p_intended_owner_membership_id is null then
    raise exception '% intended ownership requires an intended owner',p_intended_ownership;
  end if;
  if p_intended_owner_membership_id is not null then perform public._resource_assert_member(p_household_id,p_intended_owner_membership_id); end if;
  v_list_id:=coalesce(p_list_id,public.ensure_default_shopping_list(p_household_id));
  if not exists(select 1 from public.shopping_lists where id=v_list_id and household_id=p_household_id) then
    raise exception 'Shopping list not found in this household';
  end if;
  if p_related_supply_id is not null and exists(
    select 1 from public.shopping_list_items where related_supply_id=p_related_supply_id
      and status in ('requested','approved','assigned','in_cart')
  ) then
    raise exception 'An active shopping request already exists for this supply';
  end if;
  v_hint:=(p_estimated_cost_cents is not null and p_estimated_cost_cents>=5000) or p_related_inventory_id is not null;
  insert into public.shopping_list_items(list_id,household_id,name,description,category,requested_by_membership_id,
    intended_ownership,intended_owner_membership_id,quantity,quantity_unit,priority,needed_by,estimated_cost_cents,
    approval_hint,related_supply_id,related_pantry_id,related_inventory_id)
  values(v_list_id,p_household_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_category,v_actor,
    p_intended_ownership,p_intended_owner_membership_id,p_quantity,p_quantity_unit,p_priority,p_needed_by,p_estimated_cost_cents,
    v_hint,p_related_supply_id,p_related_pantry_id,p_related_inventory_id)
  returning id into v_id;
  perform public._resource_audit(p_household_id,'shopping_list_item',v_id,'shopping.item_requested');
  select array_agg(distinct r.membership_id) into v_recipients from public.household_membership_roles r
    join public.household_memberships m on m.id=r.membership_id
    where m.household_id=p_household_id and m.status='active' and r.role='household_coordinator';
  if cardinality(coalesce(v_recipients,'{}'::uuid[]))>0 then
    perform public._resource_notify(p_household_id,'shopping.item_requested','shopping_list_item',v_id,v_actor,v_recipients,
      'Shopping request added','A new shopping request was added.','/app/'||p_household_id::text||'/house/shopping/'||v_id::text);
  end if;
  return v_id;
end $$;

create or replace function public.assign_shopping_item(p_item_id uuid,p_shopper_membership_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.shopping_list_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.shopping_list_items where id=p_item_id for update;
  if not found then raise exception 'Shopping item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  perform public._resource_assert_member(v_item.household_id,p_shopper_membership_id);
  update public.shopping_list_items set status='assigned',assigned_shopper_membership_id=p_shopper_membership_id where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'shopping_list_item',p_item_id,'shopping.item_assigned');
  perform public._resource_notify(v_item.household_id,'shopping.item_assigned','shopping_list_item',p_item_id,v_actor,array[p_shopper_membership_id],
    'Shopping item assigned','You have been assigned a shopping item.','/app/'||v_item.household_id::text||'/house/shopping/'||p_item_id::text);
  return p_item_id;
end $$;

create or replace function public.claim_shopping_item(p_item_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.shopping_list_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.shopping_list_items where id=p_item_id for update;
  if not found then raise exception 'Shopping item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.shopping_list_items set status='assigned',assigned_shopper_membership_id=v_actor where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'shopping_list_item',p_item_id,'shopping.item_claimed');
  return p_item_id;
end $$;

create or replace function public.mark_shopping_item_purchased(p_item_id uuid,p_purchased_quantity numeric default null,p_update_related_stock boolean default true,p_expense_item_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.shopping_list_items%rowtype; v_actor uuid; v_expense_id uuid; v_expense_household_id uuid;
  v_resource_type text; v_resource_id uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.shopping_list_items where id=p_item_id for update;
  if not found then raise exception 'Shopping item not found'; end if;
  if v_item.status='purchased' then return p_item_id; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.shopping_list_items set status='purchased',purchaser_membership_id=v_actor,
    purchased_quantity=coalesce(p_purchased_quantity,v_item.quantity),purchased_at=now()
  where id=p_item_id;
  if p_update_related_stock and v_item.related_supply_id is not null then
    perform public.restock_supply_item(v_item.related_supply_id,p_purchased_quantity,'in_stock','Purchased via shopping list');
  end if;
  if p_update_related_stock and v_item.related_pantry_id is not null then
    perform public.record_pantry_stock(v_item.related_pantry_id,'restocked',p_purchased_quantity,'available','plenty',null,'Purchased via shopping list');
  end if;
  if p_expense_item_id is not null then
    select expense_id,household_id into v_expense_id,v_expense_household_id from public.expense_items where id=p_expense_item_id;
    if v_expense_id is null or v_expense_household_id<>v_item.household_id then
      raise exception 'Expense item does not belong to this household';
    end if;
    v_resource_type:=case when v_item.related_supply_id is not null then 'supply'
      when v_item.related_pantry_id is not null then 'pantry'
      when v_item.related_inventory_id is not null then 'inventory'
      else 'shopping_item' end;
    v_resource_id:=coalesce(v_item.related_supply_id,v_item.related_pantry_id,v_item.related_inventory_id,p_item_id);
    insert into public.resource_expense_links(household_id,expense_id,expense_item_id,resource_type,resource_id,link_kind,created_by_membership_id)
    values(v_item.household_id,v_expense_id,p_expense_item_id,v_resource_type,v_resource_id,'purchase_completion',v_actor)
    on conflict (expense_item_id,resource_type,resource_id) where unlinked_at is null do nothing;
  end if;
  perform public._resource_audit(v_item.household_id,'shopping_list_item',p_item_id,'shopping.item_purchased');
  perform public._resource_notify(v_item.household_id,'shopping.item_purchased','shopping_list_item',p_item_id,v_actor,
    array[v_item.requested_by_membership_id],
    'Shopping item purchased','A requested item was purchased.','/app/'||v_item.household_id::text||'/house/shopping/'||p_item_id::text);
  return p_item_id;
end $$;

create or replace function public.mark_shopping_item_unavailable(p_item_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.shopping_list_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.shopping_list_items where id=p_item_id for update;
  if not found then raise exception 'Shopping item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.shopping_list_items set status='unavailable' where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'shopping_list_item',p_item_id,'shopping.item_unavailable',null,null,p_note);
  return p_item_id;
end $$;

create or replace function public.cancel_shopping_item(p_item_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_item public.shopping_list_items%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_item from public.shopping_list_items where id=p_item_id for update;
  if not found then raise exception 'Shopping item not found'; end if;
  v_actor:=public._resource_active_membership(v_item.household_id);
  update public.shopping_list_items set status='cancelled',cancelled_at=now() where id=p_item_id;
  perform public._resource_audit(v_item.household_id,'shopping_list_item',p_item_id,'shopping.item_cancelled');
  return p_item_id;
end $$;

-- ---------------------------------------------------------------------------
-- EXPENSE LINKS
-- ---------------------------------------------------------------------------
create or replace function public.link_resource_to_expense_item(p_household_id uuid,p_expense_item_id uuid,p_resource_type text,p_resource_id uuid,p_link_kind text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_expense_id uuid; v_expense_household_id uuid; v_id uuid; v_exists boolean;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  v_actor:=public._resource_active_membership(p_household_id);
  if p_resource_type not in ('inventory','supply','pantry','shopping_item') then raise exception 'Invalid resource type: %',p_resource_type; end if;
  select expense_id,household_id into v_expense_id,v_expense_household_id from public.expense_items where id=p_expense_item_id;
  if v_expense_id is null or v_expense_household_id<>p_household_id then raise exception 'Expense item does not belong to this household'; end if;
  v_exists:=case p_resource_type
    when 'inventory' then exists(select 1 from public.inventory_items where id=p_resource_id and household_id=p_household_id)
    when 'supply' then exists(select 1 from public.supply_items where id=p_resource_id and household_id=p_household_id)
    when 'pantry' then exists(select 1 from public.pantry_items where id=p_resource_id and household_id=p_household_id)
    else exists(select 1 from public.shopping_list_items where id=p_resource_id and household_id=p_household_id) end;
  if not v_exists then raise exception 'Resource not found in this household'; end if;
  insert into public.resource_expense_links(household_id,expense_id,expense_item_id,resource_type,resource_id,link_kind,created_by_membership_id)
  values(p_household_id,v_expense_id,p_expense_item_id,p_resource_type,p_resource_id,p_link_kind,v_actor)
  returning id into v_id;
  perform public._resource_audit(p_household_id,'resource_expense_link',v_id,'resource.expense_linked');
  return v_id;
end $$;

create or replace function public.unlink_resource_from_expense_item(p_link_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_link public.resource_expense_links%rowtype; v_actor uuid;
begin
  perform set_config('householdos.resource_mutation','rpc',true);
  select * into v_link from public.resource_expense_links where id=p_link_id for update;
  if not found then raise exception 'Expense link not found'; end if;
  v_actor:=public._resource_active_membership(v_link.household_id);
  update public.resource_expense_links set unlinked_at=now() where id=p_link_id;
  perform public._resource_audit(v_link.household_id,'resource_expense_link',p_link_id,'resource.expense_unlinked');
  return p_link_id;
end $$;

-- ---------------------------------------------------------------------------
-- REMINDER HELPERS
-- ---------------------------------------------------------------------------
create or replace function public._cancel_resource_source_reminders(p_source_type text,p_source_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.scheduled_notification_requests set cancelled_at=now(),updated_at=now()
  where source_type=p_source_type and source_id=p_source_id and processed_at is null and cancelled_at is null;
end $$;
revoke all on function public._cancel_resource_source_reminders(text,uuid) from public,anon;

-- Reminders are only created for owner_only (personal) items to avoid household-wide spam.
create or replace function public._reconcile_pantry_reminders(p_pantry_item_id uuid)
returns int language plpgsql security definer set search_path=public as $$
declare v_item public.pantry_items%rowtype; v_user uuid; v_date date; v_count int:=0;
begin
  select * into v_item from public.pantry_items where id=p_pantry_item_id;
  if not found then return 0; end if;
  perform public._cancel_resource_source_reminders('pantry_item',p_pantry_item_id);
  if v_item.state in ('finished','discarded') then return 0; end if;
  if v_item.visibility<>'owner_only' or v_item.owner_membership_id is null then return 0; end if;
  select user_id into v_user from public.household_memberships where id=v_item.owner_membership_id;
  if v_user is null then return 0; end if;
  if v_item.use_soon_at is not null and v_item.use_soon_at>=current_date then
    perform public._create_scheduled_notification_request('pantry_item',p_pantry_item_id,v_user,'pantry.use_soon',
      (v_item.use_soon_at+time '09:00')::timestamptz,'America/Chicago',
      'pantry_use_soon:'||p_pantry_item_id::text||':'||v_user::text||':'||v_item.use_soon_at::text,
      jsonb_build_object('source_type','pantry_item','source_id',p_pantry_item_id,'title','Pantry item to use soon',
        'body','Review a pantry item before it goes to waste.','action_href','/app/'||v_item.household_id::text||'/house/pantry/'||p_pantry_item_id::text));
    v_count:=v_count+1;
  end if;
  v_date:=coalesce(v_item.use_by,v_item.best_by);
  if v_date is not null and v_date>=current_date then
    perform public._create_scheduled_notification_request('pantry_item',p_pantry_item_id,v_user,'pantry.date_passed',
      (v_date+time '09:00')::timestamptz,'America/Chicago',
      'pantry_date_passed:'||p_pantry_item_id::text||':'||v_user::text||':'||v_date::text,
      jsonb_build_object('source_type','pantry_item','source_id',p_pantry_item_id,'title','Pantry item date approaching',
        'body','Review a pantry item before its entered date.','action_href','/app/'||v_item.household_id::text||'/house/pantry/'||p_pantry_item_id::text));
    v_count:=v_count+1;
  end if;
  return v_count;
end $$;
revoke all on function public._reconcile_pantry_reminders(uuid) from public,anon;

create or replace function public._reconcile_inventory_reminders(p_inventory_item_id uuid)
returns int language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_user uuid; v_recipient_membership uuid; v_count int:=0;
begin
  select * into v_item from public.inventory_items where id=p_inventory_item_id;
  if not found then return 0; end if;
  perform public._cancel_resource_source_reminders('inventory_item',p_inventory_item_id);
  if v_item.status in ('disposed','donated','sold','moved_out','returned') then return 0; end if;
  v_recipient_membership:=coalesce(v_item.owner_membership_id,v_item.responsible_membership_id);
  if v_recipient_membership is null then return 0; end if;
  select user_id into v_user from public.household_memberships where id=v_recipient_membership;
  if v_user is null then return 0; end if;
  if v_item.warranty_expires_at is not null and v_item.warranty_expires_at>=current_date then
    perform public._create_scheduled_notification_request('inventory_item',p_inventory_item_id,v_user,'inventory.warranty',
      (v_item.warranty_expires_at+time '09:00')::timestamptz,'America/Chicago',
      'inventory_warranty:'||p_inventory_item_id::text||':'||v_user::text||':'||v_item.warranty_expires_at::text,
      jsonb_build_object('source_type','inventory_item','source_id',p_inventory_item_id,'title','Warranty expiring soon',
        'body','An item warranty is expiring soon.','action_href','/app/'||v_item.household_id::text||'/house/inventory/'||p_inventory_item_id::text));
    v_count:=v_count+1;
  end if;
  if v_item.loan_return_at is not null and v_item.loan_return_at>=current_date then
    perform public._create_scheduled_notification_request('inventory_item',p_inventory_item_id,v_user,'inventory.loan_return',
      (v_item.loan_return_at+time '09:00')::timestamptz,'America/Chicago',
      'inventory_loan_return:'||p_inventory_item_id::text||':'||v_user::text||':'||v_item.loan_return_at::text,
      jsonb_build_object('source_type','inventory_item','source_id',p_inventory_item_id,'title','Loan return due',
        'body','A loaned item is due back soon.','action_href','/app/'||v_item.household_id::text||'/house/inventory/'||p_inventory_item_id::text));
    v_count:=v_count+1;
  end if;
  return v_count;
end $$;
revoke all on function public._reconcile_inventory_reminders(uuid) from public,anon;

-- ---------------------------------------------------------------------------
-- Public RPC privileges: internal helpers remain private.
-- ---------------------------------------------------------------------------
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        '_resource_assert_member','_resource_audit','_resource_notify','_resource_validate_ownership',
        '_resource_default_visibility','_resource_inventory_recipients','_cancel_resource_source_reminders',
        '_reconcile_inventory_reminders','_reconcile_pantry_reminders',
        'create_household_location','rename_household_location','archive_household_location',
        'create_inventory_item','update_inventory_item','change_inventory_condition','change_inventory_ownership',
        'move_inventory_item','dispose_inventory_item',
        'create_supply_item','record_supply_stock','mark_supply_low','restock_supply_item','touch_supply_stock_check',
        'create_pantry_item','record_pantry_stock','mark_pantry_finished','discard_pantry_item',
        'ensure_default_shopping_list','create_shopping_list','create_shopping_item','assign_shopping_item',
        'claim_shopping_item','mark_shopping_item_purchased','mark_shopping_item_unavailable','cancel_shopping_item',
        'link_resource_to_expense_item','unlink_resource_from_expense_item'
      ])
  loop
    execute format('revoke all on function %s from public, anon', v_function);
  end loop;
end $$;

grant execute on function public.create_household_location(uuid,text,uuid),public.rename_household_location(uuid,text),public.archive_household_location(uuid) to authenticated;
grant execute on function public.create_inventory_item(uuid,text,text,text,uuid,text,numeric,text,uuid,text,text,uuid[]) to authenticated;
grant execute on function public.update_inventory_item(uuid,jsonb),public.change_inventory_condition(uuid,text,text,text),public.change_inventory_ownership(uuid,text,uuid,uuid[],text),public.move_inventory_item(uuid,uuid),public.dispose_inventory_item(uuid,text,text) to authenticated;
grant execute on function public.create_supply_item(uuid,text,text,text,uuid,text,numeric,text,numeric,numeric,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.record_supply_stock(uuid,text,numeric,text,text,text),public.mark_supply_low(uuid,text),public.restock_supply_item(uuid,numeric,text,text),public.touch_supply_stock_check(uuid) to authenticated;
grant execute on function public.create_pantry_item(uuid,text,text,text,uuid,text,numeric,text,uuid,date,date,date,boolean,text,text,text) to authenticated;
grant execute on function public.record_pantry_stock(uuid,text,numeric,text,text,text,text),public.mark_pantry_finished(uuid,text),public.discard_pantry_item(uuid,text) to authenticated;
grant execute on function public.ensure_default_shopping_list(uuid),public.create_shopping_list(uuid,text,text) to authenticated;
grant execute on function public.create_shopping_item(uuid,text,uuid,text,numeric,text,text,text,uuid,date,int,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.assign_shopping_item(uuid,uuid),public.claim_shopping_item(uuid),public.mark_shopping_item_purchased(uuid,numeric,boolean,uuid),public.mark_shopping_item_unavailable(uuid,text),public.cancel_shopping_item(uuid) to authenticated;
grant execute on function public.link_resource_to_expense_item(uuid,uuid,text,uuid,text),public.unlink_resource_from_expense_item(uuid) to authenticated;
grant execute on function public._reconcile_inventory_reminders(uuid),public._reconcile_pantry_reminders(uuid),public._cancel_resource_source_reminders(text,uuid) to service_role;
