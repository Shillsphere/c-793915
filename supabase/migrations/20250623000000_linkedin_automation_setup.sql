-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create user_browserbase_contexts table
CREATE TABLE public.user_browserbase_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  context_id TEXT NOT NULL,
  context_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT,
  job_search_terms TEXT[] NOT NULL DEFAULT '{}',
  daily_limit INTEGER NOT NULL DEFAULT 10,
  daily_application_limit INTEGER NOT NULL DEFAULT 10,
  template TEXT,
  cover_letter_template TEXT,
  cta_mode TEXT NOT NULL DEFAULT 'calls' CHECK (cta_mode IN ('calls', 'lead_magnet', 'retreat')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prospects table to track LinkedIn profiles
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  profile_url TEXT NOT NULL,
  first_name TEXT,
  headline TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'messaged', 'replied', 'converted')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_url)
);

-- Create invites table to track connection requests
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected', 'expired'))
);

-- Create messages table to track direct messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  cta_type TEXT NOT NULL DEFAULT 'calls' CHECK (cta_type IN ('calls', 'lead_magnet', 'retreat')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  replied_at TIMESTAMP WITH TIME ZONE,
  reply_body TEXT
);

-- Create campaign_executions table
CREATE TABLE public.campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  messages_sent INTEGER NOT NULL DEFAULT 0,
  invites_sent INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Enable RLS on all tables
ALTER TABLE public.user_browserbase_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_browserbase_contexts
CREATE POLICY "Users can manage their own browserbase contexts"
ON public.user_browserbase_contexts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create RLS policies for campaigns
CREATE POLICY "Users can manage their own campaigns"
ON public.campaigns
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create RLS policies for campaign_executions
CREATE POLICY "Users can view their own campaign executions"
ON public.campaign_executions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_executions.campaign_id AND c.user_id = auth.uid()
  )
);

-- Service role can insert executions (for the cron job)
CREATE POLICY "Service role can manage campaign executions"
ON public.campaign_executions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create RLS policies for prospects
CREATE POLICY "Users can view their own prospects"
ON public.prospects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = prospects.campaign_id AND c.user_id = auth.uid()
  )
);

-- Service role can manage prospects (for the cron job)
CREATE POLICY "Service role can manage prospects"
ON public.prospects
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create RLS policies for invites
CREATE POLICY "Users can view their own invites"
ON public.invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = invites.prospect_id AND c.user_id = auth.uid()
  )
);

-- Service role can manage invites (for the cron job)
CREATE POLICY "Service role can manage invites"
ON public.invites
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create RLS policies for messages
CREATE POLICY "Users can view their own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = messages.prospect_id AND c.user_id = auth.uid()
  )
);

-- Service role can manage messages (for the cron job)
CREATE POLICY "Service role can manage messages"
ON public.messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_prospects_campaign_id ON public.prospects(campaign_id);
CREATE INDEX idx_prospects_profile_url ON public.prospects(profile_url);
CREATE INDEX idx_invites_prospect_id ON public.invites(prospect_id);
CREATE INDEX idx_messages_prospect_id ON public.messages(prospect_id);
CREATE INDEX idx_campaign_executions_campaign_id ON public.campaign_executions(campaign_id);
CREATE INDEX idx_campaign_executions_executed_at ON public.campaign_executions(executed_at);

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_browserbase_contexts_updated_at
BEFORE UPDATE ON public.user_browserbase_contexts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule the LinkedIn automation to run weekdays at 2:30 PM UTC (9:30 AM Central)
SELECT cron.schedule(
  'linkedin_weekdays',
  '30 14 * * 1-5',
  $$ SELECT net.http_post('https://ebgezhrvlqvornidwfqv.supabase.co/functions/v1/linkedin_job', '{}') $$
);

-- Create a function to safely call the edge function (alternative approach)
CREATE OR REPLACE FUNCTION public.trigger_linkedin_automation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function can be called by pg_cron as a backup method
  -- or used for manual triggering
  PERFORM net.http_post(
    url := 'https://ebgezhrvlqvornidwfqv.supabase.co/functions/v1/linkedin_job',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$; 