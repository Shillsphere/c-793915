-- Enable pg_cron extension if needed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to reset daily counters at midnight
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaigns
  SET daily_sent = 0,
      updated_at = NOW()
  WHERE is_active IS TRUE
    AND status = 'active';
  
  RAISE NOTICE 'Daily reset completed for % campaigns',
    (SELECT COUNT(*) FROM public.campaigns WHERE is_active IS TRUE AND status = 'active');
END;
$$;

-- Unschedule any previous jobs with the same names
DO $$
DECLARE
  jid int;
BEGIN
  SELECT jobid INTO jid
    FROM cron.job
   WHERE jobname = 'daily_campaign_scheduler';

  IF jid IS NOT NULL THEN
     PERFORM cron.unschedule(jid);
  END IF;
END$$;

DO $$
DECLARE
  jid int;
BEGIN
  SELECT jobid INTO jid
    FROM cron.job
   WHERE jobname = 'linkedin_daily_reset';

  IF jid IS NOT NULL THEN
     PERFORM cron.unschedule(jid);
  END IF;
END$$;

-- Schedule the weekday HTTP call (14:30 UTC → 09:30 US-Central)
SELECT cron.schedule(
  'daily_campaign_scheduler',
  '30 14 * * 1-5',
  $$
    SELECT http_post(
      'https://ebgezhrvlqvornidwfqv.supabase.co/functions/v1/daily-campaign-scheduler',
      '{}',
      'application/json'
    );
  $$
);

-- Schedule the nightly counter reset (00:05 UTC every day)
SELECT cron.schedule(
  'linkedin_daily_reset',
  '5 0 * * *',
  'SELECT public.reset_daily_counters();'
);

-- Fix unique constraint to handle NULL URLs properly
ALTER TABLE public.connection_followups
DROP CONSTRAINT IF EXISTS connection_followups_campaign_id_prospect_profile_url_key;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_daily_tracking 
ON campaigns (is_active, status, daily_sent, daily_limit) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_followups_ready_for_processing 
ON connection_followups (campaign_id, follow_up_status, connection_accepted_at) 
WHERE follow_up_status = 'pending' AND connection_accepted_at IS NOT NULL; 