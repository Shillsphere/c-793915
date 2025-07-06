-- Fix campaign deletion issues without changing data types
-- The issue is that RLS policies are preventing deletion of related records

-- Step 1: Allow users to delete invites related to their campaigns
DROP POLICY IF EXISTS "Users can view their own invites" ON public.invites;
CREATE POLICY "Users can manage their own invites"
ON public.invites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = invites.prospect_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = invites.prospect_id AND c.user_id = auth.uid()
  )
);

-- Step 2: Allow users to delete prospects related to their campaigns
DROP POLICY IF EXISTS "Users can view their own prospects" ON public.prospects;
CREATE POLICY "Users can manage their own prospects"
ON public.prospects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = prospects.campaign_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = prospects.campaign_id AND c.user_id = auth.uid()
  )
);

-- Step 3: Allow users to delete messages related to their campaigns
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can manage their own messages"
ON public.messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = messages.prospect_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prospects p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = messages.prospect_id AND c.user_id = auth.uid()
  )
);

-- Step 4: Allow users to delete campaign executions related to their campaigns
DROP POLICY IF EXISTS "Users can view their own campaign executions" ON public.campaign_executions;
CREATE POLICY "Users can manage their own campaign executions"
ON public.campaign_executions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_executions.campaign_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_executions.campaign_id AND c.user_id = auth.uid()
  )
);

-- Step 5: Ensure campaigns policy allows deletion
DROP POLICY IF EXISTS "Users can manage their own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage their own campaigns"
ON public.campaigns
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 6: Handle any direct campaign_id references in invites table
-- If the invites table has a direct campaign_id column, allow users to manage those too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invites' 
    AND column_name = 'campaign_id'
  ) THEN
    DROP POLICY IF EXISTS "Users can manage invites by campaign" ON public.invites;
    CREATE POLICY "Users can manage invites by campaign"
    ON public.invites
    FOR ALL
    TO authenticated
    USING (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = invites.campaign_id AND c.user_id = auth.uid()
      )
    )
    WITH CHECK (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = invites.campaign_id AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Step 7: Handle any direct campaign_id references in messages table  
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'campaign_id'
  ) THEN
    DROP POLICY IF EXISTS "Users can manage messages by campaign" ON public.messages;
    CREATE POLICY "Users can manage messages by campaign"
    ON public.messages
    FOR ALL
    TO authenticated
    USING (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = messages.campaign_id AND c.user_id = auth.uid()
      )
    )
    WITH CHECK (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = messages.campaign_id AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Step 8: Handle connection_followups if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'connection_followups'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their own followups" ON public.connection_followups;
    CREATE POLICY "Users can manage their own followups"
    ON public.connection_followups
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Step 9: Handle job_logs if they exist  
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'job_logs'
  ) THEN
    DROP POLICY IF EXISTS "Users can manage job logs" ON public.job_logs;
    CREATE POLICY "Users can manage job logs"
    ON public.job_logs
    FOR ALL
    TO authenticated
    USING (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = job_logs.campaign_id AND c.user_id = auth.uid()
      )
    )
    WITH CHECK (
      campaign_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = job_logs.campaign_id AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$; 