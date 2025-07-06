// deno-lint-ignore-file no-explicit-any
// @ts-ignore deno std import
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore stripe deno shim
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";

// ------- ENV -------
// @ts-ignore Deno global provided at runtime
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
// @ts-ignore
const PRICE_ID = Deno.env.get("STRIPE_PRICE_EARLY_ACCESS");
// @ts-ignore
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:8080";

if (!STRIPE_SECRET_KEY || !PRICE_ID) {
  console.error("Missing Stripe env vars");
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${SITE_URL}/?payment=success`,
      cancel_url: `${SITE_URL}/?payment=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 