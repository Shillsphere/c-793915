// In project root, run with `npx ts-node admin-setup.ts`
import { createClient } from '@supabase/supabase-js';
import Browserbase from '@browserbasehq/sdk';
import 'dotenv/config';
import * as readline from 'readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

async function setupUserContext(userId: string) {
  console.log(`Setting up context for user: ${userId}`);

  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: { persist: true },
  });

  const { debuggerFullscreenUrl } = await bb.sessions.debug(session.id);
  
  console.log("\n--- ACTION REQUIRED ---");
  console.log("1. Open this URL in your browser:", debuggerFullscreenUrl);
  console.log("2. Log in to the user's LinkedIn account.");
  
  await rl.question("Press Enter here after successful login...");

  const finishedSession = await bb.sessions.retrieve(session.id);
  const contextId = finishedSession.browserSettings?.context?.id;
  if (!contextId) throw new Error("Could not find context ID.");
  
  console.log(`Login successful. Persisted Context ID: ${contextId}`);

  const { error } = await supabaseAdmin
    .from('user_browserbase_contexts')
    .upsert({ user_id: userId, context_id: contextId, context_ready: true }, { onConflict: 'user_id' });

  if (error) throw new Error(`Failed to save context: ${error.message}`);

  console.log(`✅ Success! Context for user ${userId} is saved and ready.`);
  
  await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" });
  rl.close();
}

rl.question("Enter the Supabase User ID to set up: ").then(setupUserContext).catch(console.error); 