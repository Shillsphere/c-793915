// @ts-nocheck
// deno-lint-ignore-file
// Supabase Edge Function: create-browserbase-context

import { serve } from 'https://deno.land/std@0.205.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables to be set in Supabase Dashboard
const BB_API_URL = 'https://api.browserbase.com/v1'
const BB_KEY = Deno.env.get('BROWSERBASE_API_KEY')!
const BB_PROJ = Deno.env.get('BROWSERBASE_PROJECT_ID')!
const SUPA_URL = Deno.env.get('SUPABASE_URL')!
const SUPA_ANON = Deno.env.get('SUPABASE_ANON_KEY')!  // for user client
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE')! // for admin ops

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
    console.log('Inside TRY – intentionally throwing a test error');
    throw new Error('Testing error logging! If you see this, core runtime works.');
  } catch (error) {
    console.error('--- DIAGNOSTIC CRASH REPORT ---');
    console.error('Error Name   :', (error as Error).name);
    console.error('Error Message:', (error as Error).message);
    console.error('--- END DIAGNOSTIC CRASH REPORT ---');

    return new Response(
      JSON.stringify({ error: `This is a test error: ${(error as Error).message}` }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    );
  }
}) 