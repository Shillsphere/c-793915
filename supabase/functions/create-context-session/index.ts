// supabase/functions/create-context-session/index.ts
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Browserbase from 'npm:@browserbasehq/sdk@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id is required');

    const bb = new Browserbase({ apiKey: Deno.env.get('BROWSERBASE_API_KEY')! });
    const projectId = Deno.env.get('BROWSERBASE_PROJECT_ID')!;

    // 1. Create a new browser context (persisted)
    const context = await bb.contexts.create({ projectId });

    // 2. Start a session attached to that context so cookies persist
    const session = await bb.sessions.create({
      projectId,
      browserSettings: { 
        context: { id: context.id, persist: true },
        proxy: false, // Bypass Browserbase proxy to avoid tunnel failures
      },
    });

    // 3. Obtain the Live View (debug) URL for end-user interaction
    const { debuggerFullscreenUrl } = await bb.sessions.debug(session.id);

    // 4. Persist in Supabase so `finalize-context-session` can locate the session later
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: dbErr } = await admin.from('user_browserbase_contexts').upsert(
      {
        user_id,
        context_id: context.id,
        latest_session_id: session.id,
        context_ready: false,
      },
      { onConflict: 'user_id' }
    );

    if (dbErr) throw new Error(`DB upsert failed: ${dbErr.message}`);

    // 5. Return the Live View URL for the frontend to open
    return new Response(
      JSON.stringify({ liveViewUrl: debuggerFullscreenUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[create-context-session] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 