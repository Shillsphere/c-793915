-- supabase/migrations/20250703000000_add_connection_followups_table.sql

-- Create connection_followups table for tracking follow-up campaigns
CREATE TABLE IF NOT EXISTS connection_followups (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_name TEXT,
  prospect_profile_url TEXT NOT NULL,
  prospect_first_name TEXT,
  connection_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connection_accepted_at TIMESTAMP WITH TIME ZONE,
  follow_up_sent_at TIMESTAMP WITH TIME ZONE,
  follow_up_message TEXT,
  follow_up_status TEXT DEFAULT 'pending' CHECK (follow_up_status IN ('pending', 'sent', 'replied', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, prospect_profile_url)
);

-- Enable RLS
ALTER TABLE connection_followups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for connection_followups
CREATE POLICY "Users can view their own followups"
ON connection_followups
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all followups (for automation)
CREATE POLICY "Service role can manage followups"
ON connection_followups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_connection_followups_campaign_id ON connection_followups(campaign_id);
CREATE INDEX idx_connection_followups_user_id ON connection_followups(user_id);
CREATE INDEX idx_connection_followups_status ON connection_followups(follow_up_status);
CREATE INDEX idx_connection_followups_connection_accepted_at ON connection_followups(connection_accepted_at);
CREATE INDEX idx_connection_followups_follow_up_sent_at ON connection_followups(follow_up_sent_at); 