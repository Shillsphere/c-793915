-- Adds a column to track the most recent Browserbase login session for each user
ALTER TABLE public.user_browserbase_contexts
ADD COLUMN IF NOT EXISTS latest_session_id TEXT;

