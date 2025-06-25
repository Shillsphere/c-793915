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

serve(async (req: Request) => {
  /* ─ OPTIONS pre-flight ─ */
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    // 1. Identify user from JWT coming through the proxy
    const userClient = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Authentication failed: invalid JWT.')

    // 2. Create Browserbase context
    const bbHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${BB_KEY}` }

    const ctxRes = await fetch(`${BB_API_URL}/contexts`, {
      method: 'POST', headers: bbHeaders,
      body: json({ projectId: BB_PROJ, name: `ctx-${user.id}` }),
    })
    if (!ctxRes.ok) throw new Error(await ctxRes.text())
    const { id: contextId } = await ctxRes.json()

    // 3. Create session (persist = true)
    const sesRes = await fetch(`${BB_API_URL}/sessions`, {
      method: 'POST', headers: bbHeaders,
      body: json({ projectId: BB_PROJ, contextId, persist: true }),
    })
    if (!sesRes.ok) throw new Error(await sesRes.text())
    const { connectUrl } = await sesRes.json()

    // 4. Upsert into DB with service-role key
    const admin = createClient(SUPA_URL, SERVICE_KEY)
    const { error: dbErr } = await admin
      .from('user_browserbase_contexts')
      .upsert({ user_id: user.id, context_id: contextId, context_ready: false }, { onConflict: 'user_id' })
    if (dbErr) throw dbErr

    return new Response(json({ connectUrl, contextId }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('--- FUNCTION CRASH REPORT ---', err.message)
    return new Response(json({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}) 