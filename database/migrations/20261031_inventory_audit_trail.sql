-- Add an immutable, actor-aware audit record for each stock quantity change.
-- Apply after 20261029_purchase_order_receipts.sql and
-- 20261029_atomic_stock_operations.sql.
-- Requires pgcrypto to be installed already; this migration does not install extensions.

begin;

-- IF NOT EXISTS does not repair an existing table with a partial schema. Fail
-- before applying any DDL so an operator can reconcile that table explicitly
-- without inventing required audit values for existing rows.
do $$
declare
  v_missing_columns text[];
  v_missing_operation_columns text[];
  v_invalid_columns text[];
  v_missing_constraints text[];
  v_incompatible_reference_columns text[];
  v_invalid_prerequisite_columns text[];
  v_missing_prerequisite_defaults text[];
  v_pgcrypto_schema text;
  v_idempotency_key_attnum smallint;
begin
  if to_regprocedure('public.record_stock_movement(bigint,text,integer,text,text,text,text)') is null
    or to_regprocedure('public.receive_purchase_order(bigint,jsonb,text)') is null
    or to_regclass('public.stock_operation_requests') is null then
    raise exception
      'Apply 20261029_atomic_stock_operations.sql before the inventory audit migration.';
  end if;

  select array_agg(format(
    '%s.%s (found %s, nullable=%s; expected one of %s, nullable=%s)',
    required.table_name,
    required.column_name,
    coalesce(existing.data_type, 'missing'),
    coalesce(existing.is_nullable, 'unknown'),
    array_to_string(required.allowed_types, ', '),
    case when required.is_not_null then 'NO' else 'not required' end
  ) order by required.table_name, required.column_name)
  into v_invalid_prerequisite_columns
  from (values
    ('products', 'id', array['smallint','integer','bigint']::text[], true),
    ('products', 'quantity', array['integer']::text[], true),
    ('products', 'updated_at', array['timestamp with time zone','timestamp without time zone']::text[], false),
    ('purchase_orders', 'id', array['smallint','integer','bigint']::text[], true),
    ('purchase_orders', 'status', array['text','character varying']::text[], true),
    ('purchase_order_items', 'id', array['smallint','integer','bigint']::text[], true),
    ('purchase_order_items', 'purchase_order_id', array['smallint','integer','bigint']::text[], true),
    ('purchase_order_items', 'product_id', array['smallint','integer','bigint']::text[], true),
    ('purchase_order_items', 'quantity', array['integer']::text[], true),
    ('purchase_order_items', 'received_quantity', array['integer']::text[], true),
    ('purchase_order_items', 'updated_at', array['timestamp with time zone','timestamp without time zone']::text[], false),
    ('stock_movements', 'id', array['smallint','integer','bigint']::text[], true),
    ('stock_movements', 'product_id', array['smallint','integer','bigint']::text[], true),
    ('stock_movements', 'movement_type', array['text','character varying']::text[], true),
    ('stock_movements', 'quantity', array['integer']::text[], true),
    ('stock_movements', 'note', array['text','character varying']::text[], false),
    ('stock_movements', 'created_at', array['timestamp with time zone','timestamp without time zone']::text[], true),
    ('purchase_order_receipts', 'id', array['bigint']::text[], true),
    ('purchase_order_receipts', 'purchase_order_id', array['smallint','integer','bigint']::text[], true),
    ('purchase_order_receipts', 'idempotency_key', array['text','character varying']::text[], true),
    ('purchase_order_receipts', 'received_at', array['timestamp with time zone']::text[], true),
    ('purchase_order_receipts', 'quantities', array['jsonb']::text[], true),
    ('stock_operation_requests', 'idempotency_key', array['text','character varying']::text[], true),
    ('stock_operation_requests', 'operation_type', array['text','character varying']::text[], true),
    ('stock_operation_requests', 'request_hash', array['text','character varying']::text[], true),
    ('stock_operation_requests', 'result', array['jsonb']::text[], false),
    ('stock_operation_requests', 'created_at', array['timestamp with time zone']::text[], true)
  ) as required(table_name, column_name, allowed_types, is_not_null)
  left join information_schema.columns existing
    on existing.table_schema = 'public'
    and existing.table_name = required.table_name
    and existing.column_name = required.column_name
  where existing.column_name is null
    or existing.data_type <> all(required.allowed_types)
    or (required.is_not_null and existing.is_nullable <> 'NO');

  if v_invalid_prerequisite_columns is not null then
    raise exception
      'Inventory audit migration prerequisites have missing or incompatible columns: %. Verify the prerequisite migrations and schema before retrying.',
      array_to_string(v_invalid_prerequisite_columns, ', ');
  end if;

  select array_agg(format('%s.%s', required.table_name, required.column_name)
    order by required.table_name, required.column_name)
  into v_missing_prerequisite_defaults
  from (values
    ('stock_movements', 'id'),
    ('purchase_order_receipts', 'id'),
    ('purchase_order_receipts', 'received_at'),
    ('stock_operation_requests', 'created_at')
  ) as required(table_name, column_name)
  join information_schema.columns existing
    on existing.table_schema = 'public'
    and existing.table_name = required.table_name
    and existing.column_name = required.column_name
  where existing.column_default is null
    and coalesce(existing.is_identity, 'NO') <> 'YES';

  if v_missing_prerequisite_defaults is not null then
    raise exception
      'Inventory audit migration prerequisites lack required generated/default values for: %. Verify the prerequisite migrations before retrying.',
      array_to_string(v_missing_prerequisite_defaults, ', ');
  end if;

  select array_agg(required.column_name order by required.column_name)
  into v_missing_operation_columns
  from unnest(array['idempotency_key', 'operation_type', 'request_hash', 'result']) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns existing
    where existing.table_schema = 'public'
      and existing.table_name = 'stock_operation_requests'
      and existing.column_name = required.column_name
  );
  if v_missing_operation_columns is not null then
    raise exception
      'public.stock_operation_requests is incomplete (missing columns: %). Apply its prerequisite migration before retrying.',
      array_to_string(v_missing_operation_columns, ', ');
  end if;

  select crypto_namespace.nspname
  into v_pgcrypto_schema
  from pg_catalog.pg_extension crypto_extension
  join pg_catalog.pg_namespace crypto_namespace
    on crypto_namespace.oid = crypto_extension.extnamespace
  where crypto_extension.extname = 'pgcrypto'
    and to_regprocedure(format('%I.digest(bytea,text)', crypto_namespace.nspname)) is not null;
  if v_pgcrypto_schema is null then
    raise exception
      'The pgcrypto extension and its digest(bytea, text) function must already be installed before applying the inventory audit migration.';
  end if;

  select attribute.attnum
  into v_idempotency_key_attnum
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.stock_operation_requests'::regclass
    and attribute.attname = 'idempotency_key'
    and not attribute.attisdropped;
  if not exists (
    select 1
    from pg_catalog.pg_index index_metadata
    where index_metadata.indrelid = 'public.stock_operation_requests'::regclass
      and index_metadata.indisunique
      and index_metadata.indisvalid
      and index_metadata.indisready
      and index_metadata.indpred is null
      and index_metadata.indexprs is null
      and index_metadata.indnkeyatts = 1
      and index_metadata.indkey[0] = v_idempotency_key_attnum
  ) then
    raise exception
      'public.stock_operation_requests.idempotency_key must have a valid, non-partial unique constraint or index.';
  end if;

  select attribute.attnum
  into v_idempotency_key_attnum
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.purchase_order_receipts'::regclass
    and attribute.attname = 'idempotency_key'
    and not attribute.attisdropped;
  if not exists (
    select 1
    from pg_catalog.pg_index index_metadata
    where index_metadata.indrelid = 'public.purchase_order_receipts'::regclass
      and index_metadata.indisunique
      and index_metadata.indisvalid
      and index_metadata.indisready
      and index_metadata.indpred is null
      and index_metadata.indexprs is null
      and index_metadata.indnkeyatts = 1
      and index_metadata.indkey[0] = v_idempotency_key_attnum
  ) then
    raise exception
      'public.purchase_order_receipts.idempotency_key must have a valid, non-partial unique constraint or index.';
  end if;

  select array_agg(format(
    '%s.%s (found %s, expected smallint, integer, or bigint)',
    required.table_name,
    required.column_name,
    coalesce(existing.data_type, 'missing')
  ) order by required.table_name, required.column_name)
  into v_incompatible_reference_columns
  from (values
    ('products', 'id'),
    ('purchase_order_items', 'id'),
    ('purchase_order_items', 'product_id'),
    ('purchase_order_items', 'purchase_order_id'),
    ('purchase_orders', 'id'),
    ('purchase_order_receipts', 'id'),
    ('stock_movements', 'id'),
    ('stock_movements', 'product_id')
  ) as required(table_name, column_name)
  left join information_schema.columns existing
    on existing.table_schema = 'public'
    and existing.table_name = required.table_name
    and existing.column_name = required.column_name
  where existing.column_name is null
    or existing.data_type not in ('smallint', 'integer', 'bigint');

  if v_incompatible_reference_columns is not null then
    raise exception
      'Inventory audit migration requires integer-compatible reference columns: %. Verify prerequisite migrations and schema before retrying.',
      array_to_string(v_incompatible_reference_columns, ', ');
  end if;

  select array_agg(format(
    '%s.%s (found %s, nullable=%s; expected integer, nullable=NO)',
    required.table_name,
    required.column_name,
    coalesce(existing.data_type, 'missing'),
    coalesce(existing.is_nullable, 'unknown')
  ) order by required.table_name, required.column_name)
  into v_invalid_columns
  from (values
    ('products', 'quantity'),
    ('purchase_order_items', 'quantity'),
    ('purchase_order_items', 'received_quantity')
  ) as required(table_name, column_name)
  left join information_schema.columns existing
    on existing.table_schema = 'public'
    and existing.table_name = required.table_name
    and existing.column_name = required.column_name
  where existing.column_name is null
    or existing.data_type is distinct from 'integer'
    or existing.is_nullable is distinct from 'NO';

  if v_invalid_columns is not null then
    raise exception
      'Purchase-order quantity columns must be integer NOT NULL fields: %. Reconcile the schema before retrying.',
      array_to_string(v_invalid_columns, ', ');
  end if;

  if exists (
    select 1
    from public.products
    where quantity is null or quantity < 0
  ) then
    raise exception
      'public.products contains a NULL or negative quantity. Reconcile those rows before applying the inventory audit migration.';
  end if;

  if exists (
    select 1
    from public.purchase_order_items
    where quantity is null
      or received_quantity is null
      or quantity <= 0
      or received_quantity < 0
      or received_quantity > quantity
  ) then
    raise exception
      'public.purchase_order_items contains invalid ordered or received quantities. Reconcile those rows before applying the inventory audit migration.';
  end if;

  select array_agg(
    format('%s.%s (found %s, expected integer)', required.table_name, required.column_name, existing.data_type)
    order by required.table_name, required.column_name
  )
  into v_incompatible_reference_columns
  from (values
    ('products', 'quantity'),
    ('stock_movements', 'quantity'),
    ('purchase_order_items', 'quantity'),
    ('purchase_order_items', 'received_quantity')
  ) as required(table_name, column_name)
  left join information_schema.columns existing
    on existing.table_schema = 'public'
    and existing.table_name = required.table_name
    and existing.column_name = required.column_name
  where existing.column_name is null
    or existing.data_type is distinct from 'integer';

  if v_incompatible_reference_columns is not null then
    raise exception
      'Inventory audit migration requires existing integer quantity columns: %. Verify prerequisite migrations and schema before retrying.',
      array_to_string(v_incompatible_reference_columns, ', ');
  end if;

  if to_regclass('public.inventory_audit_trail') is not null then
    select array_agg(required.column_name order by required.column_name)
    into v_missing_columns
    from unnest(array[
      'id',
      'product_id',
      'actor_user_id',
      'movement_type',
      'quantity_changed',
      'previous_quantity',
      'new_quantity',
      'reason',
      'reference',
      'department',
      'purchase_order_id',
      'receipt_id',
      'stock_movement_id',
      'created_at'
    ]) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns existing
      where existing.table_schema = 'public'
        and existing.table_name = 'inventory_audit_trail'
        and existing.column_name = required.column_name
    );

    if v_missing_columns is not null then
      raise exception
        'Existing public.inventory_audit_trail is incomplete (missing columns: %). Reconcile it without fabricating historical values before rerunning this migration.',
        array_to_string(v_missing_columns, ', ');
    end if;

    select array_agg(format(
      '%s (found %s, nullable=%s; expected %s, nullable=%s)',
      expected.column_name,
      existing.data_type,
      existing.is_nullable,
      coalesce(expected.data_type, referenced.data_type),
      case when expected.is_not_null then 'NO' else 'YES' end
    ) order by expected.column_name)
    into v_invalid_columns
    from (values
      ('id', 'bigint'::text, null::text, null::text, true),
      ('product_id', null::text, 'products'::text, 'id'::text, true),
      ('actor_user_id', 'uuid'::text, null::text, null::text, false),
      ('movement_type', 'text'::text, null::text, null::text, true),
      ('quantity_changed', 'integer'::text, null::text, null::text, true),
      ('previous_quantity', 'integer'::text, null::text, null::text, true),
      ('new_quantity', 'integer'::text, null::text, null::text, true),
      ('reason', 'text'::text, null::text, null::text, true),
      ('reference', 'text'::text, null::text, null::text, false),
      ('department', 'text'::text, null::text, null::text, false),
      ('purchase_order_id', null::text, 'purchase_orders'::text, 'id'::text, false),
      ('receipt_id', null::text, 'purchase_order_receipts'::text, 'id'::text, false),
      ('stock_movement_id', null::text, 'stock_movements'::text, 'id'::text, true),
      ('created_at', 'timestamp with time zone'::text, null::text, null::text, true)
    ) as expected(column_name, data_type, referenced_table, referenced_column, is_not_null)
    left join information_schema.columns referenced
      on referenced.table_schema = 'public'
      and referenced.table_name = expected.referenced_table
      and referenced.column_name = expected.referenced_column
    join information_schema.columns existing
      on existing.table_schema = 'public'
      and existing.table_name = 'inventory_audit_trail'
      and existing.column_name = expected.column_name
    where existing.data_type is distinct from coalesce(expected.data_type, referenced.data_type)
      or (existing.is_nullable = 'NO') is distinct from expected.is_not_null;

    if v_invalid_columns is not null then
      raise exception
        'Existing public.inventory_audit_trail has incompatible column types or nullability: %. Reconcile it before rerunning this migration.',
        array_to_string(v_invalid_columns, ', ');
    end if;

    select array_agg(required.constraint_name order by required.constraint_name)
    into v_missing_constraints
    from (values
      ('inventory_audit_trail_pkey', 'p', 'id', null, null, null),
      ('inventory_audit_trail_product_id_fkey', 'f', 'product_id', 'products', 'id', 'r'),
      ('inventory_audit_trail_purchase_order_id_fkey', 'f', 'purchase_order_id', 'purchase_orders', 'id', 'r'),
      ('inventory_audit_trail_receipt_id_fkey', 'f', 'receipt_id', 'purchase_order_receipts', 'id', 'r'),
      ('inventory_audit_trail_stock_movement_id_fkey', 'f', 'stock_movement_id', 'stock_movements', 'id', 'r'),
      ('inventory_audit_trail_stock_movement_id_key', 'u', 'stock_movement_id', null, null, null)
    ) as required(constraint_name, constraint_type, local_column, referenced_table, referenced_column, delete_action)
    where not exists (
      select 1
      from pg_constraint existing
      join pg_attribute local_attribute
        on local_attribute.attrelid = existing.conrelid
        and local_attribute.attname = required.local_column
        and not local_attribute.attisdropped
      left join pg_attribute referenced_attribute
        on referenced_attribute.attrelid = existing.confrelid
        and referenced_attribute.attname = required.referenced_column
        and not referenced_attribute.attisdropped
      where existing.conrelid = 'public.inventory_audit_trail'::regclass
        and existing.conname = required.constraint_name
        and existing.contype::text = required.constraint_type
        and existing.convalidated
        and existing.conkey = array[local_attribute.attnum]::smallint[]
        and (
          required.constraint_type <> 'f'
          or (
            existing.confrelid = to_regclass('public.' || required.referenced_table)
            and existing.confkey = array[referenced_attribute.attnum]::smallint[]
            and existing.confdeltype::text = required.delete_action
          )
        )
    );

    if v_missing_constraints is not null then
      raise exception
        'Existing public.inventory_audit_trail has missing or incompatible primary key, foreign key, or unique constraints: %. Reconcile it before rerunning this migration.',
        array_to_string(v_missing_constraints, ', ');
    end if;

    select array_agg(required.constraint_name order by required.constraint_name)
    into v_missing_constraints
    from (values
      ('inventory_audit_trail_movement_type_check',
        'movement_type=any(array[''IN''::text,''OUT''::text,''ADJUSTMENT''::text,''RECEIPT''::text])'),
      ('inventory_audit_trail_quantity_changed_check', 'quantity_changed<>0'),
      ('inventory_audit_trail_previous_quantity_check', 'previous_quantity>=0'),
      ('inventory_audit_trail_new_quantity_check', 'new_quantity>=0'),
      ('inventory_audit_trail_reason_check', 'length(btrim(reason))>0'),
      ('inventory_audit_quantity_balance_check', 'new_quantity=previous_quantity+quantity_changed'),
      ('inventory_audit_movement_quantity_check',
        'movement_type=any(array[''in''::text,''receipt''::text])andquantity_changed>0ormovement_type=''out''::textandquantity_changed<0ormovement_type=''adjustment''::text')
    ) as required(constraint_name, normalized_definition)
    where not exists (
      select 1
      from pg_constraint existing
      where existing.conrelid = 'public.inventory_audit_trail'::regclass
        and existing.conname = required.constraint_name
        and existing.contype = 'c'
        and existing.convalidated
        and regexp_replace(
          lower(pg_get_expr(existing.conbin, existing.conrelid)),
          '[[:space:]()]',
          '',
          'g'
        ) = regexp_replace(
          lower(required.normalized_definition),
          '[[:space:]()]',
          '',
          'g'
        )
    );

    if v_missing_constraints is not null then
      raise exception
        'Existing public.inventory_audit_trail has missing or incompatible check constraints: %. Reconcile it before rerunning this migration.',
        array_to_string(v_missing_constraints, ', ');
    end if;
  end if;
end;
$$;

do $$
declare
  v_product_id_type text;
  v_purchase_order_id_type text;
  v_receipt_id_type text;
  v_stock_movement_id_type text;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_product_id_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.products'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_purchase_order_id_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.purchase_orders'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_receipt_id_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.purchase_order_receipts'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_stock_movement_id_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.stock_movements'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  execute format($ddl$
    create table if not exists public.inventory_audit_trail (
      id bigint generated by default as identity primary key,
      product_id %s not null references public.products(id) on delete restrict,
      actor_user_id uuid,
      movement_type text not null
        check (movement_type in ('IN', 'OUT', 'ADJUSTMENT', 'RECEIPT')),
      quantity_changed integer not null check (quantity_changed <> 0),
      previous_quantity integer not null check (previous_quantity >= 0),
      new_quantity integer not null check (new_quantity >= 0),
      reason text not null check (length(btrim(reason)) > 0),
      reference text,
      department text,
      purchase_order_id %s references public.purchase_orders(id) on delete restrict,
      receipt_id %s references public.purchase_order_receipts(id) on delete restrict,
      stock_movement_id %s not null unique
        references public.stock_movements(id) on delete restrict,
      created_at timestamptz not null default now(),
      constraint inventory_audit_quantity_balance_check
        check (new_quantity = previous_quantity + quantity_changed),
      constraint inventory_audit_movement_quantity_check
        check (
          (movement_type in ('IN', 'RECEIPT') and quantity_changed > 0)
          or (movement_type = 'OUT' and quantity_changed < 0)
          or movement_type = 'ADJUSTMENT'
        )
    )
  $ddl$,
    v_product_id_type,
    v_purchase_order_id_type,
    v_receipt_id_type,
    v_stock_movement_id_type
  );
end;
$$;

-- Keep the Auth UUID as historical attribution if its Auth user is removed.
-- This also upgrades a previously-created version of this additive table.
alter table public.inventory_audit_trail
  drop constraint if exists inventory_audit_trail_actor_user_id_fkey;

alter table public.inventory_audit_trail owner to postgres;

create index if not exists inventory_audit_created_at_idx
  on public.inventory_audit_trail (created_at desc, id desc);
create index if not exists inventory_audit_product_created_at_idx
  on public.inventory_audit_trail (product_id, created_at desc);
create index if not exists inventory_audit_actor_created_at_idx
  on public.inventory_audit_trail (actor_user_id, created_at desc);
create index if not exists inventory_audit_type_created_at_idx
  on public.inventory_audit_trail (movement_type, created_at desc);

alter table public.inventory_audit_trail enable row level security;
revoke all on table public.inventory_audit_trail from public, anon, authenticated, service_role;
grant select on table public.inventory_audit_trail to service_role;

drop policy if exists inventory_audit_service_role_read
  on public.inventory_audit_trail;
create policy inventory_audit_service_role_read
  on public.inventory_audit_trail
  for select
  to service_role
  using (true);

-- The API continues to call record_stock_movement by name, but now supplies
-- the verified actor so the stock update, movement, audit row, and idempotency
-- result commit or roll back together in this RPC transaction.
create or replace function public.record_stock_movement(
  p_product_id bigint,
  p_movement_type text,
  p_quantity integer,
  p_reference text,
  p_department text,
  p_remarks text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_delta integer;
  v_resulting_quantity integer;
  v_resulting_quantity_wide bigint;
  v_movement_id bigint;
  v_audit_id bigint;
  v_idempotency_key text;
  v_request_hash text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_note text;
  v_result jsonb;
  v_ledger_type text;
  v_reason text;
  v_pgcrypto_schema text;
  v_request_payload text;
begin
  if p_product_id is null or p_product_id <= 0 then
    raise exception using errcode = '22023', message = 'Product ID must be a positive integer.';
  end if;
  if p_movement_type is null or p_movement_type not in ('IN', 'OUT', 'ADJUSTMENT') then
    raise exception using errcode = '22023', message = 'Movement type must be IN, OUT, or ADJUSTMENT.';
  end if;
  if p_quantity is null or p_quantity = 0
    or p_quantity < -2147483647 or p_quantity > 2147483647
    or (p_movement_type in ('IN', 'OUT') and p_quantity < 0) then
    raise exception using errcode = '22023', message = 'Movement quantity is invalid.';
  end if;
  if p_actor_user_id is null or not exists (
    select 1 from auth.users where id = p_actor_user_id
  ) then
    raise exception using errcode = '22023', message = 'A verified application user is required.';
  end if;
  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) = 0
    or length(trim(p_idempotency_key)) > 200 then
    raise exception using errcode = '22023', message = 'A valid idempotency key is required.';
  end if;
  if length(coalesce(p_reference, '')) > 200
    or length(coalesce(p_department, '')) > 100
    or length(coalesce(p_remarks, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Stock movement details exceed the allowed length.';
  end if;
  if p_movement_type = 'ADJUSTMENT' and length(trim(coalesce(p_remarks, ''))) = 0 then
    raise exception using errcode = '22023', message = 'A reason is required for stock adjustments.';
  end if;

  v_delta := case
    when p_movement_type = 'IN' then p_quantity
    when p_movement_type = 'OUT' then -p_quantity
    else p_quantity
  end;
  v_ledger_type := case
  when p_movement_type = 'ADJUSTMENT' then 'ADJUSTMENT'
  when v_delta > 0 then 'IN'
  else 'OUT'
  end;
  v_idempotency_key := 'stock_movement:' || trim(p_idempotency_key);
  v_request_payload := jsonb_build_object(
    'product_id', p_product_id,
    'movement_type', p_movement_type,
    'quantity', p_quantity,
    'reference', coalesce(p_reference, ''),
    'department', coalesce(p_department, ''),
    'remarks', coalesce(p_remarks, ''),
    'actor_user_id', p_actor_user_id
  )::text;
  select crypto_namespace.nspname
  into v_pgcrypto_schema
  from pg_catalog.pg_extension crypto_extension
  join pg_catalog.pg_namespace crypto_namespace
    on crypto_namespace.oid = crypto_extension.extnamespace
  where crypto_extension.extname = 'pgcrypto';
  if v_pgcrypto_schema is null then
    raise exception using errcode = '55000', message = 'The pgcrypto digest function is unavailable.';
  end if;
  execute format(
    'select encode(%I.digest(convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
    v_pgcrypto_schema
  )
  into v_request_hash
  using v_request_payload;

  insert into public.stock_operation_requests (idempotency_key, operation_type, request_hash)
  values (v_idempotency_key, 'stock_movement', v_request_hash)
  on conflict (idempotency_key) do nothing;
  if not found then
    select request_hash, result into v_existing_hash, v_existing_result
    from public.stock_operation_requests
    where idempotency_key = v_idempotency_key;
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

  v_resulting_quantity_wide := v_product.quantity::bigint + v_delta::bigint;
  if v_resulting_quantity_wide < 0 or v_resulting_quantity_wide > 2147483647 then
    raise exception using errcode = '22003', message = 'Stock movement would exceed the supported inventory quantity range.';
  end if;
  v_resulting_quantity := v_resulting_quantity_wide::integer;
  v_reason := coalesce(
    nullif(trim(p_remarks), ''),
    nullif(trim(p_reference), ''),
    case when p_movement_type = 'ADJUSTMENT' then 'Stock adjustment' else 'Manual stock movement' end
  );
  v_note := jsonb_build_object(
    'format', 'inventra.stock-movement',
    'version', 2,
    'movementType', p_movement_type,
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
  values (p_product_id, v_ledger_type, abs(v_delta), v_note, now())
  returning id into v_movement_id;

  insert into public.inventory_audit_trail (
    product_id, actor_user_id, movement_type, quantity_changed,
    previous_quantity, new_quantity, reason, reference, department,
    stock_movement_id
  )
  values (
    p_product_id, p_actor_user_id, p_movement_type, v_delta,
    v_product.quantity, v_resulting_quantity, v_reason,
    nullif(trim(p_reference), ''), nullif(trim(p_department), ''),
    v_movement_id
  )
  returning id into v_audit_id;

  v_result := jsonb_build_object(
    'duplicate', false,
    'movement_id', v_movement_id,
    'audit_id', v_audit_id,
    'product_id', p_product_id,
    'reference', coalesce(p_reference, ''),
    'department', coalesce(p_department, ''),
    'remarks', coalesce(p_remarks, ''),
    'previous_quantity', v_product.quantity,
    'resulting_quantity', v_resulting_quantity,
    'quantity_changed', v_delta
  );
  update public.stock_operation_requests
  set result = v_result
  where idempotency_key = v_idempotency_key;

  return v_result;
end;
$$;

create or replace function public.receive_audited_purchase_order(
  p_purchase_order_id bigint,
  p_receipts jsonb,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_receipt jsonb;
  v_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_received integer;
  v_received_wide bigint;
  v_resulting_quantity integer;
  v_resulting_quantity_wide bigint;
  v_all_received boolean;
  v_any_received boolean;
  v_request_hash text;
  v_existing_hash text;
  v_receipt_id bigint;
  v_existing_result jsonb;
  v_movement_id bigint;
  v_audit_entry jsonb;
  v_audit_entries jsonb := '[]'::jsonb;
  v_pgcrypto_schema text;
  v_request_payload text;
  v_outstanding bigint;
  v_requested_item_count integer;
  v_locked_item_count integer := 0;
  v_requested_product_count integer;
  v_locked_product_count integer := 0;
begin
  if p_purchase_order_id is null or p_purchase_order_id <= 0 then
    raise exception using errcode = '22023', message = 'Purchase order ID must be a positive integer.';
  end if;
  if p_actor_user_id is null or not exists (
    select 1 from auth.users where id = p_actor_user_id
  ) then
    raise exception using errcode = '22023', message = 'A verified application user is required.';
  end if;
  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) = 0
    or length(trim(p_idempotency_key)) > 200 then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts) <> 'array' or jsonb_array_length(p_receipts) = 0 then
    raise exception using errcode = '22023', message = 'At least one receipt line is required.';
  end if;

  for v_receipt in select entry.value from jsonb_array_elements(p_receipts) as entry(value)
  loop
    if jsonb_typeof(v_receipt) is distinct from 'object'
      or coalesce(v_receipt->>'item_id', '') !~ '^[1-9][0-9]*$'
      or coalesce(v_receipt->>'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '22023', message = 'Receipt line values must be positive integers.';
    end if;
    if length(v_receipt->>'item_id') > 19
      or (
        length(v_receipt->>'item_id') = 19
        and (v_receipt->>'item_id') > '9223372036854775807'
      ) then
      raise exception using errcode = '22023', message = 'Receipt item IDs exceed the supported range.';
    end if;
    if length(v_receipt->>'quantity') > 10
      or (
        length(v_receipt->>'quantity') = 10
        and (v_receipt->>'quantity') > '2147483647'
      ) then
      raise exception using errcode = '22023', message = 'Receipt quantities exceed the supported integer range.';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_receipts) as entry(value)
    group by entry.value->>'item_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A receipt request may contain only one line per purchase order item.';
  end if;

  v_request_payload := jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'receipts', p_receipts,
    'actor_user_id', p_actor_user_id
  )::text;
  select crypto_namespace.nspname
  into v_pgcrypto_schema
  from pg_catalog.pg_extension crypto_extension
  join pg_catalog.pg_namespace crypto_namespace
    on crypto_namespace.oid = crypto_extension.extnamespace
  where crypto_extension.extname = 'pgcrypto';
  if v_pgcrypto_schema is null then
    raise exception using errcode = '55000', message = 'The pgcrypto digest function is unavailable.';
  end if;
  execute format(
    'select encode(%I.digest(convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
    v_pgcrypto_schema
  )
  into v_request_hash
  using v_request_payload;
  insert into public.stock_operation_requests (idempotency_key, operation_type, request_hash)
  values ('purchase_order_receipt:' || trim(p_idempotency_key), 'purchase_order_receipt', v_request_hash)
  on conflict (idempotency_key) do nothing;
  if not found then
    select request_hash, result into v_existing_hash, v_existing_result
    from public.stock_operation_requests
    where idempotency_key = 'purchase_order_receipt:' || trim(p_idempotency_key);
    if v_existing_hash is distinct from v_request_hash then
      raise exception using errcode = '22023', message = 'Idempotency key was already used with a different receipt request.';
    end if;
    return coalesce(v_existing_result, jsonb_build_object('duplicate', true))
      || jsonb_build_object('duplicate', true);
  end if;

  select * into v_order from public.purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order not found.';
  end if;
  if v_order.status is distinct from 'Ordered' then
    raise exception using errcode = '22023', message = 'Purchase order must be placed before receiving stock.';
  end if;

  select count(distinct (entry.value->>'item_id')::bigint)
  into v_requested_item_count
  from jsonb_array_elements(p_receipts) as entry(value);

  for v_item in
    select item.*
    from public.purchase_order_items as item
    where item.purchase_order_id = p_purchase_order_id
      and item.id in (
        select distinct (entry.value->>'item_id')::bigint
        from jsonb_array_elements(p_receipts) as entry(value)
      )
    order by item.product_id, item.id
    for update of item
  loop
    v_locked_item_count := v_locked_item_count + 1;
    if v_item.quantity is null
      or v_item.received_quantity is null
      or v_item.quantity <= 0
      or v_item.received_quantity < 0
      or v_item.received_quantity > v_item.quantity then
      raise exception using errcode = '22023', message = 'Purchase order line has invalid outstanding quantities.';
    end if;
  end loop;

  if v_locked_item_count <> v_requested_item_count then
    raise exception using errcode = 'P0002', message = 'Purchase order line not found.';
  end if;

  select count(distinct item.product_id)
  into v_requested_product_count
  from public.purchase_order_items as item
  where item.purchase_order_id = p_purchase_order_id
    and item.id in (
      select distinct (entry.value->>'item_id')::bigint
      from jsonb_array_elements(p_receipts) as entry(value)
    );

  for v_product in
    select product.*
    from public.products as product
    where product.id in (
      select distinct item.product_id
      from public.purchase_order_items as item
      where item.purchase_order_id = p_purchase_order_id
        and item.id in (
          select distinct (entry.value->>'item_id')::bigint
          from jsonb_array_elements(p_receipts) as entry(value)
        )
    )
    order by product.id
    for update of product
  loop
    v_locked_product_count := v_locked_product_count + 1;
    if v_product.quantity is null or v_product.quantity < 0 then
      raise exception using errcode = '22023', message = 'Product has an invalid stock quantity.';
    end if;
  end loop;

  if v_locked_product_count <> v_requested_product_count then
    raise exception using errcode = 'P0002', message = 'Product not found for purchase order line.';
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
    if v_item.quantity is null
      or v_item.received_quantity is null
      or v_item.quantity <= 0
      or v_item.received_quantity < 0
      or v_item.received_quantity > v_item.quantity then
      raise exception using errcode = '22023', message = 'Purchase order line has invalid outstanding quantities.';
    end if;
    v_outstanding := v_item.quantity::bigint - v_item.received_quantity::bigint;
    if v_outstanding <= 0 then
      raise exception using errcode = '22023', message = 'Purchase order line has no outstanding quantity.';
    end if;
    v_received_wide := (v_receipt->>'quantity')::bigint;
    if v_received_wide > 2147483647 then
      raise exception using errcode = '22023', message = 'Receipt quantities must be within the supported integer range.';
    end if;
    v_received := v_received_wide::integer;
    if v_received <= 0 or v_received::bigint > v_outstanding then
      raise exception using errcode = '22023', message = 'Receipt quantity exceeds the outstanding line quantity.';
    end if;

    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Product not found for purchase order line.';
    end if;
    v_resulting_quantity_wide := v_product.quantity::bigint + v_received::bigint;
    if v_resulting_quantity_wide > 2147483647 then
      raise exception using errcode = '22003', message = 'Receipt would exceed the supported inventory quantity range.';
    end if;
    v_resulting_quantity := v_resulting_quantity_wide::integer;
    update public.products set quantity = v_resulting_quantity, updated_at = now()
    where id = v_product.id;
    update public.purchase_order_items
    set received_quantity = received_quantity + v_received, updated_at = now()
    where id = v_item.id;

    insert into public.stock_movements (product_id, movement_type, quantity, note, created_at)
    values (
      v_product.id, 'IN', v_received,
      jsonb_build_object(
        'format', 'inventra.stock-movement',
        'version', 2,
        'movementType', 'RECEIPT',
        'reference', 'PO-' || p_purchase_order_id::text,
        'department', '',
        'remarks', 'Purchase order receipt',
        'previousQuantity', v_product.quantity,
        'resultingQuantity', v_resulting_quantity
      )::text,
      now()
    )
    returning id into v_movement_id;

    v_audit_entries := v_audit_entries || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'movement_id', v_movement_id,
      'quantity', v_received,
      'previous_quantity', v_product.quantity,
      'new_quantity', v_resulting_quantity
    ));
  end loop;

  select bool_and(received_quantity = quantity), bool_or(received_quantity > 0)
  into v_all_received, v_any_received
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;
  update public.purchase_orders
  set status = case when v_all_received then 'Received' else 'Ordered' end
  where id = p_purchase_order_id;

  insert into public.purchase_order_receipts (purchase_order_id, idempotency_key, quantities)
  values (p_purchase_order_id, trim(p_idempotency_key), p_receipts)
  returning id into v_receipt_id;

  for v_audit_entry in select * from jsonb_array_elements(v_audit_entries)
  loop
    insert into public.inventory_audit_trail (
      product_id, actor_user_id, movement_type, quantity_changed,
      previous_quantity, new_quantity, reason, reference,
      purchase_order_id, receipt_id, stock_movement_id
    )
    values (
      (v_audit_entry->>'product_id')::bigint,
      p_actor_user_id,
      'RECEIPT',
      (v_audit_entry->>'quantity')::integer,
      (v_audit_entry->>'previous_quantity')::integer,
      (v_audit_entry->>'new_quantity')::integer,
      'Purchase order receipt',
      'PO-' || p_purchase_order_id::text,
      p_purchase_order_id,
      v_receipt_id,
      (v_audit_entry->>'movement_id')::bigint
    );
  end loop;

  update public.stock_operation_requests
  set result = jsonb_build_object(
    'duplicate', false,
    'purchase_order_id', p_purchase_order_id,
    'receipt_id', v_receipt_id,
    'status', case when v_all_received then 'Received' else 'Ordered' end,
    'received', v_any_received
  )
  where idempotency_key = 'purchase_order_receipt:' || trim(p_idempotency_key);

  return jsonb_build_object(
    'duplicate', false,
    'purchase_order_id', p_purchase_order_id,
    'receipt_id', v_receipt_id,
    'status', case when v_all_received then 'Received' else 'Ordered' end,
    'received', v_any_received
  );
end;
$$;

revoke all on function public.receive_audited_purchase_order(bigint, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_stock_movement(bigint, text, integer, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.receive_purchase_order(bigint, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.record_stock_movement(bigint, text, integer, text, text, text, text, uuid)
  from public, anon, authenticated;
alter function public.record_stock_movement(bigint, text, integer, text, text, text, text, uuid)
  owner to postgres;
alter function public.receive_audited_purchase_order(bigint, jsonb, text, uuid)
  owner to postgres;
grant execute on function public.record_stock_movement(bigint, text, integer, text, text, text, text, uuid)
  to service_role;
grant execute on function public.receive_audited_purchase_order(bigint, jsonb, text, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
