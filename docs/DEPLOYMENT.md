# Inventra deployment checklist

## Environment variables

Frontend (`frontend/.env` or deployment environment):

- `VITE_API_URL`: HTTPS URL of the backend API, including `/api`.
- `VITE_SUPABASE_URL`: public Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`: public client key only.

Backend (`backend/.env` or private deployment environment):

- `NODE_ENV=production`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`: server-only Supabase service-role/secret key.
- `CORS_ORIGINS`: comma-separated exact HTTPS frontend origins.

Never place `SUPABASE_SECRET_KEY` in frontend variables or browser code.

## Manual database setup

1. Confirm Supabase Auth is enabled and create the initial administrator through the Supabase Auth administrator workflow.
2. Execute `20261029_purchase_order_receipts.sql`.
3. Execute `20261029_atomic_stock_operations.sql`.
4. Execute `20261029_user_profiles_roles.sql`.
5. Execute `20261031_auth_signup_profiles.sql` to create viewer profiles for new Auth users.
6. Execute `20261031_inventory_audit_trail.sql` after the receipt and atomic stock-operation migrations. It creates the new audit ledger and disables the old unaudited stock RPC entrypoints. Historical movements are not backfilled with invented actor or balance data.
7. Insert the initial administrator's Auth UUID into `public.user_profiles` with role `admin`.
8. Verify execution grants for the new RPC functions are limited to `service_role` (the audit migration applies these grants):
   - `record_audited_stock_movement(bigint, text, integer, text, text, text, text, uuid)`
   - `receive_audited_purchase_order(bigint, jsonb, text, uuid)`
9. Keep the two legacy RPC functions revoked; do not restore their execution grants.
10. Verify RLS is enabled on all migration-created tables and that no `anon` policy or function execution grant exists.

The current inventory schema is shared: inventory records are not assigned to individual users or workspaces. Authenticated users with an active profile can read the shared workspace. New sign-ups receive the `viewer` role; only `admin` and `staff` profiles can change inventory. Promote users to `staff` or `admin` through a trusted administrator workflow, never from the browser.

## Supabase Auth settings

- Configure the production frontend URL as an allowed redirect URL.
- Enable public registration only if self-service sign-up is intended for this deployment.
- Create the initial administrator through the Supabase Auth administrator workflow, then add that user to `public.user_profiles`.
- Confirm email verification and password recovery settings match the deployment policy.
- Allow the frontend origin as a password-reset redirect URL.

## Application checks

- Deploy the backend with HTTPS and private environment variables.
- Set `CORS_ORIGINS` to the exact frontend origin(s); do not use `*`.
- Set the frontend `VITE_API_URL` to the HTTPS backend URL.
- Confirm an administrator can log in, refresh, and log out.
- Confirm staff/viewer profiles have only their intended permissions.
- Confirm missing or expired tokens return `401` and insufficient roles return `403`.
- Confirm stock and receiving RPCs reject duplicate idempotency keys and over-receipts.
- Confirm no secrets appear in frontend bundles, logs, or API responses.

Authentication and authorization must be verified before declaring the deployment production-ready.
