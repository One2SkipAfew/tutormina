-- ============================================
-- Migration: 00035_professional_resource_access_control.sql
-- Description:
-- 1. Create student_resource_access table for granular professional-controlled resource sharing.
-- 2. Update have_booking_together() to only match confirmed or completed bookings.
-- 3. Replace loose RLS policies on shared_files, folders, and storage with strict professional-grant access control.
-- ============================================

-- 1. Student Resource Access Table
create table if not exists public.student_resource_access (
    id uuid default uuid_generate_v4() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    provider_id uuid references public.profiles(id) on delete cascade not null,
    file_id uuid references public.shared_files(id) on delete cascade, -- null when grant_all = true
    grant_all boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast lookup by student and provider
create index if not exists idx_student_resource_access_lookup
    on public.student_resource_access(student_id, provider_id);

create index if not exists idx_student_resource_access_file
    on public.student_resource_access(student_id, file_id);

-- Enable RLS
alter table public.student_resource_access enable row level security;

-- Policies for student_resource_access table
drop policy if exists "Providers can manage their own resource grants" on public.student_resource_access;
create policy "Providers can manage their own resource grants"
    on public.student_resource_access for all
    using (auth.uid() = provider_id or public.is_admin())
    with check (auth.uid() = provider_id or public.is_admin());

drop policy if exists "Students can view their own resource grants" on public.student_resource_access;
create policy "Students can view their own resource grants"
    on public.student_resource_access for select
    using (auth.uid() = student_id or public.is_admin());

-- Grant access to authenticated users
grant select, insert, update, delete on public.student_resource_access to authenticated;

-- 2. Update have_booking_together to require confirmed or completed status
create or replace function public.have_booking_together(a uuid, b uuid)
returns boolean as $$
  select exists(
    select 1 from public.bookings
    where ((customer_id = a and provider_id = b) or (customer_id = b and provider_id = a))
      and status in ('confirmed', 'completed')
  );
$$ language sql security definer;

-- 3. Helper function: check if a student has access to a specific file or all resources of a provider
create or replace function public.student_has_file_access(student_uid uuid, file_uid uuid, uploader_uid uuid)
returns boolean as $$
  select exists(
    select 1 from public.student_resource_access
    where student_id = student_uid
      and provider_id = uploader_uid
      and (grant_all = true or file_id = file_uid)
  );
$$ language sql security definer;

-- 4. Helper function: check if a student has access to folders of a provider
create or replace function public.student_has_folder_access(student_uid uuid, owner_uid uuid)
returns boolean as $$
  select exists(
    select 1 from public.student_resource_access
    where student_id = student_uid
      and provider_id = owner_uid
  );
$$ language sql security definer;

-- 5. Drop outdated policies on public.shared_files
drop policy if exists "Uploaders can manage own files" on public.shared_files;
drop policy if exists "Admins can view all files" on public.shared_files;
drop policy if exists "Authenticated users can view public files" on public.shared_files;
drop policy if exists "Linked users can view public files" on public.shared_files;
drop policy if exists "Students can view student files" on public.shared_files;
drop policy if exists "Recipients can view direct-shared files" on public.shared_files;
drop policy if exists "Recipients can view files shared directly with them" on public.shared_files;
drop policy if exists "Tutors and coaches can view their files" on public.shared_files;
drop policy if exists "Students can view granted resources" on public.shared_files;

-- 6. Create clean, strict policies for public.shared_files
create policy "Uploaders can manage own files"
    on public.shared_files for all
    using (auth.uid() = uploaded_by);

create policy "Admins can view all files"
    on public.shared_files for select
    using (public.is_admin());

create policy "Recipients can view direct-shared files"
    on public.shared_files for select
    using (auth.uid() = shared_with_id);

create policy "Students can view granted resources"
    on public.shared_files for select
    using (
        auth.uid() is not null
        and (
            -- Either public/students_only AND granted by professional
            (
                visibility in ('public', 'students_only')
                and public.student_has_file_access(auth.uid(), id, uploaded_by)
            )
            -- Or tutors/coaches viewing peer shared professional files
            or (
                visibility = 'tutors_coaches_only'
                and exists (
                    select 1 from public.profiles
                    where id = auth.uid() and role in ('tutor', 'coach')
                )
            )
        )
    );

-- 7. Update policies on public.folders
drop policy if exists "Anyone authenticated can view tutor/coach folders" on public.folders;
drop policy if exists "Linked users can view tutor/coach folders" on public.folders;
drop policy if exists "Users can view accessible folders" on public.folders;

create policy "Users can view accessible folders"
    on public.folders for select
    using (
        auth.uid() is not null
        and (
            auth.uid() = folders.owner_id
            or public.is_admin()
            or public.student_has_folder_access(auth.uid(), folders.owner_id)
        )
    );

-- 8. Update storage policies for shared-drive bucket
drop policy if exists "Anyone can view shared-drive files" on storage.objects;
drop policy if exists "Linked users can view shared-drive files" on storage.objects;
drop policy if exists "Authorized users can view shared-drive files" on storage.objects;

create policy "Authorized users can view shared-drive files"
    on storage.objects for select
    using (
        bucket_id = 'shared-drive'
        and auth.uid() is not null
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or public.is_admin()
            or exists (
                select 1 from public.student_resource_access
                where student_id = auth.uid()
                  and provider_id = ((storage.foldername(name))[1])::uuid
            )
        )
    );
