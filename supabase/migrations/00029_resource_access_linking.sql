-- Fixes a real access-control bug: every authenticated user currently sees every
-- professional's folders/files (via "Anyone authenticated can view tutor/coach folders" and
-- "Authenticated users can view public files"), regardless of whether they've ever interacted
-- with that professional. Resources should only be visible to a student once they're linked to
-- the professional via an intro call or an actual booked session - public.have_booking_together()
-- (00009_messaging_and_notifications.sql) already captures exactly that relationship.
--
-- Professionals still see their own uploads (unaffected - "Owners can manage their folders" /
-- "Uploaders can manage own files" already scope to auth.uid()), and the direct
-- shared_with_id grant (00018) is untouched.

drop policy if exists "Anyone authenticated can view tutor/coach folders" on public.folders;

create policy "Linked users can view tutor/coach folders"
    on public.folders for select
    using (
        auth.uid() is not null
        and (
            auth.uid() = folders.owner_id
            or public.is_admin()
            or public.have_booking_together(auth.uid(), folders.owner_id)
        )
    );

drop policy if exists "Authenticated users can view public files" on public.shared_files;

create policy "Linked users can view public files"
    on public.shared_files for select
    using (
        auth.uid() is not null
        and visibility = 'public'
        and (
            auth.uid() = shared_files.uploaded_by
            or public.is_admin()
            or public.have_booking_together(auth.uid(), shared_files.uploaded_by)
        )
    );

-- "Students can view student files" / "Tutors and coaches can view their files" (role-scoped
-- visibility tiers) are left as-is - those are broadcast tiers ("all my students" / "all my
-- fellow professionals"), a different intentional visibility level from 'public', not part of
-- the leak this migration closes.

-- Mirror the same gate at the storage layer - the shared-drive bucket's blanket read policy
-- had no relationship check either.
drop policy if exists "Anyone can view shared-drive files" on storage.objects;

create policy "Linked users can view shared-drive files"
    on storage.objects for select
    using (
        bucket_id = 'shared-drive'
        and auth.uid() is not null
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or public.is_admin()
            or public.have_booking_together(auth.uid(), ((storage.foldername(name))[1])::uuid)
        )
    );
