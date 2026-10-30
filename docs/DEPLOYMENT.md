# Inventra deployment checklist

## Environment variables

Frontend (`frontend/.env` or deployment environment):

- `VITE_API_URL`: HTTPS URL of the backend API, including `/api`.
- `VITE_SUPABASE_URL`: public Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: public Supabase anon/publishable key only.

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
5. Insert the initial administrator's Auth UUID into `public.user_profiles` with role `admin`.
6. Grant the two RPC functions only to the backend database role after confirming the role:
   - `record_stock_movement(bigint, text, integer, text, text, text, text)`
   - `receive_purchase_order(bigint, jsonb, text)`
7. Verify RLS is enabled on all migration-created tables and that no `anon` policy or function execution grant exists.

## Supabase Auth settings

- Configure the production frontend URL as an allowed redirect URL.
- Disable open public registration unless the deployment explicitly needs it.
- Use administrator-controlled Auth account creation for initial users.
- Confirm email verification and password recovery settings match the deployment policy.

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
