-- Add composite uniqueness to avoid duplicate prospects per campaign
ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_campaign_profile_unique
  UNIQUE (campaign_id, profile_url); 