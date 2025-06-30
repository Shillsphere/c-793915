-- Add context_ready column to user_browserbase_contexts if it does not exist
ALTER TABLE public.user_browserbase_contexts
ADD COLUMN IF NOT EXISTS context_ready BOOLEAN DEFAULT false; 