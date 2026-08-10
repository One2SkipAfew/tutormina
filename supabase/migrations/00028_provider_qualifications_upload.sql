-- Migration: Add qualifications upload and clear existing specialties to enforce new limits

-- 1. Add the column for qualifications file uploads
ALTER TABLE public.provider_details
ADD COLUMN IF NOT EXISTS qualifications_file_url TEXT;

-- 2. Clear existing specialties to force providers to re-enter them under the new restrictions (max 2 words/25 chars).
-- We also clear qualifications text so they upload the file and fill it out properly again, or we can just clear specialties. 
-- The user requested: "clear the fields of existing professionals so they need to complete their profiles again with the new restrictions... just the values captured against their profiles to include the new rules"
-- We will just clear specialties to be safe, as that's what caused the UI issue.
UPDATE public.provider_details
SET specialties = ARRAY[]::TEXT[];
