-- The shared-drive bucket (declared in config.toml) has been public since the LMS schema
-- migration, but unlike professional-photos, no storage.objects RLS policies were ever added
-- for it - so every insert into the bucket was rejected regardless of the shared_files table
-- policies being correct. Mirrors the professional-photos policies: uploader owns the top-level
-- folder segment of the path (uploadFile() in sharedDrive.ts stores as `${user.id}/...`).
create policy "Owners can upload their own shared-drive files"
    on storage.objects for insert
    with check (bucket_id = 'shared-drive' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can update their own shared-drive files"
    on storage.objects for update
    using (bucket_id = 'shared-drive' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can delete their own shared-drive files"
    on storage.objects for delete
    using (bucket_id = 'shared-drive' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view shared-drive files"
    on storage.objects for select
    using (bucket_id = 'shared-drive');
