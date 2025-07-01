// supabase/functions/finalize-context-session/index.ts
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Browserbase from 'npm:@browserbasehq/sdk@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id is required');

    // DB admin client
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch the row to obtain context & last session id
    const { data: ctxRow, error: fetchErr } = await admin
      .from('user_browserbase_contexts')
      .select('context_id, latest_session_id')
      .eq('user_id', user_id)
      .single();

    if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);
    if (!ctxRow?.latest_session_id) throw new Error('No active login session found to finalize.');

    const { context_id, latest_session_id } = ctxRow;

    const bb = new Browserbase({ apiKey: Deno.env.get('BROWSERBASE_API_KEY')! });

    // Request session release so cookies persist in the context
    await bb.sessions.update(latest_session_id, {
      projectId: Deno.env.get('BROWSERBASE_PROJECT_ID')!,
      status: 'REQUEST_RELEASE',
    });

    // Wait briefly for Browserbase to sync context
    await new Promise((res) => setTimeout(res, 3000));

    // Mark context as ready
    const { error: updateErr } = await admin
      .from('user_browserbase_contexts')
      .update({ context_ready: true })
      .eq('user_id', user_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({ success: true, contextId: context_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[finalize-context-session] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 