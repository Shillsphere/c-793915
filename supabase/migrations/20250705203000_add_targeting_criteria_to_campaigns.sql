-- supabase/migrations/20250705203000_add_targeting_criteria_to_campaigns.sql

-- Adds a JSONB column for advanced demographic & professional targeting rules
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS targeting_criteria JSONB NULL; 