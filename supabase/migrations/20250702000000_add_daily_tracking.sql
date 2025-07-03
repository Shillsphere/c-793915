-- Add daily tracking columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN daily_sent INTEGER DEFAULT 0,
ADD COLUMN total_sent INTEGER DEFAULT 0,
ADD COLUMN last_run_date DATE,
ADD COLUMN next_run_date DATE,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Create daily campaign stats table
CREATE TABLE daily_campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  connections_sent INTEGER DEFAULT 0,
  target_daily INTEGER DEFAULT 10,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- Create campaign_executions table (doesn't exist in current schema)
CREATE TABLE campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  execution_type TEXT DEFAULT 'manual', -- manual, scheduled, batch
  connections_made INTEGER DEFAULT 0,
  batch_number INTEGER DEFAULT 1,
  total_batches INTEGER DEFAULT 1,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  worker_logs JSONB
);

-- Create indexes for performance
CREATE INDEX idx_daily_stats_campaign_date ON daily_campaign_stats(campaign_id, date);
CREATE INDEX idx_executions_campaign_status ON campaign_executions(campaign_id, status);
CREATE INDEX idx_campaigns_next_run ON campaigns(next_run_date) WHERE is_active = true;

-- Create function to update daily stats when invites are made
CREATE OR REPLACE FUNCTION update_daily_stats_from_invites()
RETURNS TRIGGER AS $$
DECLARE
  campaign_id_var BIGINT;
BEGIN
  -- Get campaign_id from the prospect
  SELECT p.campaign_id INTO campaign_id_var
  FROM prospects p 
  WHERE p.id = NEW.prospect_id;
  
  -- Update daily stats when an invite is inserted
  INSERT INTO daily_campaign_stats (campaign_id, date, connections_sent, target_daily)
  VALUES (campaign_id_var, CURRENT_DATE, 1, 10)
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET 
    connections_sent = daily_campaign_stats.connections_sent + 1,
    updated_at = NOW();
    
  -- Update campaign totals
  UPDATE campaigns 
  SET 
    daily_sent = COALESCE((
      SELECT connections_sent 
      FROM daily_campaign_stats 
      WHERE campaign_id = campaign_id_var AND date = CURRENT_DATE
    ), 0),
    total_sent = total_sent + 1,
    last_run_date = CURRENT_DATE
  WHERE id = campaign_id_var;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stats
DROP TRIGGER IF EXISTS trigger_update_daily_stats ON invites;
CREATE TRIGGER trigger_update_daily_stats
  AFTER INSERT ON invites
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_stats_from_invites();

-- Function to get campaigns ready for execution
CREATE OR REPLACE FUNCTION get_campaigns_ready_for_execution()
RETURNS TABLE (
  campaign_id BIGINT,
  campaign_name TEXT,
  daily_limit INTEGER,
  daily_sent INTEGER,
  remaining_today INTEGER,
  user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.daily_limit,
    COALESCE(c.daily_sent, 0) as daily_sent,
    GREATEST(0, c.daily_limit - COALESCE(c.daily_sent, 0)) as remaining_today,
    c.user_id
  FROM campaigns c
  WHERE c.is_active = true
    AND c.status = 'active'
    AND (c.next_run_date IS NULL OR c.next_run_date <= CURRENT_DATE)
    AND COALESCE(c.daily_sent, 0) < c.daily_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily counters (called daily)
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns 
  SET 
    daily_sent = 0,
    last_run_date = CASE 
      WHEN last_run_date < CURRENT_DATE THEN last_run_date 
      ELSE last_run_date 
    END
  WHERE is_active = true 
    AND (last_run_date IS NULL OR last_run_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql; 