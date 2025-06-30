-- Aggregated stats for a user's campaigns
DROP FUNCTION IF EXISTS get_all_campaign_stats_for_user(uuid);

CREATE OR REPLACE FUNCTION get_all_campaign_stats_for_user(in_user_id UUID)
RETURNS TABLE(dms_sent INT, replies INT, acceptance_rate NUMERIC, leads INT)
LANGUAGE SQL AS $$
  SELECT
    (SELECT COUNT(*) FROM public.messages m
      JOIN public.prospects p ON p.id = m.prospect_id
      JOIN public.campaigns c ON c.id = p.campaign_id
      WHERE c.user_id = in_user_id
        AND m.sent_at >= date_trunc('month', CURRENT_DATE))::INT AS dms_sent,
    0::INT AS replies,
    0::NUMERIC AS acceptance_rate,
    0::INT AS leads;
$$; 