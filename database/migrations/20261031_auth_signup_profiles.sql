-- Create a least-privileged application profile for every new Supabase Auth user.
-- Inventory records remain shared; this migration does not add ownership columns.

create or replace function public.create_inventra_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, role, is_active)
  values (new.id, 'viewer', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_inventra_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists create_inventra_profile_after_signup on auth.users;
create trigger create_inventra_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_inventra_profile_for_auth_user();
