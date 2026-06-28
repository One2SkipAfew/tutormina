-- ============================================
-- TutorMina LMS Schema Migration
-- ============================================

-- FILE TYPE ENUM
create type file_type as enum ('document', 'video', 'past_paper', 'notes', 'course_material', 'recording', 'other');
create type file_visibility as enum ('public', 'students_only', 'tutors_coaches_only', 'private');

-- FOLDERS (for tutors/coaches to organize resources)
create table public.folders (
    id uuid default uuid_generate_v4() primary key,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    parent_folder_id uuid references public.folders(id) on delete cascade, -- null = root folder
    name text not null,
    description text,
    color text, -- optional color for the folder icon
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Prevent duplicate folder names under the same parent for the same owner
    unique(owner_id, parent_folder_id, name)
);

-- SHARED FILES
create table public.shared_files (
    id uuid default uuid_generate_v4() primary key,
    uploaded_by uuid references public.profiles(id) on delete cascade not null,
    folder_id uuid references public.folders(id) on delete set null, -- null = unfiled / shared drive root
    title text not null,
    description text,
    file_type file_type not null default 'other',
    storage_path text not null, -- path within supabase storage bucket
    file_url text, -- signed or public URL
    file_size_bytes bigint,
    duration_seconds integer, -- for video/audio files
    mime_type text,
    visibility file_visibility not null default 'public',
    
    -- AI-generated content
    ai_summary text,
    ai_insights jsonb, -- array of insight strings
    ai_key_topics jsonb, -- array of extracted topics
    ai_processed_at timestamp with time zone,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FILE ACCESS LOG (track who viewed what)
create table public.file_access_log (
    id uuid default uuid_generate_v4() primary key,
    file_id uuid references public.shared_files(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    accessed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RESOURCE CHANGE ALERTS
create table public.resource_alerts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null, -- who should see this alert
    triggered_by uuid references public.profiles(id) on delete cascade not null, -- who caused it
    file_id uuid references public.shared_files(id) on delete cascade,
    folder_id uuid references public.folders(id) on delete cascade,
    alert_type text not null, -- 'file_added', 'file_updated', 'folder_created'
    message text not null,
    is_read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- INDEXES
create index idx_shared_files_uploaded_by on public.shared_files(uploaded_by);
create index idx_shared_files_folder_id on public.shared_files(folder_id);
create index idx_shared_files_visibility on public.shared_files(visibility);
create index idx_shared_files_file_type on public.shared_files(file_type);
create index idx_folders_owner_id on public.folders(owner_id);
create index idx_folders_parent on public.folders(parent_folder_id);
create index idx_file_access_log_file_id on public.file_access_log(file_id);
create index idx_file_access_log_user_id on public.file_access_log(user_id);
create index idx_resource_alerts_user_id on public.resource_alerts(user_id);
create index idx_resource_alerts_is_read on public.resource_alerts(is_read);

-- RLS
alter table public.folders enable row level security;
alter table public.shared_files enable row level security;
alter table public.file_access_log enable row level security;
alter table public.resource_alerts enable row level security;

-- FOLDER POLICIES
-- Owners can do everything with their folders
create policy "Owners can manage their folders"
    on public.folders for all
    using (auth.uid() = owner_id);

-- Everyone can view folders of tutors/coaches (for shared drive browsing)
create policy "Anyone authenticated can view tutor/coach folders"
    on public.folders for select
    using (
        auth.uid() is not null
        and exists (
            select 1 from public.profiles
            where id = folders.owner_id
            and role in ('tutor', 'coach')
        )
    );

-- SHARED FILES POLICIES
-- Uploaders can manage their own files
create policy "Uploaders can manage own files"
    on public.shared_files for all
    using (auth.uid() = uploaded_by);

-- Authenticated users can view public files
create policy "Authenticated users can view public files"
    on public.shared_files for select
    using (auth.uid() is not null and visibility = 'public');

-- Students can view student-visible files
create policy "Students can view student files"
    on public.shared_files for select
    using (
        auth.uid() is not null
        and visibility = 'students_only'
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'customer'
        )
    );

-- Tutors/coaches can view tutor/coach-only files
create policy "Tutors and coaches can view their files"
    on public.shared_files for select
    using (
        auth.uid() is not null
        and visibility = 'tutors_coaches_only'
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('tutor', 'coach')
        )
    );

-- FILE ACCESS LOG POLICIES
create policy "Users can log their own access"
    on public.file_access_log for insert
    with check (auth.uid() = user_id);

create policy "File owners can view access logs"
    on public.file_access_log for select
    using (
        exists (
            select 1 from public.shared_files
            where id = file_access_log.file_id
            and uploaded_by = auth.uid()
        )
    );

-- RESOURCE ALERTS POLICIES
create policy "Users can view their own alerts"
    on public.resource_alerts for select
    using (auth.uid() = user_id);

create policy "Users can update their own alerts"
    on public.resource_alerts for update
    using (auth.uid() = user_id);

create policy "Tutors and coaches can create alerts"
    on public.resource_alerts for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('tutor', 'coach', 'admin')
        )
    );
