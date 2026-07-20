-- Video conferencing rooms, session transcripts, AI summaries, and fact-check storage.
-- Also adds in-house video conferencing option to bookings.

-- 1. Video rooms — stores room metadata for in-house video conferencing sessions
create table public.video_rooms (
    id uuid default uuid_generate_v4() primary key,
    booking_id uuid references public.bookings(id) on delete set null,
    host_id uuid references public.profiles(id) on delete cascade not null,
    room_name text not null,
    daily_room_url text,        -- Daily.co room URL
    daily_room_name text,       -- Daily.co room name
    status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    recording_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_video_rooms_booking_id on public.video_rooms(booking_id);
create index idx_video_rooms_host_id on public.video_rooms(host_id);

alter table public.video_rooms enable row level security;

create policy "Participants can view their rooms"
    on public.video_rooms for select
    using (
        auth.uid() = host_id
        or exists (
            select 1 from public.bookings b
            where b.id = video_rooms.booking_id
            and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
        )
    );

create policy "Hosts can manage their rooms"
    on public.video_rooms for all
    using (auth.uid() = host_id)
    with check (auth.uid() = host_id);

grant select, insert, update, delete on public.video_rooms to authenticated;

-- 2. Session transcripts — stores real-time transcript segments from live sessions
create table public.session_transcripts (
    id uuid default uuid_generate_v4() primary key,
    video_room_id uuid references public.video_rooms(id) on delete cascade,
    booking_id uuid references public.bookings(id) on delete set null,
    speaker_id uuid references public.profiles(id) on delete set null,
    speaker_label text,         -- "Speaker 0", "Speaker 1", or actual name
    text text not null,
    start_time float default 0,
    end_time float default 0,
    is_final boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_session_transcripts_room on public.session_transcripts(video_room_id);
create index idx_session_transcripts_booking on public.session_transcripts(booking_id);

alter table public.session_transcripts enable row level security;

create policy "Session participants can view transcripts"
    on public.session_transcripts for select
    using (
        exists (
            select 1 from public.video_rooms vr
            where vr.id = session_transcripts.video_room_id
            and (
                vr.host_id = auth.uid()
                or exists (
                    select 1 from public.bookings b
                    where b.id = vr.booking_id
                    and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
                )
            )
        )
    );

create policy "Authenticated users can insert transcripts"
    on public.session_transcripts for insert
    with check (auth.uid() is not null);

grant select, insert on public.session_transcripts to authenticated;

-- 3. Session summaries — AI-generated post-session summaries
create table public.session_summaries (
    id uuid default uuid_generate_v4() primary key,
    video_room_id uuid references public.video_rooms(id) on delete cascade,
    booking_id uuid references public.bookings(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    summary_text text not null,
    key_topics text[],
    insights text[],
    action_items text[],
    duration_seconds integer,
    transcript_word_count integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_session_summaries_room on public.session_summaries(video_room_id);
create index idx_session_summaries_booking on public.session_summaries(booking_id);

alter table public.session_summaries enable row level security;

create policy "Session participants can view summaries"
    on public.session_summaries for select
    using (
        auth.uid() = created_by
        or exists (
            select 1 from public.bookings b
            where b.id = session_summaries.booking_id
            and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
        )
    );

create policy "Authenticated users can create summaries"
    on public.session_summaries for insert
    with check (auth.uid() is not null);

grant select, insert on public.session_summaries to authenticated;

-- 4. Fact-check results — individual claim verifications
create table public.fact_check_results (
    id uuid default uuid_generate_v4() primary key,
    video_room_id uuid references public.video_rooms(id) on delete cascade,
    booking_id uuid references public.bookings(id) on delete set null,
    claim_text text not null,
    speaker_label text,
    category text,                                -- statistic, date, event, science, policy, etc.
    verdict text not null check (verdict in ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE')),
    confidence_score float default 0.5,
    explanation text,
    key_evidence text,
    source_urls text[],
    used_web_search boolean default false,
    checked_against_resources boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_fact_check_room on public.fact_check_results(video_room_id);
create index idx_fact_check_booking on public.fact_check_results(booking_id);

alter table public.fact_check_results enable row level security;

create policy "Session participants can view fact checks"
    on public.fact_check_results for select
    using (
        exists (
            select 1 from public.video_rooms vr
            where vr.id = fact_check_results.video_room_id
            and (
                vr.host_id = auth.uid()
                or exists (
                    select 1 from public.bookings b
                    where b.id = vr.booking_id
                    and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
                )
            )
        )
    );

create policy "Authenticated users can insert fact checks"
    on public.fact_check_results for insert
    with check (auth.uid() is not null);

grant select, insert on public.fact_check_results to authenticated;

-- 5. Add video room columns to bookings
alter table public.bookings add column if not exists use_video_room boolean default false;
alter table public.bookings add column if not exists video_room_id uuid references public.video_rooms(id);

-- 6. Live session recordings (standalone, not tied to bookings)
create table public.live_sessions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    transcript_text text,
    ai_notes text,
    meeting_package text,
    audio_path text,
    duration_seconds integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_live_sessions_user on public.live_sessions(user_id);

alter table public.live_sessions enable row level security;

create policy "Users manage own live sessions"
    on public.live_sessions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update, delete on public.live_sessions to authenticated;

-- 7. Live session fact-check claims (standalone)
create table public.live_session_claims (
    id uuid default uuid_generate_v4() primary key,
    session_id uuid references public.live_sessions(id) on delete cascade not null,
    claim_text text not null,
    speaker text,
    category text,
    verdict text not null check (verdict in ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE')),
    confidence_score float default 0.5,
    explanation text,
    key_evidence text,
    used_web_search boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_live_session_claims_session on public.live_session_claims(session_id);

alter table public.live_session_claims enable row level security;

create policy "Users manage own claims"
    on public.live_session_claims for all
    using (
        exists (
            select 1 from public.live_sessions ls
            where ls.id = live_session_claims.session_id
            and ls.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.live_sessions ls
            where ls.id = live_session_claims.session_id
            and ls.user_id = auth.uid()
        )
    );

grant select, insert, update, delete on public.live_session_claims to authenticated;
