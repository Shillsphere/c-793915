-- Create function to get daily and weekly message counts for a campaign
CREATE OR REPLACE FUNCTION daily_weekly_counts(in_campaign_id UUID)
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