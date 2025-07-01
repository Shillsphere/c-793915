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

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Stagehand } from "npm:@browserbasehq/stagehand@2";
import { z } from "npm:zod@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  /* ----------------------- Input validation ---------------------- */
  let campaign_id: string;
  try {
    const body = await req.json();
    campaign_id = z.union([z.string(), z.number()]).parse(body.campaign_id) + "";
  } catch (_) {
    return json(400, { error: "campaign_id (uuid or number) required" });
  }

  /* ----------------------- Fast-forward to worker ---------------- */
  const WORKER_URL = Deno.env.get("WORKER_URL");
  if (WORKER_URL) {
    try {
      const r = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      });
      const bodyText = await r.text();
      return json(r.status, { forwarded: true, ...safeJson(bodyText) });
    } catch (err) {
      return json(502, { error: "Worker unreachable", details: err.message });
    }
  }

  console.log("▶️ campaign", campaign_id);

  /* ----------------------- Supabase client ----------------------- */
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  /* ---------------- Fetch campaign & context -------------------- */
  const { data: campaign, error: cErr } = await db
    .from("campaigns")
    .select("id,user_id,daily_limit,keywords,search_page,targeting_criteria")
    .eq("id", campaign_id)
    .single();
  if (cErr) return json(404, { error: cErr.message });

  const { data: ctx, error: ctxErr } = await db
    .from("user_browserbase_contexts")
    .select("context_id")
    .eq("user_id", campaign.user_id)
    .eq("context_ready", true)
    .single();
  if (ctxErr || !ctx) return json(412, { error: "User has no ready context" });

  /* ----------------------- Run automation ----------------------- */
  let sh: Stagehand | undefined;
  const result = await Promise.race([
    run(ctx.context_id, campaign),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("timeout_25s")), 25_000)),
  ]).catch((e) => e);

  if (result instanceof Error) {
    const type = classifyError(result.message);
    await db.from("campaign_executions").insert({
      campaign_id,
      error_message: result.message,
      error_type: type,
      status: "failed",
    });
    return json(500, { error: result.message, type });
  }

  await db.from("campaign_executions").insert({
    campaign_id,
    invites_sent: result.invitesSent,
    status: "completed",
  });
  return json(200, { success: true, ...result });

  /* ---------------------- helper functions ---------------------- */
  async function run(contextId: string, camp: any) {
    sh = new Stagehand({
      env: "BROWSERBASE",
      apiKey: Deno.env.get("BROWSERBASE_API_KEY")!,
      projectId: Deno.env.get("BROWSERBASE_PROJECT_ID")!,
      browserbaseSessionCreateParams: {
        projectId: Deno.env.get("BROWSERBASE_PROJECT_ID")!,
        browserSettings: {
          context: { id: contextId, persist: true },
          proxies: true,
          advancedStealth: true,
          blockAds: true,
          viewport: { width: 1440, height: 900 },
        },
      },
      modelName: "gpt-4o-mini",
      modelClientOptions: { apiKey: Deno.env.get("OPENAI_API_KEY")! },
      selfHeal: true,
      enableCaching: true,
      verbose: 1,
      domSettleTimeoutMs: 4_000,
      logger: (l) => console.log(`[sh:${l.category}]`, l.message),
    });

    try {
      await sh.init();
      const { page } = sh;

      /* ----- auth / warning detection ---------------------------- */
      const warn = await page.extract({
        instruction:
          "Is LinkedIn asking for login, verification, captcha, or unusual activity?",
        schema: z.object({
          needsAuth: z.boolean(),
          hasWarning: z.boolean(),
          warningText: z.string().optional(),
        }),
      });
      if (warn.needsAuth || warn.hasWarning) {
        await db.from("user_browserbase_contexts")
          .update({ context_ready: false })
          .eq("user_id", camp.user_id);
        throw new Error(`auth_required${warn.warningText ? " | " + warn.warningText : ""}`);
      }

      /* ----- navigate to search page ----------------------------- */
      const kw = (camp.keywords ?? "").toString().trim();
      if (!kw) throw new Error("no_keywords");
      await page.goto(
        `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}&page=${camp.search_page}`,
        { timeout: 30_000 },
      );

      /* ----- invite loop ---------------------------------------- */
      const limit = Math.min(5, camp.daily_limit ?? 10);
      let sent = 0;
      while (sent < limit) {
        const obs = await page.observe("Locate all visible Connect buttons in search results");
        if (!obs?.length) throw new Error("no_target_buttons");

        await page.act("Click the Connect button next to the first result");
        await page.act("Click the blue Send invitation button in the modal");
        sent++;

        await page.waitForTimeout(800 + Math.random() * 2000);
        if (Math.random() < 0.3) await page.act("Move mouse randomly on page");
        if (sent < limit) await page.act("Scroll down slightly to reveal more results");
      }

      await db.from("campaigns")
        .update({ search_page: camp.search_page + 1 })
        .eq("id", camp.id);

      return { invitesSent: sent };
    } finally {
      if (sh) await sh.close();
    }
  }
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function safeJson(t: string) {
  try { return JSON.parse(t); } catch { return t ? { raw: t } : {}; }
}
function classifyError(msg: string) {
  if (msg.startsWith("timeout")) return "timeout";
  if (msg.includes("auth")) return "auth";
  if (msg.includes("no_target")) return "no_targets";
  return "unknown";
} 