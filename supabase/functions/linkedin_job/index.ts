// supabase/functions/linkedin_job/index.ts
// @ts-nocheck

// LinkedIn campaign runner Edge Function
// ------------------------------------------------------------
// This function is triggered manually (or by pg_cron) with a JSON
// payload of `{ campaign_id: UUID }`.
//
// 1. Looks up the campaign & owning user
// 2. Verifies the user has a READY Browserbase context
// 3. Boots a Browserbase session attached to that context
// 4. Runs LinkedIn automation using Stagehand with *atomic* actions
//    and generous timeouts for higher reliability
// 5. Records a campaign_executions row plus invite records
// 6. Safely tears-down the session and releases the context
// ------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Stagehand } from "npm:@browserbasehq/stagehand@2";
import { z } from "npm:zod@3";

// CORS for dashboard > "Run now" button & local dev
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Pre-flight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Parse and validate request body with detailed logging
  let parsed: { campaign_id: string };
  try {
    const body = await req.json();
    console.log("[linkedin_job] Received body", body);
    parsed = z
      .object({ campaign_id: z.union([z.string(), z.number()]) })
      .parse(body);
  } catch (e) {
    console.error("[linkedin_job] Validation error", e);
    return new Response(
      JSON.stringify({ error: "Invalid payload – campaign_id (uuid or number) required", details: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const campaign_id = String(parsed.campaign_id);

  // ────────────────────────────────────────────────────────────
  // OPTIONAL: forward the job to an external long-running worker
  // If WORKER_URL is configured, we immediately POST the payload
  // to that service and return its response. This keeps the Edge
  // Function extremely light so it never hits Supabase CPU caps.
  // ────────────────────────────────────────────────────────────
  const WORKER_URL = Deno.env.get("WORKER_URL");
  if (WORKER_URL) {
    try {
      const fwResp = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      });

      const json = await fwResp.json();
      return new Response(JSON.stringify({ forwarded: true, ...json }), {
        status: fwResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[linkedin_job] Worker forwarding failed", err);
      return new Response(
        JSON.stringify({ error: "Failed to forward job to worker", details: err.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  console.log(`[linkedin_job] ▶️  Starting run for campaign ${campaign_id}`);

  // ────────────────────────────────────────────────────────────
  // Supabase admin client (service role)
  // ────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Utility for quick JSON responses
  const respond = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ────────────────────────────────────────────────────────────
  // 1. Fetch campaign & user
  // ────────────────────────────────────────────────────────────
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, user_id, daily_limit, keywords, search_page")
    .eq("id", campaign_id)
    .single();

  if (campErr) return respond(404, { error: `Campaign not found: ${campErr.message}` });

  // ────────────────────────────────────────────────────────────
  // 2. Locate ready Browserbase context for the user
  // ────────────────────────────────────────────────────────────
  const { data: ctxRow, error: ctxErr } = await supabase
    .from("user_browserbase_contexts")
    .select("context_id")
    .eq("user_id", campaign.user_id)
    .eq("context_ready", true)
    .single();

  if (ctxErr || !ctxRow) {
    return respond(412, { error: "No ready Browserbase context for user. Ask them to connect their account." });
  }

  const contextId = ctxRow.context_id;
  console.log(`[linkedin_job] 🟢 Using Browserbase context ${contextId}`);

  // ────────────────────────────────────────────────────────────
  // 3. Prepare Stagehand – let it create session with our context
  // ────────────────────────────────────────────────────────────
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: Deno.env.get("BROWSERBASE_API_KEY")!,
    projectId: Deno.env.get("BROWSERBASE_PROJECT_ID")!,
    // Tell Stagehand to spin up a session using the user's persisted context
    browserbaseSessionCreateParams: {
      projectId: Deno.env.get("BROWSERBASE_PROJECT_ID")!,
      browserSettings: {
        context: { id: contextId, persist: true },
        proxy: false,
        advancedStealth: true,
        blockAds: true,
        viewport: { width: 1440, height: 900 },
        proxies: true,
      },
    },
    modelName: "gpt-4o-mini",
    modelClientOptions: {
      apiKey: Deno.env.get("OPENAI_API_KEY")!,
    },
    verbose: 1,
    domSettleTimeoutMs: 5_000,
    enableCaching: true,
    // Use simple console logger to avoid thread-stream
    logger: (log) => console.log(`[stagehand:${log.category}]`, log.message),
  });

  try {
    // Stagehand will spin up and connect to Browserbase automatically
    await stagehand.init();
    const { page } = stagehand;

    // ────────────────────────────────────────────────────────────
    // Navigate to LinkedIn search for campaign keywords
    // ────────────────────────────────────────────────────────────

    const keywords: string = (campaign.keywords ?? "").toString().trim();
    if (!keywords) {
      return respond(400, { error: "Campaign has no keywords set to perform search." });
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&page=${campaign.search_page}`;

    console.log(`[linkedin_job] 🔍 Navigating to search URL: ${searchUrl}`);
    await page.goto(searchUrl, { timeout: 30_000 });
    await page.waitForTimeout(5_000);

    // QUICK LOGIN CHECK (some redirects happen on search too)
    if (page.url().includes("login")) {
      console.warn("[linkedin_job] 🔴 Detected login page – context is no longer authenticated");
      await supabase
        .from("user_browserbase_contexts")
        .update({ context_ready: false })
        .eq("user_id", campaign.user_id);

      return respond(409, { error: "LinkedIn session expired – user must reconnect." });
    }

    // ─────────────── Stagehand Automation – Send Invites ───────────────
    const dailyLimit = campaign.daily_limit ?? 10;
    const batchSize = Math.min(5, dailyLimit);
    let invitesSent = 0;

    while (invitesSent < batchSize) {
      try {
        await page.act("Click the Connect button for a person in the search results", {
          timeoutMs: 7_000,
          domSettleTimeoutMs: 4_000,
        });

        await page.waitForTimeout(1_000); // wait for modal

        await page.act("Click the Send button without adding a note", {
          timeoutMs: 7_000,
          domSettleTimeoutMs: 3_000,
        });

        invitesSent++;
        console.log(`[linkedin_job] ✅ Invite sent (${invitesSent}/${dailyLimit})`);

        // Simple rate-limit pause
        await page.waitForTimeout(1000 + Math.random() * 1500);
      } catch (err) {
        console.log("[linkedin_job] No more connect buttons or error", err.message);

        // Attempt to scroll to reveal more suggestions; break if can't
        try {
          await page.act("Scroll down to load more people");
          await page.waitForTimeout(500 + Math.random()*700);
        } catch (_) {
          break;
        }
      }
    }

    // Advance cursor page for next run
    await supabase.from("campaigns").update({ search_page: campaign.search_page + 1 }).eq("id", campaign_id);

    // ─────────────── Record execution stats ───────────────
    await supabase.from("campaign_executions").insert({
      campaign_id,
      invites_sent: invitesSent,
      status: "completed",
    });

    console.log(`[linkedin_job] 🎉 Completed run – ${invitesSent} invites sent`);

    // Clean up
    await stagehand.close();

    return respond(200, { success: true, invitesSent });
  } catch (err) {
    console.error("[linkedin_job] 🔥 Unhandled error", err);
    // Attempt to capture failure in executions table
    await supabase.from("campaign_executions").insert({
      campaign_id,
      error_message: err.message || "Unknown error",
      status: "failed",
    });

    return respond(500, { error: err.message });
  }
}); 