# Inventra frontend

The React + Vite frontend includes a public landing page and a Supabase-authenticated inventory workspace.

## Local development

Create `frontend/.env` with:

- `VITE_API_URL`: backend API base URL, including `/api`.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`: public client key only.

Run `npm install`, then `npm run dev`. Use `npm run lint` and `npm run build` to validate changes.

## Authentication and access

The frontend restores Supabase sessions, sends the access token with workspace API requests, and provides sign-up, sign-in, sign-out, and password reset flows. Apply the database migrations in [the deployment checklist](../docs/DEPLOYMENT.md) before enabling sign-ups. New accounts are viewers until an administrator grants staff or admin access.

Never put the Supabase service-role/secret key in frontend environment variables.
