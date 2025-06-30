-- Add indexes for better performance on frequent queries

-- Index for message counts by campaign and date
CREATE INDEX IF NOT EXISTS idx_messages_campaign_sent 
  ON messages(prospect_id, sent_at) 
  WHERE sent_at IS NOT NULL;

-- Index for prospects by campaign and status
CREATE INDEX IF NOT EXISTS idx_prospects_status 
  ON prospects(campaign_id, status);

-- Index for faster prospect lookups by campaign and profile
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_profile 
  ON prospects(campaign_id, profile_url);

-- Index for messages date range queries
CREATE INDEX IF NOT EXISTS idx_messages_sent_date 
  ON messages(sent_at) 
  WHERE sent_at IS NOT NULL; 