-- Migration: Social media handles on professional profiles
-- Professionals can optionally list their Instagram, LinkedIn, X/Twitter, Facebook and TikTok
-- accounts. Values are stored as entered (handle or URL) and normalised to safe https links
-- client-side (see frontend/src/lib/socialLinks.ts). Existing provider_details SELECT/UPDATE
-- policies already cover these columns, so no policy changes are needed.

ALTER TABLE public.provider_details
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_linkedin  TEXT,
  ADD COLUMN IF NOT EXISTS social_twitter   TEXT,
  ADD COLUMN IF NOT EXISTS social_facebook  TEXT,
  ADD COLUMN IF NOT EXISTS social_tiktok    TEXT;

-- Guard against oversized values being written directly via the API.
ALTER TABLE public.provider_details
  DROP CONSTRAINT IF EXISTS provider_details_social_length_chk;
ALTER TABLE public.provider_details
  ADD CONSTRAINT provider_details_social_length_chk CHECK (
    coalesce(char_length(social_instagram), 0) <= 200 AND
    coalesce(char_length(social_linkedin),  0) <= 200 AND
    coalesce(char_length(social_twitter),   0) <= 200 AND
    coalesce(char_length(social_facebook),  0) <= 200 AND
    coalesce(char_length(social_tiktok),    0) <= 200
  );
