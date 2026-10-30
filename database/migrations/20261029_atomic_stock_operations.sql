-- Review-only migration. Execute manually in Supabase after reviewing names
-- and RLS execution privileges.
-- Run 20261029_purchase_order_receipts.sql before this file.
-- These functions intentionally use SECURITY DEFINER so the backend can expose
-- only validated operations; do not grant them to anonymous clients.

create table if not exists public.stock_operation_requests (
  idempotency_key text primary key,
  operation_type text not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.stock_operation_requests enable row level security;
alter table public.stock_operation_requests add column if not exists request_hash text;

comment on table public.stock_operation_requests is
  'Backend idempotency records for atomic stock and receiving operations.';

create or replace function public.record_stock_movement(
  p_product_id bigint,
  p_movement_type text,
  p_quantity integer,
  p_reference text,
  p_department text,
  p_remarks text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_resulting_quantity integer;
  v_movement_id bigint;
  v_idempotency_key text;
  v_request_hash text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_note text;
  v_result jsonb;
begin
  if p_product_id is null or p_product_id <= 0 then
    raise exception using errcode = '22023', message = 'Product ID must be a positive integer.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'Movement quantity must be a positive integer.';
  end if;
  if p_movement_type is null or p_movement_type not in ('IN', 'OUT') then
    raise exception using errcode = '22023', message = 'Movement type must be IN or OUT.';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 or length(trim(p_idempotency_key)) > 200 then
    raise exception using errcode = '22023', message = 'A valid idempotency key is required.';
  end if;
  if length(coalesce(p_reference, '')) > 200
    or length(coalesce(p_department, '')) > 100
    or length(coalesce(p_remarks, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Stock movement details exceed the allowed length.';
  end if;

  v_idempotency_key := trim(p_idempotency_key);
  v_request_hash := jsonb_build_object(
    'product_id', p_product_id,
    'movement_type', p_movement_type,
    'quantity', p_quantity,
    'reference', coalesce(p_reference, ''),
    'department', coalesce(p_department, ''),
    'remarks', coalesce(p_remarks, '')
  )::text;
  insert into public.stock_operation_requests (idempotency_key, operation_type, request_hash)
  values ('stock_movement:' || v_idempotency_key, 'stock_movement', v_request_hash)
  on conflict (idempotency_key) do nothing;
  if not found then
    select request_hash, result into v_existing_hash, v_existing_result
    from public.stock_operation_requests
    where idempotency_key = 'stock_movement:' || v_idempotency_key;
    if v_existing_hash is distinct from v_request_hash then
      raise exception using errcode = '22023', message = 'Idempotency key was already used with a different stock request.';
    end if;
    return coalesce(v_existing_result, jsonb_build_object('duplicate', true))
      || jsonb_build_object('duplicate', true);
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found.';
  end if;

  v_resulting_quantity := v_product.quantity + case when p_movement_type = 'IN' then p_quantity else -p_quantity end;
  if v_resulting_quantity < 0 then
    raise exception using errcode = '22003', message = 'Stock-out would make inventory negative.';
  end if;

  v_note := jsonb_build_object(
    'format', 'inventra.stock-movement',
    'version', 1,
    'reference', coalesce(p_reference, ''),
    'department', coalesce(p_department, ''),
    'remarks', coalesce(p_remarks, ''),
    'previousQuantity', v_product.quantity,
    'resultingQuantity', v_resulting_quantity
  )::text;

  update public.products
  set quantity = v_resulting_quantity, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements (product_id, movement_type, quantity, note, created_at)
  values (p_product_id, p_movement_type, p_quantity, v_note, now())
  returning id into v_movement_id;

  v_result := jsonb_build_object(
    'duplicate', false,
    'movement_id', v_movement_id,
    'product_id', p_product_id,
    'reference', coalesce(p_reference, ''),
    'department', coalesce(p_department, ''),
    'remarks', coalesce(p_remarks, ''),
    'previous_quantity', v_product.quantity,
    'resulting_quantity', v_resulting_quantity
  );
  update public.stock_operation_requests
  set result = v_result
  where idempotency_key = 'stock_movement:' || v_idempotency_key;

  return v_result;
end;
$$;

create or replace function public.receive_purchase_order(
  p_purchase_order_id bigint,
  p_receipts jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_receipt jsonb;
  v_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_received integer;
  v_resulting_quantity integer;
  v_all_received boolean;
  v_any_received boolean := false;
  v_request_hash text;
  v_existing_hash text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  v_request_hash := md5(concat_ws('|', p_purchase_order_id, p_receipts::text));
  insert into public.stock_operation_requests (idempotency_key, operation_type, request_hash)
  values ('purchase_order_receipt:' || p_idempotency_key, 'purchase_order_receipt', v_request_hash)
  on conflict (idempotency_key) do nothing;
  if not found then
    select request_hash into v_existing_hash
    from public.stock_operation_requests
    where idempotency_key = 'purchase_order_receipt:' || p_idempotency_key;
    if v_existing_hash is distinct from v_request_hash then
      raise exception using errcode = '22023', message = 'Idempotency key was already used with a different receipt request.';
    end if;
    return jsonb_build_object('duplicate', true);
  end if;

  select * into v_order from public.purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order not found.';
  end if;
  if v_order.status <> 'Ordered' then
    raise exception using errcode = '22023', message = 'Purchase order must be placed before receiving stock.';
  end if;
  if jsonb_typeof(p_receipts) <> 'array' or jsonb_array_length(p_receipts) = 0 then
    raise exception using errcode = '22023', message = 'At least one receipt line is required.';
  end if;

  for v_receipt in select * from jsonb_array_elements(p_receipts)
  loop
    select * into v_item from public.purchase_order_items
    where id = (v_receipt->>'item_id')::bigint
      and purchase_order_id = p_purchase_order_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Purchase order line not found.';
    end if;
    v_received := (v_receipt->>'quantity')::integer;
    if v_received is null or v_received <= 0 or v_received > v_item.quantity - v_item.received_quantity then
      raise exception using errcode = '22023', message = 'Receipt quantity exceeds the outstanding line quantity.';
    end if;

    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Product not found for purchase order line.';
    end if;
    v_resulting_quantity := v_product.quantity + v_received;
    update public.products set quantity = v_resulting_quantity, updated_at = now()
    where id = v_product.id;
    update public.purchase_order_items
    set received_quantity = received_quantity + v_received, updated_at = now()
    where id = v_item.id;
    insert into public.stock_movements (product_id, movement_type, quantity, created_at)
    values (v_product.id, 'IN', v_received, now());
    v_any_received := true;
  end loop;

  select bool_and(received_quantity = quantity), bool_or(received_quantity > 0)
  into v_all_received, v_any_received
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;
  update public.purchase_orders
  set status = case when v_all_received then 'Received' else 'Ordered' end
  where id = p_purchase_order_id;

  insert into public.purchase_order_receipts (purchase_order_id, idempotency_key, quantities)
  values (p_purchase_order_id, p_idempotency_key, p_receipts);

  update public.stock_operation_requests
  set result = jsonb_build_object(
    'duplicate', false,
    'purchase_order_id', p_purchase_order_id,
    'status', case when v_all_received then 'Received' else 'Ordered' end,
    'received', v_any_received
  )
  where idempotency_key = 'purchase_order_receipt:' || p_idempotency_key;

  return jsonb_build_object(
    'duplicate', false,
    'purchase_order_id', p_purchase_order_id,
    'status', case when v_all_received then 'Received' else 'Ordered' end,
    'received', v_any_received
  );
end;
$$;

revoke all on table public.stock_operation_requests from public;
revoke all on function public.record_stock_movement(bigint, text, integer, text, text, text, text) from public;
revoke all on function public.receive_purchase_order(bigint, jsonb, text) from public;

-- The backend uses a server-only Supabase service-role/secret key.
grant execute on function public.record_stock_movement(bigint, text, integer, text, text, text, text) to service_role;
grant execute on function public.receive_purchase_order(bigint, jsonb, text) to service_role;

-- Verification after manual execution:
-- select proname from pg_proc where proname in ('record_stock_movement', 'receive_purchase_order');
-- select routine_name, security_type from information_schema.routines
-- where routine_name in ('record_stock_movement', 'receive_purchase_order');

-- Refresh PostgREST's function schema cache after this migration commits.
notify pgrst, 'reload schema';
