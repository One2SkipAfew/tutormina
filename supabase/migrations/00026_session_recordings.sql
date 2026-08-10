-- Platform-agnostic session recordings: uploaded files and Chommie browser-extension captures.
-- Separate from live_sessions (the existing browser-mic Live Session feature) because the
-- capture lifecycle here is upload-then-process rather than real-time streaming.

-- 1. Session recordings — one row per captured session (upload or extension capture)
create table public.session_recordings (
    id uuid default uuid_generate_v4() primary key,
    booking_id uuid references public.bookings(id) on delete set null,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    title text,
    capture_method text not null check (capture_method in ('upload', 'extension_capture')),
    platform text check (platform in ('google_meet', 'microsoft_teams', 'zoom', 'other')),
    video_path text,
    audio_path text,
    consent_confirmed boolean not null default false,
    status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
    transcript_text text,
    duration_seconds integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone
);

create index idx_session_recordings_owner on public.session_recordings(owner_id);
create index idx_session_recordings_booking on public.session_recordings(booking_id);

alter table public.session_recordings enable row level security;

create policy "Owners manage their own session recordings"
    on public.session_recordings for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

create policy "Booking participants can view session recordings"
    on public.session_recordings for select
    using (
        exists (
            select 1 from public.bookings b
            where b.id = session_recordings.booking_id
            and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
        )
    );

grant select, insert, update, delete on public.session_recordings to authenticated;

-- 2. Session recording claims — fact-check results, mirrors live_session_claims
create table public.session_recording_claims (
    id uuid default uuid_generate_v4() primary key,
    session_recording_id uuid references public.session_recordings(id) on delete cascade not null,
    claim_text text not null,
    speaker text,
    category text,
    verdict text not null check (verdict in ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE')),
    confidence_score float default 0.5,
    explanation text,
    key_evidence text,
    source_urls text[],
    used_web_search boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_session_recording_claims_recording on public.session_recording_claims(session_recording_id);

alter table public.session_recording_claims enable row level security;

create policy "Users manage claims for their own recordings"
    on public.session_recording_claims for all
    using (
        exists (
            select 1 from public.session_recordings sr
            where sr.id = session_recording_claims.session_recording_id
            and sr.owner_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.session_recordings sr
            where sr.id = session_recording_claims.session_recording_id
            and sr.owner_id = auth.uid()
        )
    );

create policy "Booking participants can view claims"
    on public.session_recording_claims for select
    using (
        exists (
            select 1 from public.session_recordings sr
            join public.bookings b on b.id = sr.booking_id
            where sr.id = session_recording_claims.session_recording_id
            and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
        )
    );

grant select, insert, update, delete on public.session_recording_claims to authenticated;

-- 3. Storage bucket for uploaded/captured recordings (private — personal recordings, not public)
insert into storage.buckets (id, name, public)
values ('session-recordings', 'session-recordings', false)
on conflict (id) do nothing;

create policy "Owners can upload their own session recordings"
    on storage.objects for insert
    with check (bucket_id = 'session-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can update their own session recordings"
    on storage.objects for update
    using (bucket_id = 'session-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can delete their own session recordings"
    on storage.objects for delete
    using (bucket_id = 'session-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can view their own session recordings"
    on storage.objects for select
    using (bucket_id = 'session-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
