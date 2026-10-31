const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  parseAuditFilters,
  validateStockMovementBody,
} = require("../lib/stockMovementValidation");

const root = path.join(__dirname, "..", "..");

test("validates manual stock in/out and signed adjustments", () => {
  assert.equal(validateStockMovementBody({
    productId: 12,
    type: "Stock in",
    quantity: 5,
    idempotencyKey: "in-key",
  }).value.movementType, "IN");
  assert.equal(validateStockMovementBody({
    productId: "12",
    type: "Stock out",
    quantity: "3",
    idempotencyKey: "out-key",
  }).value.movementType, "OUT");
  const adjustment = validateStockMovementBody({
    productId: 12,
    type: "Adjustment",
    quantity: -2,
    idempotencyKey: "adjustment-key",
    remarks: "Correct count",
  });
  assert.equal(adjustment.value.movementType, "ADJUSTMENT");
  assert.equal(adjustment.value.quantity, -2);
  assert.ok(validateStockMovementBody({
    productId: 12,
    type: "Adjustment",
    quantity: 2,
    idempotencyKey: "adjustment-without-reason",
  }).error);
});

test("rejects zero, out-of-range, and directionally invalid stock changes", () => {
  const validBase = { productId: 1, idempotencyKey: "key" };
  assert.match(validateStockMovementBody({ ...validBase, type: "Adjustment", quantity: 0 }).error, /non-zero/);
  assert.ok(validateStockMovementBody({ ...validBase, type: "Adjustment", quantity: 2147483648 }).error);
  assert.ok(validateStockMovementBody({ ...validBase, type: "Stock out", quantity: -1 }).error);
  assert.ok(validateStockMovementBody({ productId: 1, type: "Stock in", quantity: 1 }).error);
});

test("validates audit pagination, filters, and date range", () => {
  const parsed = parseAuditFilters({
    limit: "25",
    offset: "50",
    productId: "8",
    movementType: "receipt",
    userId: "d555a2f5-09e1-4f13-a79d-c69f6df4a302",
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(parsed.value.limit, 25);
  assert.equal(parsed.value.offset, 50);
  assert.equal(parsed.value.movementType, "RECEIPT");
  assert.equal(parseAuditFilters({ search: "Widget-A1" }).value.search, "Widget-A1");
  assert.ok(parseAuditFilters({ search: "x),id.eq.1" }).error);
  assert.equal(parseAuditFilters({ userId: "not-a-uuid" }).error, "User ID filter must be a valid UUID.");
  assert.ok(parseAuditFilters({ from: "2026-02-30" }).error);
  assert.ok(parseAuditFilters({ from: "2026-10-10", to: "2026-10-01" }).error);
});

test("manual IN, OUT, and adjustment writes audit in the existing stock RPC", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const manual = migration.split("create or replace function public.record_stock_movement")[1]
    .split("create or replace function public.receive_audited_purchase_order")[0];
  assert.match(manual, /p_movement_type not in \('IN', 'OUT', 'ADJUSTMENT'\)/i);
  assert.match(manual, /'actor_user_id',\s*p_actor_user_id/i);
  assert.match(manual, /update public\.products/i);
  assert.match(manual, /insert into public\.stock_movements/i);
  assert.match(manual, /insert into public\.inventory_audit_trail/i);
  assert.match(manual, /v_resulting_quantity_wide < 0/i);
  assert.match(manual, /p_quantity < -2147483647/i);
  assert.match(manual, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(manual, /v_existing_hash is distinct from v_request_hash/i);
  assert.match(manual, /'quantity_changed', v_delta/i);
  assert.match(manual, /v_delta := case[\s\S]*when p_movement_type = 'OUT' then -p_quantity[\s\S]*else p_quantity/i);
  assert.ok(
    manual.indexOf("update public.products")
      < manual.indexOf("insert into public.stock_movements")
      && manual.indexOf("insert into public.stock_movements")
      < manual.indexOf("insert into public.inventory_audit_trail"),
  );
  assert.doesNotMatch(manual, /exception\s+when/i);

  const existingMigration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261029_atomic_stock_operations.sql"),
    "utf8",
  );
  assert.match(existingMigration, /create or replace function public\.record_stock_movement\(/i);
  assert.match(migration, /revoke all on function public\.record_stock_movement\(bigint, text, integer, text, text, text, text\)/i);
  assert.match(migration, /revoke all on function public\.receive_purchase_order\(bigint, jsonb, text\)/i);
  assert.match(migration, /alter table public\.inventory_audit_trail enable row level security/i);
});

test("purchase-order receiving audits stock, movement, receipt and idempotency atomically", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.receive_audited_purchase_order")[0]
    .replace(/\r\n/g, "\n");
  assert.match(receipt, /update public\.products/i);
  assert.match(receipt, /update public\.purchase_order_items/i);
  assert.match(receipt, /insert into public\.stock_movements/i);
  assert.match(receipt, /insert into public\.purchase_order_receipts/i);
  assert.match(receipt, /insert into public\.inventory_audit_trail/i);
  assert.match(receipt, /p_actor_user_id/i);
  assert.match(receipt, /purchase_order_id,\s*receipt_id,\s*stock_movement_id/i);
  assert.match(receipt, /for update/i);
  assert.match(receipt, /outstanding line quantity/i);
  assert.match(receipt, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(receipt, /select request_hash,\s*result into v_existing_hash,\s*v_existing_result/i);
  assert.ok(
    receipt.indexOf("update public.products")
      < receipt.indexOf("insert into public.stock_movements")
      && receipt.indexOf("insert into public.stock_movements")
      < receipt.indexOf("insert into public.purchase_order_receipts")
      && receipt.indexOf("insert into public.purchase_order_receipts")
      < receipt.indexOf("insert into public.inventory_audit_trail"),
  );
  assert.doesNotMatch(receipt, /exception\s+when/i);
  assert.match(migration, /new_quantity = previous_quantity \+ quantity_changed/i);
  assert.match(migration, /alter table public\.inventory_audit_trail enable row level security/i);
});

test("receipt audit attribution survives Auth deletion and its idempotency hash binds the actor", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.receive_audited_purchase_order")[0];
  assert.match(migration, /actor_user_id uuid,\s*movement_type/i);
  assert.match(migration, /drop constraint if exists inventory_audit_trail_actor_user_id_fkey/i);
  assert.match(receipt, /'actor_user_id',\s*p_actor_user_id/i);
  assert.doesNotMatch(migration, /v_legacy_request_hash/i);
  assert.match(receipt, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(receipt, /v_existing_hash is distinct from v_request_hash/i);
});

test("existing incomplete audit tables fail clearly without fabricating historical values", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  assert.match(migration, /to_regclass\('public\.inventory_audit_trail'\) is not null/i);
  assert.match(migration, /information_schema\.columns/i);
  assert.match(migration, /Existing public\.inventory_audit_trail is incomplete/i);
  assert.match(migration, /has incompatible column types or nullability/i);
  assert.match(migration, /requires integer-compatible reference columns/i);
  assert.match(migration, /format_type\(attribute\.atttypid, attribute\.atttypmod\)/i);
  assert.match(migration, /execute format\(\$ddl\$[\s\S]*create table if not exists public\.inventory_audit_trail/i);
  assert.match(migration, /nullable=%s/i);
  assert.match(migration, /existing\.convalidated/i);
  assert.match(migration, /existing\.confrelid = to_regclass/i);
  assert.match(migration, /existing\.confdeltype::text = required\.delete_action/i);
  assert.match(migration, /existing\.contype = 'c'/i);
  assert.match(migration, /pg_get_expr\(existing\.conbin, existing\.conrelid\)/i);
  assert.match(migration, /has missing or incompatible primary key, foreign key, or unique constraints/i);
  assert.match(migration, /has missing or incompatible check constraints/i);
  assert.match(migration, /movement_type=any\(array\[''IN''::text,''OUT''::text,''ADJUSTMENT''::text,''RECEIPT''::text\]\)/i);
  assert.match(migration, /\('products', 'quantity'\),\s*\('purchase_order_items', 'quantity'\)/i);
  assert.match(migration, /products contains a NULL or negative quantity/i);
  assert.match(migration, /without fabricating historical values/i);
  assert.match(migration, /begin;[\s\S]*?raise exception[\s\S]*?create table if not exists public\.inventory_audit_trail/i);
});

test("migration validates idempotency uniqueness, pgcrypto, and purchase-order quantities", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.receive_audited_purchase_order")[0];
  assert.match(migration, /crypto_extension\.extname = 'pgcrypto'/i);
  assert.match(migration, /digest\(bytea, text\) function must already be installed/i);
  assert.doesNotMatch(migration, /create extension/i);
  assert.match(migration, /index_metadata\.indisunique[\s\S]*?index_metadata\.indisvalid[\s\S]*?index_metadata\.indisready[\s\S]*?index_metadata\.indpred is null[\s\S]*?index_metadata\.indnkeyatts = 1[\s\S]*?index_metadata\.indkey\[0\] = v_idempotency_key_attnum/i);
  assert.match(migration, /\('purchase_order_items', 'quantity'\),\s*\('purchase_order_items', 'received_quantity'\)/i);
  assert.match(migration, /existing\.is_nullable is distinct from 'NO'/i);
  assert.match(migration, /received_quantity > quantity/i);
  assert.match(migration, /v_item\.quantity is null[\s\S]*?v_item\.received_quantity is null[\s\S]*?v_item\.received_quantity > v_item\.quantity/i);
  assert.match(receipt, /v_outstanding := v_item\.quantity::bigint - v_item\.received_quantity::bigint/i);
  assert.match(receipt, /v_outstanding <= 0/i);
  assert.match(receipt, /length\(v_receipt->>'item_id'\) > 19/i);
  assert.match(receipt, /'9223372036854775807'/);
  assert.match(receipt, /length\(v_receipt->>'quantity'\) > 10/i);
  assert.match(receipt, /'2147483647'/);
  assert.match(migration, /''sha256''/i);
  assert.doesNotMatch(migration, /\bmd5\s*\(/i);
});

test("audit migration preflights every RPC prerequisite column and rejects duplicate receipt items", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const preflight = migration.split("select array_agg(format(")[1]
    .split("if v_invalid_prerequisite_columns is not null")[0];
  const requiredColumns = [
    "('products', 'id', array['smallint','integer','bigint']::text[], true)",
    "('products', 'quantity', array['integer']::text[], true)",
    "('products', 'updated_at', array['timestamp with time zone','timestamp without time zone']::text[], false)",
    "('purchase_orders', 'id', array['smallint','integer','bigint']::text[], true)",
    "('purchase_orders', 'status', array['text','character varying']::text[], true)",
    "('purchase_order_items', 'id', array['smallint','integer','bigint']::text[], true)",
    "('purchase_order_items', 'purchase_order_id', array['smallint','integer','bigint']::text[], true)",
    "('purchase_order_items', 'product_id', array['smallint','integer','bigint']::text[], true)",
    "('purchase_order_items', 'quantity', array['integer']::text[], true)",
    "('purchase_order_items', 'received_quantity', array['integer']::text[], true)",
    "('purchase_order_items', 'updated_at', array['timestamp with time zone','timestamp without time zone']::text[], false)",
    "('stock_movements', 'id', array['smallint','integer','bigint']::text[], true)",
    "('stock_movements', 'product_id', array['smallint','integer','bigint']::text[], true)",
    "('stock_movements', 'movement_type', array['text','character varying']::text[], true)",
    "('stock_movements', 'quantity', array['integer']::text[], true)",
    "('stock_movements', 'note', array['text','character varying']::text[], false)",
    "('stock_movements', 'created_at', array['timestamp with time zone','timestamp without time zone']::text[], true)",
    "('purchase_order_receipts', 'id', array['bigint']::text[], true)",
    "('purchase_order_receipts', 'purchase_order_id', array['smallint','integer','bigint']::text[], true)",
    "('purchase_order_receipts', 'idempotency_key', array['text','character varying']::text[], true)",
    "('purchase_order_receipts', 'received_at', array['timestamp with time zone']::text[], true)",
    "('purchase_order_receipts', 'quantities', array['jsonb']::text[], true)",
    "('stock_operation_requests', 'idempotency_key', array['text','character varying']::text[], true)",
    "('stock_operation_requests', 'operation_type', array['text','character varying']::text[], true)",
    "('stock_operation_requests', 'request_hash', array['text','character varying']::text[], true)",
    "('stock_operation_requests', 'result', array['jsonb']::text[], false)",
    "('stock_operation_requests', 'created_at', array['timestamp with time zone']::text[], true)",
  ];
  for (const column of requiredColumns) assert.ok(preflight.includes(column), `Missing prerequisite validation: ${column}`);
  assert.match(preflight, /existing\.data_type <> all\(required\.allowed_types\)/i);
  assert.match(preflight, /required\.is_not_null and existing\.is_nullable <> 'NO'/i);
  assert.match(preflight, /existing\.column_name is null/i);
  assert.match(migration, /stock_movements', 'id'\)[\s\S]*?purchase_order_receipts', 'id'\)[\s\S]*?purchase_order_receipts', 'received_at'\)[\s\S]*?stock_operation_requests', 'created_at'\)/i);
  assert.match(migration, /existing\.column_default is null\s+and coalesce\(existing\.is_identity, 'NO'\) <> 'YES'/i);
  assert.match(migration, /purchase_order_receipts\.idempotency_key must have a valid, non-partial unique constraint or index/i);
  assert.match(migration, /group by entry\.value->>'item_id'\s+having count\(\*\) > 1/i);
  assert.match(migration, /only one line per purchase order item/i);
});

test("backend RPC calls exactly match audited migration signatures", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const stockRoute = fs.readFileSync(path.join(root, "backend", "routes", "stockMovementRoutes.js"), "utf8");
  const purchaseOrderRoute = fs.readFileSync(path.join(root, "backend", "routes", "purchaseOrderRoutes.js"), "utf8");
  assert.match(migration, /function public\.record_stock_movement\(\s*p_product_id bigint,\s*p_movement_type text,\s*p_quantity integer,\s*p_reference text,\s*p_department text,\s*p_remarks text,\s*p_idempotency_key text,\s*p_actor_user_id uuid\s*\)/i);
  assert.match(migration, /function public\.receive_audited_purchase_order\(\s*p_purchase_order_id bigint,\s*p_receipts jsonb,\s*p_idempotency_key text,\s*p_actor_user_id uuid\s*\)/i);
  for (const argument of [
    "p_product_id", "p_movement_type", "p_quantity", "p_reference",
    "p_department", "p_remarks", "p_idempotency_key", "p_actor_user_id",
  ]) {
    assert.match(stockRoute, new RegExp(`${argument}:`));
  }
  for (const argument of ["p_purchase_order_id", "p_receipts", "p_idempotency_key", "p_actor_user_id"]) {
    assert.match(purchaseOrderRoute, new RegExp(`${argument}:`));
  }
  assert.match(stockRoute, /p_actor_user_id:\s*req\.user\.id/);
  assert.match(purchaseOrderRoute, /p_actor_user_id:\s*req\.user\.id/);
});

test("purchase-order receipt retries keep secure idempotency and safely validate IDs/errors", () => {
  const purchaseOrderRoute = fs.readFileSync(path.join(root, "backend", "routes", "purchaseOrderRoutes.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "frontend", "src", "App.jsx"), "utf8");
  const purchaseOrderService = fs.readFileSync(path.join(root, "frontend", "src", "purchaseOrderService.js"), "utf8");
  assert.match(purchaseOrderRoute, /function parseId\(value\)[\s\S]*?Number\.isSafeInteger\(id\) && id > 0/);
  assert.match(purchaseOrderRoute, /error\.code === "P0002"[\s\S]*?console\.error\([\s\S]*?return res\.status\(404\)\.json\(\{ message: "Purchase order, line, or product was not found\." \}\)/);
  assert.doesNotMatch(purchaseOrderRoute, /error\.code === "P0002"[\s\S]{0,100}message:\s*error\.message/);
  assert.match(purchaseOrderService, /createPurchaseOrderReceiptIdempotencyKey/);
  assert.match(purchaseOrderService, /cryptoApi\?\.randomUUID/);
  assert.match(purchaseOrderService, /cryptoApi\?\.getRandomValues/);
  assert.match(app, /pendingReceiptRef = useRef\(null\)/);
  assert.match(app, /pendingReceiptRef\.current\?\.fingerprint !== requestFingerprint/);
  assert.match(app, /JSON\.stringify\(\{ orderId: order\.id, receipts: validReceipts \}\)/);
  assert.match(app, /if \(!receiveForm \|\| receiveSubmitting \|\| receiveSubmissionRef\.current !== null\) return/);
  assert.match(app, /pendingReceiptRef\.current = null\s+setPurchaseOrders/);
  assert.doesNotMatch(app, /receivePurchaseOrder\([\s\S]{0,350}Date\.now\(\)[\s\S]{0,100}Math\.random/);
});

test("receipt locks product rows in stable order and audit rows remain immutable to application roles", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.receive_audited_purchase_order")[0]
    .replace(/\r\n/g, "\n");
  const orderLock = receipt.indexOf("where id = p_purchase_order_id\n  for update");
  const itemLock = receipt.indexOf("for update of item");
  const productLock = receipt.indexOf("order by product.id\n    for update of product");
  const stockUpdate = receipt.indexOf("update public.products set quantity");
  assert.ok(orderLock >= 0 && itemLock > orderLock && productLock > itemLock && stockUpdate > productLock);
  assert.match(migration, /revoke all on table public\.inventory_audit_trail from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant select on table public\.inventory_audit_trail to service_role/i);
  assert.match(migration, /alter table public\.inventory_audit_trail owner to postgres/i);
  assert.match(migration, /purchase_orders\(id\) on delete restrict/i);
  assert.match(migration, /purchase_order_receipts\(id\) on delete restrict/i);
  assert.doesNotMatch(migration, /purchase_orders\(id\) on delete set null/i);
  assert.doesNotMatch(migration, /purchase_order_receipts\(id\) on delete set null/i);
  assert.match(migration, /security definer\s+set search_path = ''[\s\S]*?insert into public\.inventory_audit_trail/i);
  assert.match(migration, /alter function public\.record_stock_movement[\s\S]*?owner to postgres/i);
  assert.match(migration, /alter function public\.receive_audited_purchase_order[\s\S]*?owner to postgres/i);
  assert.match(migration, /revoke all on function public\.record_stock_movement[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.receive_audited_purchase_order[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_stock_movement[\s\S]*?to service_role/i);
  assert.match(migration, /grant execute on function public\.receive_audited_purchase_order[\s\S]*?to service_role/i);
});

test("audit reads are authenticated and database table access is service-role only", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const stockRoute = fs.readFileSync(path.join(root, "backend", "routes", "stockMovementRoutes.js"), "utf8");
  assert.match(migration, /alter table public\.inventory_audit_trail enable row level security/i);
  assert.match(migration, /revoke all on table public\.inventory_audit_trail from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant select on table public\.inventory_audit_trail to service_role/i);
  assert.match(migration, /for select\s+to service_role\s+using \(true\)/i);
  assert.match(server, /app\.use\("\/api", requireAuth, requireRole\("admin", "staff", "viewer"\)/);
  assert.match(stockRoute, /router\.get\("\/audit"/);
  assert.match(stockRoute, /AUDIT_MIGRATION_REQUIRED/);
  assert.match(stockRoute, /products\.name\.ilike/);
  assert.match(stockRoute, /products\.sku\.ilike/);
  assert.match(stockRoute, /reference\.ilike/);
});

test("stock and receipt failures are atomic and enforce quantity boundaries", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const manual = migration.split("create or replace function public.record_stock_movement")[1]
    .split("create or replace function public.receive_audited_purchase_order")[0];
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.record_stock_movement")[0];
  assert.match(manual, /v_resulting_quantity_wide < 0/i);
  assert.match(manual, /p_quantity < -2147483647/i);
  assert.match(manual, /insert into public.inventory_audit_trail/i);
  assert.doesNotMatch(manual, /exception\s+when/i);
  assert.match(receipt, /v_received::bigint > v_outstanding/i);
  assert.match(receipt, /v_resulting_quantity_wide > 2147483647/i);
  assert.match(receipt, /insert into public.inventory_audit_trail/i);
  assert.doesNotMatch(receipt, /exception\s+when/i);
  assert.match(migration, /stock_operation_requests \(idempotency_key, operation_type, request_hash\)/i);
});

test("receipt idempotency returns its persisted receipt result and uses wide quantity arithmetic", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "20261031_inventory_audit_trail.sql"),
    "utf8",
  );
  const receipt = migration.split("create or replace function public.receive_audited_purchase_order")[1]
    .split("revoke all on function public.receive_audited_purchase_order")[0];
  assert.match(receipt, /select request_hash,\s*result into v_existing_hash,\s*v_existing_result/i);
  assert.match(receipt, /coalesce\(v_existing_result,[\s\S]*?\)\s*\|\|\s*jsonb_build_object\('duplicate', true\)/i);
  assert.match(receipt, /'receipt_id', v_receipt_id/i);
  assert.match(receipt, /v_product\.quantity::bigint \+ v_received::bigint/i);
  assert.match(receipt, /v_item\.quantity::bigint - v_item\.received_quantity::bigint/i);
  assert.match(receipt, /v_order\.status is distinct from 'Ordered'/i);
  assert.match(receipt, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(migration, /alter function public\.receive_audited_purchase_order[\s\S]*?owner to postgres/i);
  assert.match(migration, /grant execute on function public\.receive_audited_purchase_order[\s\S]*?to service_role/i);
  assert.match(migration, /revoke all on function public\.receive_audited_purchase_order[\s\S]*?from public, anon, authenticated/i);
});

test("existing stock and audited receipt RPC call paths remain intact", () => {
  const stockRoute = fs.readFileSync(path.join(root, "backend", "routes", "stockMovementRoutes.js"), "utf8");
  const purchaseOrderRoute = fs.readFileSync(path.join(root, "backend", "routes", "purchaseOrderRoutes.js"), "utf8");
  assert.match(stockRoute, /rpc\("record_stock_movement"/);
  assert.match(stockRoute, /p_actor_user_id:\s*req\.user\.id/);
  assert.doesNotMatch(stockRoute, /p_actor_user_id:\s*req\.body/);
  assert.match(purchaseOrderRoute, /receive_audited_purchase_order/);
  assert.match(purchaseOrderRoute, /p_actor_user_id:\s*req\.user\.id/);
});

test("product create/update APIs cannot change stock outside the audited movement route", () => {
  const productRoute = fs.readFileSync(path.join(root, "backend", "routes", "productRoutes.js"), "utf8");
  assert.match(productRoute, /Number\(req\.body\.quantity\)\s*!==\s*0/);
  assert.match(productRoute, /Number\(req\.body\.quantity\)\s*!==\s*Number\(currentProduct\.quantity\)/);
  assert.match(productRoute, /eq\("quantity", currentProduct\.quantity\)/);
});

test("CORS, service credentials, API roles, and audit actors stay on trusted boundaries", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const supabaseConfig = fs.readFileSync(path.join(root, "backend", "config", "supabase.js"), "utf8");
  const stockRoute = fs.readFileSync(path.join(root, "backend", "routes", "stockMovementRoutes.js"), "utf8");
  const purchaseOrderRoute = fs.readFileSync(path.join(root, "backend", "routes", "purchaseOrderRoutes.js"), "utf8");
  const authMiddleware = fs.readFileSync(path.join(root, "backend", "middleware", "auth.js"), "utf8");
  const frontendAuth = fs.readFileSync(path.join(root, "frontend", "src", "authService.js"), "utf8");
  const frontendClient = fs.readFileSync(path.join(root, "frontend", "src", "supabaseClient.js"), "utf8");
  const auditPage = fs.readFileSync(path.join(root, "frontend", "src", "InventoryAuditPage.jsx"), "utf8");

  assert.ok(server.includes(String.raw`/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/`));
  assert.match(server, /allowedOrigins\.includes\(origin\)/);
  assert.ok(server.indexOf('app.use("/api", requireAuth, requireRole("admin", "staff", "viewer")')
    < server.indexOf('app.use("/api/stock-movements", stockMovementRoutes)'));
  assert.match(supabaseConfig, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.match(supabaseConfig, /createClient\(supabaseUrl, supabaseSecretKey\)/);
  assert.doesNotMatch(frontendAuth + frontendClient, /SUPABASE_SECRET_KEY|service_role/i);
  assert.match(stockRoute, /rpc\("record_stock_movement"/);
  assert.match(stockRoute, /p_actor_user_id:\s*req\.user\.id/);
  assert.match(purchaseOrderRoute, /p_actor_user_id:\s*req\.user\.id/);
  assert.match(purchaseOrderRoute, /if \(error\.code === "22023"\)[\s\S]*?Receipt request is invalid or exceeds the outstanding quantity/);
  assert.doesNotMatch(stockRoute, /p_actor_user_id:\s*req\.body/);
  assert.doesNotMatch(purchaseOrderRoute, /p_actor_user_id:\s*req\.body/);
  assert.match(authMiddleware, /profile\.is_active !== true/);
  assert.match(authMiddleware, /catch \(error\)[\s\S]*?Authorization is temporarily unavailable/);
  assert.match(auditPage, /audit migration/i);
  assert.match(auditPage, /Stock Management operations are not affected/i);
  assert.match(auditPage, /error \? 'Retry' : 'Refresh'/);
  assert.match(auditPage, /<dt>Department<\/dt>/);
});
