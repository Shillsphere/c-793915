-- Add cursor tracking columns to campaigns for stateful worker
ALTER TABLE campaigns
  ADD COLUMN next_variation INT DEFAULT 0,
  ADD COLUMN next_page INT DEFAULT 1;

-- Add index for performance on cursor queries
CREATE INDEX IF NOT EXISTS idx_campaigns_cursor 
ON campaigns (id, next_variation, next_page) 
WHERE is_active = true; 