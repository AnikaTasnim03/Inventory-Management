
-- Inventra user profiles and application roles.
-- Additive migration: does not modify inventory records.

create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'viewer'
        check (role in ('admin', 'staff', 'viewer')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can read their own active profile"
    on public.user_profiles
    for select
    to authenticated
    using (id = auth.uid() and is_active = true);

revoke all on public.user_profiles from anon;
revoke all on public.user_profiles from authenticated;
grant select on public.user_profiles to authenticated;

comment on table public.user_profiles is
    'Application roles for Inventra; role changes are performed by an administrator outside the client.';
