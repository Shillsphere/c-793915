-- This command tells Postgres that the `user_id` in the `campaigns` table
-- is the exact same thing as the `user_id` in the `user_browserbase_contexts` table.
-- This is the relationship the database needs to perform the query.

-- Only add campaigns constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_user_id_fkey') THEN
    ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Only add user_browserbase_contexts constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_browserbase_contexts_user_id_fkey') THEN
    ALTER TABLE public.user_browserbase_contexts
    ADD CONSTRAINT user_browserbase_contexts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- This establishes the link so Supabase can join them.
-- ON DELETE CASCADE ensures proper cleanup when a user is deleted.
