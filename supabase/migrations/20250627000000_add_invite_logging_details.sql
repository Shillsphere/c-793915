-- Add campaign and prospect identifiers directly to the invites log for efficient de-duplication.
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES public.campaigns(id),
ADD COLUMN IF NOT EXISTS prospect_linkedin_id TEXT;

-- Create an index for fast duplicate checking.
CREATE INDEX IF NOT EXISTS idx_invites_prospect_linkedin_id ON public.invites(prospect_linkedin_id);

-- The `prospects` table will NOT be dropped to avoid breaking foreign key constraints.
-- We will deprecate it in a future, separate migration. 