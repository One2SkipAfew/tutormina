-- Replaces provider_schedules (weekly-only day_of_week + start/end time) with a richer
-- recurring-rule + one-off-exception model, so professionals can express availability as
-- daily/weekly/monthly/quarterly/yearly patterns (not just a flat weekly grid), plus one-time
-- dates and blackouts layered on top.

create table public.provider_availability_rules (
    id uuid default uuid_generate_v4() primary key,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    days_of_week int[], -- weekly only, e.g. {1,3,5} = Mon/Wed/Fri
    day_of_month int check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 31)), -- monthly/quarterly/yearly
    month_of_year int check (month_of_year is null or (month_of_year >= 1 and month_of_year <= 12)), -- yearly only
    start_time time not null,
    end_time time not null,
    starts_on date not null default current_date,
    ends_on date,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    check (end_time > start_time),
    check (ends_on is null or ends_on >= starts_on)
);

create table public.provider_availability_exceptions (
    id uuid default uuid_generate_v4() primary key,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    specific_date date not null,
    is_available boolean not null,
    start_time time,
    end_time time,
    note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    check (start_time is null or end_time is null or end_time > start_time)
);

create index idx_availability_rules_provider_id on public.provider_availability_rules(provider_id);
create index idx_availability_exceptions_provider_id on public.provider_availability_exceptions(provider_id);
create index idx_availability_exceptions_date on public.provider_availability_exceptions(specific_date);

alter table public.provider_availability_rules enable row level security;
alter table public.provider_availability_exceptions enable row level security;

create policy "Anyone can view availability rules"
    on public.provider_availability_rules for select
    using (true);

create policy "Providers manage own availability rules"
    on public.provider_availability_rules for all
    using (auth.uid() = provider_id)
    with check (auth.uid() = provider_id);

create policy "Anyone can view availability exceptions"
    on public.provider_availability_exceptions for select
    using (true);

create policy "Providers manage own availability exceptions"
    on public.provider_availability_exceptions for all
    using (auth.uid() = provider_id)
    with check (auth.uid() = provider_id);

grant select on public.provider_availability_rules to anon;
grant select, insert, update, delete on public.provider_availability_rules to authenticated;
grant select on public.provider_availability_exceptions to anon;
grant select, insert, update, delete on public.provider_availability_exceptions to authenticated;

-- Preserve existing weekly patterns as 'weekly' rules (one row per provider per day, matching
-- the granularity provider_schedules already had - not collapsed into a single days_of_week
-- array, since start/end times can differ per day and collapsing would lose that).
insert into public.provider_availability_rules (provider_id, frequency, days_of_week, start_time, end_time)
select provider_id, 'weekly', array[day_of_week], start_time, end_time
from public.provider_schedules;

drop table public.provider_schedules cascade;
