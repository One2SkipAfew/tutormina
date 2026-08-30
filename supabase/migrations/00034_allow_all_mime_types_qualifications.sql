-- Migration: Allow all MIME types on professional-photos bucket
-- The bucket was created with default image-only MIME type restrictions which
-- blocks PDF uploads for qualifications. Setting allowed_mime_types to NULL
-- (the Supabase default for "allow all") fixes the 400 Bad Request errors.

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'professional-photos';
