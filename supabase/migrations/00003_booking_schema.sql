-- ============================================
-- TutorMina Booking & Calendar Schema
-- ============================================

-- 1. Extend provider_details with new fields for the directory
alter table public.provider_details 
add column if not exists offers_in_person boolean default false,
add column if not exists offers_virtual boolean default true,
add column if not exists rating numeric(3,1) default 5.0,
add column if not exists completed_sessions integer default 0;

-- Ensure missing RLS policies on provider_details
create policy "Anyone can view provider details"
    on public.provider_details for select
    using (true);

create policy "Users can insert own provider details"
    on public.provider_details for insert
    with check (auth.uid() = profile_id);

create policy "Users can update own provider details"
    on public.provider_details for update
    using (auth.uid() = profile_id);

-- 2. Create provider_schedules table for weekly availability
create table public.provider_schedules (
    id uuid default uuid_generate_v4() primary key,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    start_time time not null,
    end_time time not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_provider_schedules_provider_id on public.provider_schedules(provider_id);

-- Enable RLS
alter table public.provider_schedules enable row level security;

-- Policies for provider_schedules
create policy "Anyone can view provider_schedules"
    on public.provider_schedules for select
    using (true);

create policy "Users can manage own schedules"
    on public.provider_schedules for all
    using (auth.uid() = provider_id);
