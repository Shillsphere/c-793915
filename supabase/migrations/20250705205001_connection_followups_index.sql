-- Create unique constraint that handles NULL URLs
-- This must be in a separate migration because CREATE INDEX CONCURRENTLY 
-- cannot run inside a transaction block
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  connection_followups_unique_profile
  ON public.connection_followups (campaign_id, COALESCE(prospect_profile_url, 'NOURL')); 