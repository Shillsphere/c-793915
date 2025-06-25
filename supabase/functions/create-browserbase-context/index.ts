// @ts-nocheck
// deno-lint-ignore-file
// Supabase Edge Function: create-browserbase-context

import { serve } from 'https://deno.land/std@0.205.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables to be set in Supabase Dashboard
// TODO: replace with your unique webhook.site URL for diagnostics
const BB_API_URL = 'https://webhook.site/fe116f15-8f77-413d-8858-06a37b6ff2f0'
const BB_KEY = Deno.env.get('BROWSERBASE_API_KEY')!
const BB_PROJ = Deno.env.get('BROWSERBASE_PROJECT_ID')!
const SUPA_URL = Deno.env.get('SUPABASE_URL')!
const SUPA_ANON = Deno.env.get('SUPABASE_ANON_KEY')!  // for user client
const SERVICE_ROLE = Deno.env.get('PROJECT_SERVICE_ROLE_KEY')! // for admin ops

// Define standard headers
const json = (x: unknown) => JSON.stringify(x)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Diagnostic function loaded – awaiting requests.');

serve(async (req: Request) => {
  console.log(`[${new Date().toISOString()}] Received ${req.method} ${req.url}`);

  /* ─ OPTIONS pre-flight ─ */
  if (req.method === 'OPTIONS') {
    console.log('Responding 200 to OPTIONS pre-flight');
    return new Response('ok', { status: 200, headers: cors })
  }

  try {
    // 1. Identify current user via JWT forwarded from Vite proxy
    const userClient = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr) throw authErr;
    if (!user) throw new Error('Authentication failed: invalid JWT.');

    // 2. Create Browserbase context
    const bbHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BB_KEY}`,
    };

    const ctxRes = await fetch(`${BB_API_URL}/contexts`, {
      method: 'POST',
      headers: bbHeaders,
      body: json({ projectId: BB_PROJ, name: `ctx-${user.id}` }),
    });
    if (!ctxRes.ok) throw new Error(`Browserbase context error: ${await ctxRes.text()}`);
    const { id: contextId } = await ctxRes.json();

    // 3. Create persistent session
    const sesRes = await fetch(`${BB_API_URL}/sessions`, {
      method: 'POST',
      headers: bbHeaders,
      body: json({ projectId: BB_PROJ, contextId, persist: true }),
    });
    if (!sesRes.ok) throw new Error(`Browserbase session error: ${await sesRes.text()}`);
    const { connectUrl } = await sesRes.json();

    // 4. Upsert context in DB via service-role key (bypass RLS)
    const admin = createClient(SUPA_URL, SERVICE_ROLE);
    const { error: dbErr } = await admin
      .from('user_browserbase_contexts')
      .upsert({ user_id: user.id, context_id: contextId, context_ready: false }, { onConflict: 'user_id' });
    if (dbErr) throw dbErr;

    return new Response(json({ connectUrl, contextId }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('--- FUNCTION CRASH REPORT ---', error.message);
    return new Response(json({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}) 

// Diagnostic Probe for create-browserbase-context
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log(`[${new Date().toISOString()}] Probe loaded and waiting for requests…`);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`[${new Date().toISOString()}] Probe received ${req.method} ${req.url}`);

    // Read expected secrets
    const secrets = {
      BROWSERBASE_API_KEY: !!Deno.env.get('BROWSERBASE_API_KEY'),
      BROWSERBASE_PROJECT_ID: !!Deno.env.get('BROWSERBASE_PROJECT_ID'),
      SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
      PROJECT_SERVICE_ROLE_KEY: !!Deno.env.get('PROJECT_SERVICE_ROLE_KEY'),
    };

    console.log('--- DIAGNOSTIC REPORT: SECRETS ---');
    for (const [k, v] of Object.entries(secrets)) {
      console.log(`${k} defined: ${v}`);
    }
    console.log('--- END REPORT ---');

    if (Object.values(secrets).some((v) => v === false)) {
      throw new Error('One or more secrets are MISSING from the cloud environment!');
    }

    return new Response(
      JSON.stringify({ status: 'SUCCESS', message: 'All secrets found. The environment is OK.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('--- PROBE CRASH REPORT ---');
    console.error('Error Message:', error.message);
    console.error('--- END PROBE CRASH REPORT ---');

    return new Response(
      JSON.stringify({ error: `Probe failed: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}); 