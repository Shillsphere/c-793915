-- Recreate daily_weekly_counts with BIGINT campaign id to match schema
CREATE OR REPLACE FUNCTION daily_weekly_counts(in_campaign_id BIGINT)
RETURNS TABLE(daily INT, weekly INT)
LANGUAGE SQL AS $$
  SELECT
    (SELECT COUNT(*)::INT FROM messages m
     JOIN prospects p ON p.id = m.prospect_id
     WHERE p.campaign_id = in_campaign_id
       AND m.sent_at::date = CURRENT_DATE) as daily,
    (SELECT COUNT(*)::INT FROM messages m
     JOIN prospects p ON p.id = m.prospect_id
     WHERE p.campaign_id = in_campaign_id
       AND m.sent_at >= date_trunc('week', CURRENT_DATE)) as weekly;
$$; 