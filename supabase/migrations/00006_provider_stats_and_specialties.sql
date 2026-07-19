-- Add statistics and rich profile fields to provider_details

ALTER TABLE public.provider_details
ADD COLUMN review_count integer DEFAULT 0,
ADD COLUMN years_of_experience integer,
ADD COLUMN specialties text[];
