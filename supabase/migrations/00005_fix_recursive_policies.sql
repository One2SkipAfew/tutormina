-- Fix infinite recursion in Admin policies
-- 1. Create a security definer function to check for admin role safely bypassing RLS
create or replace function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- 2. Drop the recursive policies
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

-- 3. Recreate them using the safe function
create policy "Admins can view all profiles"
    on public.profiles for select
    using (public.is_admin());

create policy "Admins can update profiles"
    on public.profiles for update
    using (public.is_admin());
