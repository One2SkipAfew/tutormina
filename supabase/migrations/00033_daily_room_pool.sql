-- Automates Daily.co room provisioning: instead of a professional manually creating a room in
-- the Daily.co dashboard and pasting the URL per booking, ai-api provisions from a small
-- reusable pool of real Daily rooms per professional (~3), and only calls the Daily API to
-- create a new one when the pool is smaller than that and none are free.
--
-- video_rooms keeps one row PER BOOKING (so session_transcripts/session_summaries/
-- fact_check_results, which FK to video_room_id, stay correctly scoped to one specific
-- session) - it's backed by, not replaced by, the pooled Daily resource.

create table public.provider_daily_rooms (
    id uuid default uuid_generate_v4() primary key,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    daily_room_name text not null,
    daily_room_url text not null,
    status text not null default 'available' check (status in ('available', 'in_use')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_used_at timestamp with time zone
);

create index idx_provider_daily_rooms_provider_id on public.provider_daily_rooms(provider_id);
create index idx_provider_daily_rooms_status on public.provider_daily_rooms(status);

alter table public.provider_daily_rooms enable row level security;

create policy "Providers can view their own room pool"
    on public.provider_daily_rooms for select
    using (auth.uid() = provider_id);

-- All writes happen via ai-api using the service-role key (bypasses RLS) - regular users never
-- insert/update this table directly, so no insert/update/delete policy is granted.

alter table public.video_rooms add column if not exists provider_daily_room_id uuid references public.provider_daily_rooms(id) on delete set null;

-- Release the pooled room back to 'available' once a session ends, so it can be reused for the
-- same professional's next booking.
create or replace function public.release_provider_daily_room()
returns trigger as $$
begin
    if new.status = 'ended' and old.status <> 'ended' and new.provider_daily_room_id is not null then
        update public.provider_daily_rooms
        set status = 'available', last_used_at = timezone('utc'::text, now())
        where id = new.provider_daily_room_id;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger trg_release_provider_daily_room
    after update of status on public.video_rooms
    for each row
    execute function public.release_provider_daily_room();
