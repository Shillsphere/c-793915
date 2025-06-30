-- Add back user_id and campaign_id columns to logs for dashboard queries
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES public.campaigns(id);

CREATE INDEX IF NOT EXISTS idx_invites_user_id ON public.invites(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON public.messages(campaign_id); 