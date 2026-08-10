-- Fix 500 error when deleting users from Supabase by ensuring foreign keys on profiles have
-- correct cascading behavior, preventing orphaned records from blocking deletion.

-- 1. Bookings table constraints
alter table public.bookings
  drop constraint if exists bookings_customer_id_fkey,
  add constraint bookings_customer_id_fkey foreign key (customer_id) references public.profiles(id) on delete cascade;

alter table public.bookings
  drop constraint if exists bookings_provider_id_fkey,
  add constraint bookings_provider_id_fkey foreign key (provider_id) references public.profiles(id) on delete cascade;

-- 2. Shared files table constraints
alter table public.shared_files
  drop constraint if exists shared_files_shared_with_id_fkey,
  add constraint shared_files_shared_with_id_fkey foreign key (shared_with_id) references public.profiles(id) on delete set null;

-- 3. Profiles self-referencing constraints
alter table public.profiles
  drop constraint if exists profiles_reviewed_by_fkey,
  add constraint profiles_reviewed_by_fkey foreign key (reviewed_by) references public.profiles(id) on delete set null;

-- Drop the one-time admin bootstrap lock so that multiple admins can be created from /admin-setup
drop trigger if exists enforce_admin_bootstrap on public.profiles;
drop function if exists public.enforce_admin_bootstrap();
drop function if exists public.admin_exists();
