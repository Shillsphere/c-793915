-- Function to reset daily counters (run at start of each day)
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset daily_sent to 0 for all campaigns
  UPDATE campaigns 
  SET daily_sent = 0
  WHERE is_active = true;
  
  -- Log the reset
  INSERT INTO job_logs (
    job_type, 
    status, 
    message, 
    created_at
  ) VALUES (
    'daily_reset', 
    'completed', 
    'Daily counters reset for all active campaigns', 
    NOW()
  );
END;
$$;

-- Function to get campaigns ready for execution today
CREATE OR REPLACE FUNCTION get_campaigns_ready_for_execution()
RETURNS TABLE (
  campaign_id BIGINT,
  campaign_name TEXT,
  daily_limit INTEGER,
  daily_sent INTEGER,
  remaining_today INTEGER,
  user_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.daily_limit,
    c.daily_sent,
    (c.daily_limit - c.daily_sent) AS remaining_today,
    c.user_id
  FROM campaigns c
  WHERE c.is_active = true
    AND c.status = 'active'
    AND c.daily_sent < c.daily_limit
    AND (c.next_run_date IS NULL OR c.next_run_date <= CURRENT_DATE)
  ORDER BY c.daily_sent ASC, c.updated_at ASC; -- Prioritize campaigns with fewer sent today
END;
$$;

-- Function to update campaign daily stats after execution
CREATE OR REPLACE FUNCTION update_campaign_daily_stats(
  p_campaign_id BIGINT,
  p_connections_made INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update campaign counters
  UPDATE campaigns 
  SET 
    daily_sent = daily_sent + p_connections_made,
    total_sent = total_sent + p_connections_made,
    updated_at = NOW()
  WHERE id = p_campaign_id;
  
  -- Insert or update daily stats
  INSERT INTO daily_campaign_stats (
    campaign_id,
    date,
    connections_sent,
    created_at,
    updated_at
  ) VALUES (
    p_campaign_id,
    CURRENT_DATE,
    p_connections_made,
    NOW(),
    NOW()
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    connections_sent = daily_campaign_stats.connections_sent + p_connections_made,
    updated_at = NOW();
END;
$$;

-- Function to get daily stats for a campaign
CREATE OR REPLACE FUNCTION get_campaign_daily_stats(
  p_campaign_id BIGINT,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  connections_sent INTEGER,
  executions_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dcs.date,
    dcs.connections_sent,
    COUNT(ce.id) AS executions_count
  FROM daily_campaign_stats dcs
  LEFT JOIN campaign_executions ce ON ce.campaign_id = dcs.campaign_id 
    AND DATE(ce.executed_at) = dcs.date
  WHERE dcs.campaign_id = p_campaign_id
    AND dcs.date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
  GROUP BY dcs.date, dcs.connections_sent
  ORDER BY dcs.date DESC;
END;
$$;

-- Function to get campaign execution summary
CREATE OR REPLACE FUNCTION get_campaign_execution_summary(
  p_campaign_id BIGINT
)
RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  total_connections_made INTEGER,
  avg_connections_per_execution NUMERIC,
  last_execution_date TIMESTAMPTZ,
  next_scheduled_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ce.id) AS total_executions,
    COUNT(CASE WHEN ce.status = 'completed' THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN ce.status = 'failed' THEN 1 END) AS failed_executions,
    COALESCE(SUM(ce.connections_made), 0)::INTEGER AS total_connections_made,
    CASE 
      WHEN COUNT(ce.id) > 0 THEN 
        ROUND(COALESCE(SUM(ce.connections_made), 0) / COUNT(ce.id)::NUMERIC, 2)
      ELSE 0 
    END AS avg_connections_per_execution,
    MAX(ce.executed_at) AS last_execution_date,
    (SELECT next_run_date FROM campaigns WHERE id = p_campaign_id) AS next_scheduled_date
  FROM campaign_executions ce
  WHERE ce.campaign_id = p_campaign_id;
END;
$$;

-- Function to schedule campaign for next run
CREATE OR REPLACE FUNCTION schedule_campaign_next_run(
  p_campaign_id BIGINT,
  p_next_date DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date DATE;
BEGIN
  -- Use provided date or default to tomorrow
  v_next_date := COALESCE(p_next_date, CURRENT_DATE + INTERVAL '1 day');
  
  UPDATE campaigns 
  SET 
    next_run_date = v_next_date,
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$;

-- Function to get user's daily connection summary
CREATE OR REPLACE FUNCTION get_user_daily_summary(
  p_user_id UUID
)
RETURNS TABLE (
  total_campaigns INTEGER,
  active_campaigns INTEGER,
  daily_connections_sent INTEGER,
  daily_limit_total INTEGER,
  remaining_today INTEGER,
  next_execution_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(c.id)::INTEGER AS total_campaigns,
    COUNT(CASE WHEN c.is_active = true AND c.status = 'active' THEN 1 END)::INTEGER AS active_campaigns,
    COALESCE(SUM(c.daily_sent), 0)::INTEGER AS daily_connections_sent,
    COALESCE(SUM(c.daily_limit), 0)::INTEGER AS daily_limit_total,
    COALESCE(SUM(GREATEST(c.daily_limit - c.daily_sent, 0)), 0)::INTEGER AS remaining_today,
    (
      SELECT MIN(ce.created_at + INTERVAL '2 hours') 
      FROM campaign_executions ce 
      JOIN campaigns c2 ON c2.id = ce.campaign_id
      WHERE c2.user_id = p_user_id 
        AND ce.status = 'running'
        AND ce.created_at >= CURRENT_DATE
    ) AS next_execution_time
  FROM campaigns c
  WHERE c.user_id = p_user_id;
END;
$$; 