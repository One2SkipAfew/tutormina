-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ROLES ENUM
create type user_role as enum ('customer', 'tutor', 'coach', 'admin');
create type user_status as enum ('pending', 'approved', 'declined');
create type coach_type as enum ('behavioural', 'executive');
create type tutor_level as enum ('primary', 'high_school', 'university');

-- USERS (Extends Supabase auth.users)
create table public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    email text unique not null,
    first_name text not null,
    last_name text not null,
    role user_role not null default 'customer',
    status user_status not null default 'approved', -- Customers are approved by default, tutors/coaches default to pending
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TUTOR/COACH DETAILS
create table public.provider_details (
    profile_id uuid references public.profiles(id) on delete cascade primary key,
    bio text,
    avatar_url text,
    location text,
    travel_radius_km integer, -- e.g., 20km for lessons
    contact_preference text, -- 'email', 'phone', 'platform_only'
    phone_number text,
    
    -- Specific Types
    is_tutor boolean default false,
    tutor_level tutor_level,
    is_coach boolean default false,
    coach_type coach_type,

    -- Offerings (Flags for Super Revision, Diverse Needs, etc.)
    offers_super_revision boolean default false,
    offers_diverse_needs boolean default false,

    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- BOOKINGS
create table public.bookings (
    id uuid default uuid_generate_v4() primary key,
    customer_id uuid references public.profiles(id) not null,
    provider_id uuid references public.profiles(id) not null,
    session_date timestamp with time zone not null,
    duration_minutes integer not null default 60,
    status text default 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
    meeting_link text, -- Daily.co link
    payment_reference text, -- Paystack reference
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Setup
alter table public.profiles enable row level security;
alter table public.provider_details enable row level security;
alter table public.bookings enable row level security;

-- Policies for Profiles
-- Users can view all approved provider profiles
create policy "Anyone can view approved provider profiles"
    on public.profiles for select
    using (role in ('tutor', 'coach') and status = 'approved');

-- Users can view their own profile
create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

-- Admins can view all profiles
create policy "Admins can view all profiles"
    on public.profiles for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Admins can update profile status
create policy "Admins can update profiles"
    on public.profiles for update
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Users can update their own profile
create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);
