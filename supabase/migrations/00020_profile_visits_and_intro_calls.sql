-- ============================================
-- TutorMina: Profile Visits & Intro Calls
-- ============================================

-- 1. Profile visits table for lead generation
create table if not exists public.profile_visits (
    id uuid default uuid_generate_v4() primary key,
    visitor_id uuid references public.profiles(id) on delete cascade not null,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    visited_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast provider-side lookups
create index if not exists idx_profile_visits_provider
    on public.profile_visits(provider_id, visited_at desc);

-- Enable RLS
alter table public.profile_visits enable row level security;

-- Policies: visitors can insert their own visits
create policy "Users can insert own profile visits"
    on public.profile_visits for insert
    with check (auth.uid() = visitor_id);

-- Professionals can view visits to their own profile
create policy "Providers can view visits to own profile"
    on public.profile_visits for select
    using (auth.uid() = provider_id);

-- 2. Add booking_type column to bookings
alter table public.bookings
    add column if not exists booking_type text default 'session';

-- Note: check constraint added separately to avoid issues with existing rows
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'bookings' and constraint_name = 'bookings_booking_type_check'
  ) then
    alter table public.bookings
      add constraint bookings_booking_type_check
      check (booking_type in ('session', 'intro_call'));
  end if;
end $$;
