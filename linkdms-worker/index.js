// linkdms-worker/index.js
// Node.js Worker Service for LinkedIn Automation using Stagehand
import express from 'express';
import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import OpenAI from 'openai';
import crypto from 'node:crypto';
import detector from 'gender-detection';

// Initialize a single Supabase client that can be reused across requests and helper functions
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();

// CORS middleware to allow requests from the frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());

// ==================== FOLLOW-UP SYSTEM ====================

// Create follow-up tracking table schema (run this manually in Supabase first)
const ensureFollowUpTables = async () => {
  console.log('[Worker] Ensuring follow-up tracking tables exist...');
  // This should be run as a migration, but including here for reference
  /*
  CREATE TABLE IF NOT EXISTS connection_followups (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT REFERENCES campaigns(id),
    user_id UUID REFERENCES auth.users(id),
    prospect_name TEXT,
    prospect_profile_url TEXT,
    prospect_first_name TEXT,
    connection_sent_at TIMESTAMP DEFAULT NOW(),
    connection_accepted_at TIMESTAMP,
    follow_up_sent_at TIMESTAMP,
    follow_up_message TEXT,
    follow_up_status TEXT DEFAULT 'pending', -- pending, sent, replied, failed
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, prospect_profile_url)
  );
  */
};

// Enhanced connection detection using Stagehand
async function detectNewConnections(page, campaign, lastCheckTime) {
  try {
    console.log(`[Worker] 🔍 Checking for new connections since ${lastCheckTime?.toISOString()}`);
    
    // Navigate to connections page
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Use Stagehand to intelligently find recent connections
    const connectionsData = await page.observe(
      `Find all LinkedIn connections on this page. For each connection, extract:
       - Their full name
       - Their profile URL (from the profile link)
       - When they connected (look for "Connected" or recent timestamps)
       
       Focus on connections that appear to be recent (within the last few days).`
    );
    
    console.log(`[Worker] 🔍 Found ${connectionsData?.length || 0} total connections`);
    
    // Filter connections that might be from our campaigns
    const potentialCampaignConnections = [];
    
    if (connectionsData && Array.isArray(connectionsData)) {
      for (const connection of connectionsData) {
        if (connection.profileUrl && connection.name) {
          // Check if this profile was part of any recent campaign activity
          const { data: existingFollowup } = await db
            .from('connection_followups')
            .select('*')
            .eq('campaign_id', campaign.id)
            .eq('prospect_profile_url', connection.profileUrl)
            .eq('follow_up_status', 'pending')
            .maybeSingle();
            
          if (existingFollowup) {
            // Update the connection as accepted
            await db
              .from('connection_followups')
              .update({ 
                connection_accepted_at: new Date().toISOString(),
                prospect_name: connection.name 
              })
              .eq('id', existingFollowup.id);
              
            potentialCampaignConnections.push({
              ...connection,
              campaignId: campaign.id,
              followupId: existingFollowup.id
            });
          }
        }
      }
    }
    
    console.log(`[Worker] ✅ Found ${potentialCampaignConnections.length} new campaign connections`);
    return potentialCampaignConnections;
    
  } catch (error) {
    console.error('[Worker] ❌ Error detecting connections:', error.message);
    return [];
  }
}

// Dynamic message template system
function generateFollowUpMessage(firstName, campaign, userProfile = null) {
  const template = campaign.template || '';
  
  // Replace dynamic placeholders
  let message = template
    .replace(/\{firstName\}/g, firstName || 'there')
    .replace(/\{name\}/g, firstName || 'there')
    .replace(/\{first_name\}/g, firstName || 'there');
  
  // If no template provided, use a generic professional message
  if (!message.trim()) {
    message = `Hi ${firstName || 'there'}, thanks for connecting! I'd love to learn more about your work and see if there are ways we can support each other professionally.`;
  }
  
  // Add variations to avoid spam detection
  const variations = [
    message,
    `Hi ${firstName || 'there'}! ` + message.replace(/^Hi [^,]+,?\s*/i, ''),
    message.replace('Hi ', 'Hey ').replace('Hello ', 'Hi '),
  ];
  
  return variations[Math.floor(Math.random() * variations.length)];
}

// Safe follow-up message sending with Stagehand
async function sendFollowUpMessage(page, prospect, campaign) {
  try {
    console.log(`[Worker] 💬 Sending follow-up to ${prospect.name || 'unknown'}`);
    
    // Navigate to prospect's profile
    await page.goto(prospect.profileUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Random delay to mimic human behavior
    await page.waitForTimeout(getRandomDelay(2000, 4000));
    
    // Use Stagehand to find and click message button
    await page.act("Find and click the 'Message' button to start a conversation with this person");
    await page.waitForTimeout(getRandomDelay(1500, 3000));
    
    // Generate personalized follow-up message
    const firstName = prospect.firstName || prospect.name?.split(' ')[0] || '';
    const personalizedMessage = generateFollowUpMessage(firstName, campaign);
    
    console.log(`[Worker] 📝 Generated message: "${personalizedMessage.substring(0, 100)}..."`);
    
    // Type message with human-like delays
    await page.act(`Type this message in the message box: "${personalizedMessage}"`);
    
    // Random pause before sending (human behavior)
    await page.waitForTimeout(getRandomDelay(3000, 8000));
    
    // Send message
    await page.act("Send the message");
    
    // Log successful send to database
    await db
      .from('connection_followups')
      .update({
        follow_up_sent_at: new Date().toISOString(),
        follow_up_message: personalizedMessage,
        follow_up_status: 'sent'
      })
      .eq('id', prospect.followupId);
    
    console.log(`[Worker] ✅ Follow-up sent successfully to ${prospect.name}`);
    return { success: true };
    
  } catch (error) {
    console.error(`[Worker] ❌ Failed to send follow-up to ${prospect.name}:`, error.message);
    
    // Update status to failed
    if (prospect.followupId) {
      await db
        .from('connection_followups')
        .update({
          follow_up_status: 'failed'
        })
        .eq('id', prospect.followupId);
    }
    
    return { success: false, error: error.message };
  }
}

// Safety monitoring for follow-up messages
const followUpSafetyMonitor = {
  maxDailyFollowUps: 20,
  maxHourlyFollowUps: 5,
  // Minimum spacing between follow-ups, overridable with env for smoke-tests
  minDelayBetweenMessages: Number(process.env.MIN_FU_SPACING_MS ?? 300_000), // default 5 min
  
  async checkSafetyLimits(userId) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Check daily limit
    const { count: todayCount } = await db
      .from('connection_followups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('follow_up_status', 'sent')
      .gte('follow_up_sent_at', todayStart.toISOString());
    
    if ((todayCount ?? 0) >= this.maxDailyFollowUps) {
      throw new Error(`Daily follow-up limit reached: ${todayCount ?? 0}/${this.maxDailyFollowUps}`);
    }
    
    // Check hourly limit  
    const { count: hourlyCount } = await db
      .from('connection_followups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('follow_up_status', 'sent')
      .gte('follow_up_sent_at', oneHourAgo.toISOString());
    
    if ((hourlyCount ?? 0) >= this.maxHourlyFollowUps) {
      throw new Error(`Hourly follow-up limit reached: ${hourlyCount ?? 0}/${this.maxHourlyFollowUps}`);
    }
    
    // Check minimum delay
    const { data: lastMessage } = await db
      .from('connection_followups')
      .select('follow_up_sent_at')
      .eq('user_id', userId)
      .eq('follow_up_status', 'sent')
      .order('follow_up_sent_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastMessage?.follow_up_sent_at) {
      const timeSinceLastMessage = now.getTime() - new Date(lastMessage.follow_up_sent_at).getTime();
      if (timeSinceLastMessage < this.minDelayBetweenMessages) {
        const waitTime = Math.ceil((this.minDelayBetweenMessages - timeSinceLastMessage) / 1000);
        throw new Error(`Must wait ${waitTime} seconds before sending next message`);
      }
    }
    
    return true;
  }
};

// Enhanced connection tracking when sending invites
async function trackConnectionForFollowUp(campaign, prospect) {
  try {
    // Only track for follow-up campaigns
    if (campaign.cta_mode !== 'connect_then_followup') {
      return;
    }
    
    const firstName = prospect.name?.split(' ')[0] || '';
    
    // Insert or update tracking record
    const { error } = await db
      .from('connection_followups')
      .upsert({
        campaign_id: campaign.id,
        user_id: campaign.user_id,
        prospect_name: prospect.name,
        prospect_profile_url: prospect.profileUrl || prospect.profile_url,
        prospect_first_name: firstName,
        connection_sent_at: new Date().toISOString(),
        follow_up_status: 'pending'
      }, {
        onConflict: 'campaign_id,prospect_profile_url',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.warn('[Worker] ⚠️ Failed to track connection for follow-up:', error.message);
    } else {
      console.log(`[Worker] 📋 Tracked connection for follow-up: ${prospect.name}`);
    }
  } catch (error) {
    console.warn('[Worker] ⚠️ Error tracking connection:', error.message);
  }
}

// New endpoint for processing follow-ups
app.post('/process-followups', async (req, res) => {
  const { campaign_id } = req.body;
  if (!campaign_id) {
    return res.status(400).json({ error: 'Missing campaign_id' });
  }

  console.log(`[Worker] 🔄 Processing follow-ups for Campaign ID: ${campaign_id}`);

  try {
    // Fetch campaign details
    const { data: campaign, error: cErr } = await db
      .from('campaigns')
      .select('id,user_id,template,cta_mode,campaign_name')
      .eq('id', campaign_id)
      .single();
      
    if (cErr || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Only process follow-up campaigns
    if (campaign.cta_mode !== 'connect_then_followup') {
      return res.status(200).json({ 
        success: true, 
        message: 'Campaign is not a follow-up campaign',
        followUpsSent: 0 
      });
    }

    // Get user context
    const { data: ctx, error: ctxErr } = await db
      .from('user_browserbase_contexts')
      .select('context_id')
      .eq('user_id', campaign.user_id)
      .eq('context_ready', true)
      .single();
      
    if (ctxErr || !ctx) {
      return res.status(412).json({ error: 'User has no ready context' });
    }

    // Check safety limits
    try {
      await followUpSafetyMonitor.checkSafetyLimits(campaign.user_id);
    } catch (safetyError) {
      return res.status(429).json({ 
        error: 'Safety limit reached', 
        details: safetyError.message 
      });
    }

    // Initialize Stagehand
    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserbaseSessionCreateParams: {
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        browserSettings: {
          context: { id: ctx.context_id, persist: true },
          blockAds: true,
          viewport: { width: 1280, height: 720 },
        },
      },
      modelName: 'gpt-4o-mini',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY,
      },
      selfHeal: true,
      enableCaching: false,
      verbose: 1,
      domSettleTimeoutMs: 4000,
      logger: (l) => console.log(`[sh:${l.category}]`, l.message),
    });

    await stagehand.init();
    const { page } = stagehand;

    // 1. Detect new connections
    const lastCheckTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Check last 24 hours
    const newConnections = await detectNewConnections(page, campaign, lastCheckTime);

    // 2. Find connections ready for follow-up (after configured delay)
    const followUpDelay = Number(process.env.FOLLOW_UP_DELAY_MS ?? 86_400_000); // default 24 h
    const cutoffTime = new Date(Date.now() - followUpDelay);
    
    const { data: readyForFollowUp } = await db
      .from('connection_followups')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('follow_up_status', 'pending')
      .not('connection_accepted_at', 'is', null)
      .lte('connection_accepted_at', cutoffTime.toISOString())
      .limit(10); // Process max 10 at a time

    console.log(`[Worker] 📋 Found ${readyForFollowUp?.length || 0} connections ready for follow-up`);

    let followUpsSent = 0;
    
    // 3. Send follow-up messages with safety delays
    if (readyForFollowUp && readyForFollowUp.length > 0) {
      for (const connection of readyForFollowUp) {
        try {
          // Re-check safety limits before each message
          await followUpSafetyMonitor.checkSafetyLimits(campaign.user_id);
          
          const prospect = {
            name: connection.prospect_name,
            firstName: connection.prospect_first_name,
            profileUrl: connection.prospect_profile_url,
            followupId: connection.id
          };
          
          const result = await sendFollowUpMessage(page, prospect, campaign);
          
          if (result.success) {
            followUpsSent++;
            console.log(`[Worker] ✅ Follow-up ${followUpsSent} sent to ${prospect.name}`);
            
            // Wait between messages (5-10 minutes)
            if (followUpsSent < readyForFollowUp.length) {
              const delay = getRandomDelay(300000, 600000); // 5-10 minutes
              console.log(`[Worker] ⏱️ Waiting ${Math.round(delay / 60000)} minutes before next follow-up...`);
              await page.waitForTimeout(delay);
            }
          }
        } catch (error) {
          console.error(`[Worker] ❌ Error sending follow-up to ${connection.prospect_name}:`, error.message);
          
          if (error.message.includes('Safety limit') || error.message.includes('limit reached')) {
            console.log('[Worker] 🛑 Hit safety limit, stopping follow-up processing');
            break;
          }
        }
      }
    }

    await safeClose(stagehand);

    res.status(200).json({
      success: true,
      followUpsSent,
      newConnectionsDetected: newConnections.length,
      campaignId: campaign_id,
    });

  } catch (error) {
    console.error(`[Worker] ❌ Follow-up processing failed:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      campaignId: campaign_id
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'linkdms-worker',
    timestamp: new Date().toISOString()
  });
});

app.post('/run-linkedin-job', async (req, res) => {
  const { campaign_id } = req.body;
  if (!campaign_id) {
    return res.status(400).json({ error: 'Missing campaign_id' });
  }

  console.log(`[Worker] Starting job for Campaign ID: ${campaign_id}`);

  // ----------------- Fetch campaign & context -----------------
  const { data: campaign, error: cErr } = await db
    .from('campaigns')
    .select('id,user_id,daily_limit,daily_sent,keywords,search_page,targeting_criteria,template,cta_mode,campaign_name,kw_variation_index,next_variation,next_page')
    .eq('id', campaign_id)
    .single();
  if (cErr || !campaign) {
    console.error('[Worker] ⚠️ Campaign not found', cErr?.message);
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const { data: ctx, error: ctxErr } = await db
    .from('user_browserbase_contexts')
    .select('context_id')
    .eq('user_id', campaign.user_id)
    .eq('context_ready', true)
    .single();
  if (ctxErr || !ctx) {
    console.error('[Worker] ⚠️ No ready context for user');
    return res.status(412).json({ error: 'User has no ready context' });
  }

  // ===== Aggregate daily limit across campaigns =====
  // Calculate total invites the user has already sent today across ALL campaigns
  const { data: userCampaigns, error: aggErr } = await db
    .from('campaigns')
    .select('daily_sent')
    .eq('user_id', campaign.user_id);
  if (aggErr) {
    console.error('[Worker] ⚠️ Failed to fetch user aggregate sent count', aggErr.message);
    return res.status(500).json({ error: 'Failed to fetch user quota' });
  }
  const userSentToday = (userCampaigns || []).reduce((sum, row) => sum + (row.daily_sent || 0), 0);
  const userRemainingToday = Math.max(0, 30 - userSentToday); // GLOBAL LIMIT = 30

  // Campaign-specific remaining (keeps per-campaign caps intact)
  const campaignRemaining = Math.max(0, (campaign.daily_limit || 0) - (campaign.daily_sent || 0));

  // Final allowed sends for this run is the minimum of user and campaign quota
  const remainingToday = Math.min(userRemainingToday, campaignRemaining);

  if (remainingToday === 0) {
    console.log('[Worker] Daily limit already reached for user or campaign, exiting');
    return res.status(200).json({ success: true, invitesSent: 0, campaignId: campaign_id, note: 'limit_reached' });
  }

  // Initialize Stagehand with the user's persistent context
  let stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        context: { id: ctx.context_id, persist: true },
        blockAds: true,
        viewport: { width: 1280, height: 720 },
      },
    },
    modelName: 'gpt-4o-mini',
    modelClientOptions: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    selfHeal: true,
    enableCaching: false,
    verbose: 1,
    domSettleTimeoutMs: 4000,
    logger: (l) => console.log(`[sh:${l.category}]`, l.message),
  });

  // define helper near top after fetching campaign
  const allowFallback = campaign.cta_mode === 'connect_only' && !campaign.targeting_criteria;

  // ============ KEYWORD HANDLING ============
  let searchKeywords = campaign.keywords?.trim();
  
  if (!searchKeywords) {
    if (campaign.targeting_criteria?.professional?.required_keywords?.length) {
      const reqKw = campaign.targeting_criteria.professional.required_keywords;
      const kwArray = Array.isArray(reqKw) ? reqKw : reqKw.split(',').map(s => s.trim());
      searchKeywords = kwArray.join(' OR ');
    }
  }

  if (!searchKeywords) {
    // Enhanced smart keyword generation for startup/tech campaigns
    console.log('[Worker] No keywords provided, using smart defaults...');
    
    const targeting = campaign.targeting_criteria || {};
    let generatedKeywords = '';
    
    // Check for YC/startup indicators
    if (campaign.campaign_name?.toLowerCase().includes('yc') || 
        campaign.campaign_name?.toLowerCase().includes('combinator')) {
      generatedKeywords = 'YC founder entrepreneur startup';
    } else if (targeting.professional?.industries?.includes('technology')) {
      generatedKeywords = 'startup founder CEO engineer developer';
    } else if (targeting.professional?.job_titles?.length) {
      const titles = Array.isArray(targeting.professional.job_titles) 
        ? targeting.professional.job_titles 
        : targeting.professional.job_titles.split(',').map(s => s.trim());
      generatedKeywords = titles.slice(0, 3).join(' ');
    } else {
      // Generic tech/business keywords
      generatedKeywords = 'founder CEO entrepreneur executive';
    }
    
    searchKeywords = generatedKeywords;
    
    // Persist generated keywords to campaign for future runs
    if (searchKeywords) {
      await db.from('campaigns').update({ keywords: searchKeywords }).eq('id', campaign.id);
      console.log(`[Worker] Generated and saved keywords: ${searchKeywords}`);
    }
  }

  if (!searchKeywords) {
    searchKeywords = 'founder'; // ultimate fallback
    console.log('[Worker] Using fallback keyword: founder');
  }

  try {
    await stagehand.init();
    console.log(`[Worker] ✅ Stagehand initialized successfully using context ${ctx.context_id}`);
    
    let { page } = stagehand;
    let restartCount = 0;
    const maxRestarts = 5; // Allow up to 5 restarts per session
    
    // Helper function to restart Stagehand if browser crashes
    const restartStagehand = async () => {
      if (restartCount >= maxRestarts) {
        console.log(`[Worker] ⚠️ Browser restarted ${restartCount} times already, stopping to avoid loops`);
        return false;
      }
      
      try {
        restartCount++;
        console.log(`[Worker] 🔄 Browser crashed, attempting restart ${restartCount}/${maxRestarts}...`);
        
        // Safe close with timeout
        try {
          await Promise.race([
            safeClose(stagehand),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000))
          ]);
        } catch (closeErr) {
          console.log('[Worker] ⚠️ Force closing browser session...');
        }
        
        // Wait before restart to avoid rapid retries
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        stagehand = new Stagehand({
          env: 'BROWSERBASE',
          apiKey: process.env.BROWSERBASE_API_KEY,
          projectId: process.env.BROWSERBASE_PROJECT_ID,
          browserbaseSessionCreateParams: {
            projectId: process.env.BROWSERBASE_PROJECT_ID,
            browserSettings: {
              context: { id: ctx.context_id, persist: true },
              blockAds: true,
              viewport: { width: 1280, height: 720 },
            },
          },
          modelName: 'gpt-4o-mini',
          modelClientOptions: {
            apiKey: process.env.OPENAI_API_KEY,
          },
          selfHeal: true,
          enableCaching: false,
          verbose: 1,
          domSettleTimeoutMs: 4000,
          logger: (l) => console.log(`[sh:${l.category}]`, l.message),
        });
        
        await stagehand.init();
        page = stagehand.page;
        console.log(`[Worker] ✅ Stagehand restarted successfully (attempt ${restartCount})`);
        return true;
      } catch (err) {
        console.error(`[Worker] ❌ Failed to restart Stagehand (attempt ${restartCount}):`, err.message);
        return false;
      }
    };
    
    /*************************  NEW MULTI-PAGE LOGIC  *************************/
    console.log(`[Worker] 🎯 Using simplified mass connect strategy with keyword variations for ${searchKeywords}`);

    const processed = new Set(); // avoid duplicate profile visits
    let sent = 0;

    // Initialize stateful cursor from campaign
    let variationIdx = campaign.next_variation || 0;
    let currentPage = campaign.next_page || 1;
    const maxPages = 15; // hard stop to avoid endless loops
    
    console.log(`[Worker] 🎯 Resuming at variation ${variationIdx}, page ${currentPage}`);
    
    while (sent < remainingToday && currentPage <= maxPages) {
      // Use stateful cursor for crash-safe rotation
      const searchUrl = await buildAdvancedSearchUrl(campaign.targeting_criteria || {}, searchKeywords, variationIdx, campaign.id);
      const pageUrl = currentPage === 1 ? searchUrl : `${searchUrl}${searchUrl.includes('?') ? '&' : '?'}page=${currentPage}`;
      
      console.log(`[Worker] 📍 Page ${currentPage} (variation ${variationIdx}): ${pageUrl}`);
      let loaded = false;
      try {
        await withRetry(() => page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }), 3, 2000);
        loaded = true;
      } catch (err) {
        console.warn(`[Worker] ⚠️ Failed to load search page ${currentPage} after retries:`, err.message);
      }
      if (!loaded) break; // exit main loop gracefully if page cannot load

      // wait for results to settle
      try {
        await page.waitForSelector('button:has-text("Connect")', { timeout: 10000 });
      } catch (_) {}

      // dismiss potential pop-ups
      try {
        await page.act('If a dialog or pop-up contains "Grow Your Network" or has an aria-label "Dismiss", click its close button');
        await page.waitForTimeout(300);
      } catch (_) {}

      // Health check before connecting
      try {
        await page.evaluate(() => document.title);
      } catch (healthError) {
        if (isBrowserCrashError(healthError)) {
          console.log('[Worker] 🔄 Browser health check failed, attempting restart...');
          const restarted = await restartStagehand();
          if (!restarted) break;
          continue; // Retry this page
        }
      }

      // 🚀 SAFE CONNECT - Check buttons before clicking to avoid withdrawals
      console.log(`[Worker] 🚀 Safe connecting on page ${currentPage} - targeting up to ${Math.min(remainingToday - sent, 10)} connections`);
      
      try {
        const connectionsThisPage = Math.min(remainingToday - sent, 10);
        let pageConnections = 0;
        
        for (let attempt = 0; attempt < connectionsThisPage && sent < remainingToday; attempt++) {
          const connected = await safeConnect(page, db, campaign);
          if (connected) {
            pageConnections++;
            sent++;
            console.log(`[Worker] ✅ Connection ${attempt + 1}/${connectionsThisPage} successful, total: ${sent}/${remainingToday}`);
            
            // Wait between connections
            await page.waitForTimeout(getRandomDelay(1500, 2500));
            
            // Scroll to reveal more results
            if (attempt < connectionsThisPage - 1) {
              try {
                await page.act('Scroll down to reveal more search results');
                await page.waitForTimeout(700);
              } catch (_) {}
            }
        } else {
            console.log(`[Worker] ⚠️ Connection ${attempt + 1} failed, trying next person`);
            // Scroll to find new people
            try {
              await page.act('Scroll down to reveal more search results');
              await page.waitForTimeout(500);
            } catch (_) {}
          }
        }
        
        console.log(`[Worker] ✅ Page ${currentPage} complete: ${pageConnections} connections made, total: ${sent}/${remainingToday}`);
      } catch (err) {
        console.warn(`[Worker] ⚠️ Page ${currentPage} failed:`, err.message);
        
        // Check if it's a browser crash (common error patterns)
        if (isBrowserCrashError(err)) {
          console.log('[Worker] 🔄 Detected browser crash, attempting restart...');
          const restarted = await restartStagehand();
          if (!restarted) {
            console.log('[Worker] ❌ Could not restart browser, ending job');
            break;
          }
          // After restart, skip to next page to avoid the problematic area
          console.log('[Worker] ⏭️ Skipping to next page after browser restart to avoid problematic content');
          currentPage++;
          continue;
        } else {
          // Other errors, just continue to next page
          console.log(`[Worker] ⏭️ Skipping to next page due to error: ${err.message}`);
        }
      }

      // --- Stateful cursor advancement: increment page, wrap variation when needed ---
      try {
        currentPage++; // Move to next page
        
        // If we've reached max pages, reset to page 1 and advance variation
        if (currentPage > maxPages) {
          currentPage = 1;
          variationIdx = (variationIdx + 1) % 20; // Wrap at 20 variations
          console.log(`[Worker] 🔄 Wrapped to variation ${variationIdx}, page ${currentPage}`);
        }
        
        // Persist cursor state to database
        await db.from('campaigns')
          .update({ 
            next_variation: variationIdx,
            next_page: currentPage
          })
          .eq('id', campaign.id);
          
        console.log(`[Worker] 💾 Cursor persisted: variation ${variationIdx}, page ${currentPage}`);
      } catch (err) {
        console.warn('[Worker] ⚠️ Failed to persist cursor state:', err.message);
      }

      if (sent < remainingToday) {
        console.log(`[Worker] ⏭️ Moving to next search page. Progress: ${sent}/${remainingToday}`);
        try {
          await page.waitForTimeout(getRandomDelay(1500, 3000)); // Much faster page transitions
        } catch (err) {
          if (isBrowserCrashError(err)) {
            console.log('[Worker] 🔄 Browser crash during page transition, attempting restart...');
            const restarted = await restartStagehand();
            if (!restarted) break;
          }
        }
      }
    }

    await safeClose(stagehand);
    console.log(`[Worker] 🧹 Session closed. Invites sent: ${sent}`);

    res.status(200).json({
      success: true,
      invitesSent: sent,
      campaignId: campaign_id,
    });

  } catch (error) {
    console.error(`[Worker] ❌ Job failed:`, error.message);
    try {
      await safeClose(stagehand);
    } catch (closeError) {
      console.error(`[Worker] Error closing Stagehand:`, closeError.message);
    }
    res.status(500).json({ 
      success: false, 
      error: error.message,
      campaignId: campaign_id
    });
  } finally {
    // Crash-safe cursor persistence - always save state even on failures
    try {
      if (typeof variationIdx !== 'undefined' && typeof currentPage !== 'undefined') {
        await db.from('campaigns')
          .update({ 
            next_variation: variationIdx,
            next_page: currentPage
          })
          .eq('id', campaign_id);
        console.log(`[Worker] 💾 Final cursor persistence: variation ${variationIdx}, page ${currentPage}`);
      }
    } catch (persistError) {
      console.error(`[Worker] ❌ Failed to persist cursor in finally block:`, persistError.message);
    }
  }
});

// --------------------------
// 🚀 Start the Express server
// --------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Worker] HTTP server listening on port ${PORT}`);
});

// +++++++++++++ HELPER FUNCTIONS +++++++++++++

// AI-Enhanced keyword generation to avoid repetitive search results
// 
// RECOMMENDED KEYWORD SETS FOR SENIOR WOMEN LEADERS:
// 
// C-suite & Board:
// chief executive officer CEO chief operating officer COO chief financial officer CFO chief marketing officer CMO chief people officer CPO president board director non-executive director
// 
// Functional heads:
// vice president vp svp evp head of head women leadership women lead women executive
// 
// Founder/Investor:
// founder cofounder owner managing partner general partner angel investor venture partner
// 
// Affinity tags:
// women in leadership women in business women exec women founders woman leader she her
// 
// OR logic example: (women OR woman) (director OR vp OR "vice president" OR executive) (head OR lead OR chief)
//
async function generateKeywordVariations(originalKeywords, variationIndex = 0, campaignId = null, useAI = false) {
  // First try AI generation if enabled and we have OpenAI setup
  if (useAI && process.env.OPENAI_API_KEY && variationIndex > 7) {
    try {
      const aiKeywords = await generateAIKeywords(originalKeywords, campaignId);
      if (aiKeywords) {
        console.log(`[Worker] 🤖 AI-generated keywords: "${originalKeywords}" → "${aiKeywords}"`);
        return aiKeywords;
      }
    } catch (error) {
      console.warn(`[Worker] ⚠️ AI keyword generation failed, falling back to variations:`, error.message);
    }
  }

  const baseTerms = originalKeywords.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  
  // Enhanced professional synonyms and related terms
  const synonymMappings = {
    'director': ['leader', 'head', 'chief', 'vp', 'vice president', 'principal', 'head of'],
    'manager': ['supervisor', 'lead', 'coordinator', 'senior', 'team lead', 'mgr'],
    'executive': ['officer', 'c-suite', 'leadership', 'senior executive', 'top management', 'exec'],
    'women': ['female', 'woman', 'she/her', 'ladies', 'womens'],
    'senior': ['experienced', 'veteran', 'seasoned', 'principal', 'lead', 'sr'],
    'engineer': ['developer', 'architect', 'technical', 'software', 'dev'],
    'marketing': ['brand', 'growth', 'digital marketing', 'marketing communications', 'marcom'],
    'sales': ['business development', 'account', 'revenue', 'client relations', 'bd'],
    'finance': ['financial', 'accounting', 'treasury', 'investment', 'fintech'],
    'operations': ['ops', 'operational', 'process', 'logistics', 'supply chain'],
    'technology': ['tech', 'digital', 'innovation', 'IT', 'software'],
    'healthcare': ['medical', 'clinical', 'health', 'pharmaceutical', 'biotech'],
    'consulting': ['advisory', 'strategy', 'consultant', 'professional services', 'advisor']
  };
  
  // Industry-specific keyword expansions
  const industryExpansions = {
    'startup': ['entrepreneur', 'founder', 'early stage', 'innovation', 'venture'],
    'enterprise': ['corporate', 'large company', 'fortune 500', 'established', 'multinational'],
    'finance': ['banking', 'investment', 'capital markets', 'fintech', 'wealth management'],
    'healthcare': ['biotech', 'pharma', 'medical device', 'health tech', 'clinical'],
    'education': ['academia', 'university', 'training', 'learning', 'educational'],
    'retail': ['ecommerce', 'consumer', 'brand', 'merchandising', 'commerce'],
    'manufacturing': ['industrial', 'supply chain', 'production', 'automotive', 'manufacturing']
  };
  
  // Enhanced variations with more sophisticated combinations
  const variations = [
    // Variation 0: Original keywords
    originalKeywords,
    
    // Variation 1: Use synonyms for key terms
    baseTerms.map(term => {
      const synonyms = synonymMappings[term];
      return synonyms ? synonyms[0] : term;
    }).join(' '),
    
    // Variation 2: Add industry context
    baseTerms.concat(['professional', 'experienced']).join(' '),
    
    // Variation 3: Different synonym combinations  
    baseTerms.map(term => {
      const synonyms = synonymMappings[term];
      return synonyms && synonyms.length > 1 ? synonyms[1] : term;
    }).join(' '),
    
    // Variation 4: Focus on leadership terms
    baseTerms.filter(term => ['director', 'manager', 'executive', 'senior', 'lead'].includes(term))
             .concat(['leadership', 'management']).join(' '),
             
    // Variation 5: Industry expansion
    (() => {
      let expanded = [...baseTerms];
      baseTerms.forEach(term => {
        const expansion = industryExpansions[term];
        if (expansion) expanded.push(expansion[0]);
      });
      return expanded.join(' ');
    })(),
    
    // Variation 6: Alternative professional terms
    baseTerms.map(term => {
      const synonyms = synonymMappings[term];
      return synonyms && synonyms.length > 2 ? synonyms[2] : term;
    }).join(' '),
    
    // Variation 7: Focus on experience level
    baseTerms.concat(['expert', 'specialist', 'professional']).join(' '),
    
    // Variation 8: C-Suite focus
    baseTerms.filter(term => ['women', 'female'].includes(term))
             .concat(['ceo', 'cto', 'cfo', 'cmo', 'c-suite']).join(' '),
             
    // Variation 9: VP level focus
    baseTerms.filter(term => ['women', 'female'].includes(term))
             .concat(['vp', 'vice president', 'senior vp', 'svp']).join(' '),
             
    // Variation 10: Functional roles
    baseTerms.filter(term => ['women', 'female'].includes(term))
             .concat(['head of', 'chief', 'president', 'partner']).join(' '),
             
    // Variation 11: Industry-specific leadership
    baseTerms.filter(term => ['women', 'female'].includes(term))
             .concat(['founder', 'entrepreneur', 'owner', 'principal']).join(' ')
  ];
  
  // Select variation based on index, cycling through available options
  const selectedVariation = variations[variationIndex % variations.length];
  console.log(`[Worker] 🔄 Keyword variation ${variationIndex}: "${originalKeywords}" → "${selectedVariation}"`);
  
  return selectedVariation;
}

// AI-powered keyword generation using OpenAI
async function generateAIKeywords(originalKeywords, campaignId) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // Get previously used AI keywords for this campaign to avoid repetition
  const { data: previousKeywords } = await db
    .from('campaign_executions')
    .select('worker_logs')
    .eq('campaign_id', campaignId)
    .not('worker_logs', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const usedKeywords = previousKeywords?.map(log => 
    log.worker_logs?.ai_keywords
  ).filter(Boolean) || [];

  const prompt = `Generate fresh LinkedIn search keywords for finding professional women executives.

Original keywords: "${originalKeywords}"
Previously used AI keywords: ${usedKeywords.join(', ')}

Requirements:
- MUST include gender indicators (women/female/she/her)
- Target executive/director/manager level roles  
- 20+ years experience indicators
- Professional leadership terms
- Avoid previously used combinations

Generate 1 keyword combination that's different from previous attempts but targets the same demographic.
Return only the keywords, no explanation.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.8 // Higher creativity
    });

    const aiKeywords = completion.choices[0]?.message?.content?.trim();
    
    // Store the AI keywords in the execution log for tracking
    if (aiKeywords) {
      console.log(`[Worker] 🤖 AI generated: "${aiKeywords}"`);
      return aiKeywords;
    }
    
    return null;
  } catch (error) {
    console.error('[Worker] ❌ OpenAI keyword generation failed:', error.message);
    throw error;
  }
}

// Build LinkedIn search URL with advanced filters
async function buildAdvancedSearchUrl(criteria = {}, keywords = '', variationIndex = 0, campaignId = null) {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const params = new URLSearchParams();

  // Generate keyword variation (with AI support after variation 11)
  const useAI = variationIndex > 11; // Use AI after exhausting all manual variations
  const variedKeywords = await generateKeywordVariations(keywords, variationIndex, campaignId, useAI);
  
  // Clean the varied keywords - remove all types of quotes and parentheses, simplify complex phrases
  let cleaned = variedKeywords
    .replace(/[()"'""''„‚‛‟]/g, '') // ✅ Fixed quote-stripping regex
    .replace(/\s+OR\s+/gi, ' ') // Convert OR operators to spaces for simpler search
    .replace(/[,]+/g, ' ') // Replace commas with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
  
  // If keywords are too complex, extract key terms
  if (cleaned.length > 50) {
    const keyTerms = cleaned.split(' ')
      .filter(word => word.length > 3) // Only meaningful words
      .filter(word => !['women', 'tech', 'finance', 'leadership', 'engineers', 'executives', 'healthcare'].includes(word.toLowerCase())) // Remove generic terms
      .slice(0, 3) // Max 3 key terms
      .join(' ');
    cleaned = keyTerms || 'founder'; // Fallback if no good terms found
  }
  
  console.log(`[Worker] 🔍 Varied keywords: "${variedKeywords}" → Cleaned: "${cleaned}"`);
  params.append('keywords', cleaned);

  /* ---------------- Location ---------------- */
  if (criteria.demographics?.location) {
    const locationMappings = {
      'united states': '["103644278"]',
      'canada': '["101174742"]',
      'united kingdom': '["101165590"]',
      'germany': '["101282230"]',
      'france': '["105015875"]',
      'australia': '["101452733"]',
      'india': '["102713980"]',
      'brazil': '["106057199"]',
      'japan': '["101355337"]',
      'china': '["102890883"]'
    };
    const locKey = criteria.demographics.location.toLowerCase();
    if (locationMappings[locKey]) params.append('geoUrn', locationMappings[locKey]);
  }

  /* ---------------- Industry ---------------- */
  let inds = criteria.professional?.industries;
  if (typeof inds === 'string') inds = nonEmpty(inds.split(',').map(s=>s.trim()));
  if (Array.isArray(inds) && inds.length) {
    const industryMappings = {
      'technology': '"4"',
      'financial services': '"43"',
      'healthcare': '"14"',
      'education': '"69"',
      'consulting': '"9"',
      'manufacturing': '"25"',
      'retail': '"27"',
      'media': '"3"',
      'real estate': '"44"',
      'automotive': '"53"'
    };
    const urns = inds.map(i=>industryMappings[i.toLowerCase()]).filter(Boolean);
    if (urns.length) params.append('industryUrn', `[${urns.join(',')}]`);
  }

  /* ---------------- Seniority ---------------- */
  let seniors = criteria.professional?.seniority_levels;
  if (typeof seniors === 'string') seniors = nonEmpty(seniors.split(',').map(s=>s.trim()));
  if (Array.isArray(seniors) && seniors.length) {
    const seniorityMappings = {
      'entry':'"1"','associate':'"2"','mid-senior':'"3"','director':'"4"','executive':'"5"','senior':'"6"','owner':'"7"','partner':'"8"','cxo':'"9"','unpaid':'"10"'
    };
    const urns = seniors.map(l=>seniorityMappings[l.toLowerCase()]).filter(Boolean);
    if (urns.length) params.append('seniorityLevel', `[${urns.join(',')}]`);
  }

  /* ---------------- Company size ---------------- */
  if (criteria.professional?.company_size) {
    const companySizeMappings = {
      'startup': '["A"]', // 1-10
      'small': '["B"]',   // 11-50
      'medium': '["C"]',  // 51-200
      'large': '["D"]',   // 201-500
      'enterprise': '["E","F","G","H","I"]' // 500+
    };
    const sizeKey = criteria.professional.company_size.toLowerCase();
    if (companySizeMappings[sizeKey]) params.append('companySize', companySizeMappings[sizeKey]);
  }

  return `${baseUrl}?${params.toString()}`;
}

// Calculate total experience years from profile experiences array
function calculateExperienceYears(experiences = []) {
  if (!experiences.length) return 0;
  let total = 0;
  const currentYear = new Date().getFullYear();

  experiences.forEach((exp) => {
    if (exp.duration) {
      const yr = Number(exp.duration.match(/(\d+)\s*yr/)?.[1] || 0);
      const mo = Number(exp.duration.match(/(\d+)\s*mo/)?.[1] || 0);
      total += yr + mo / 12;
    } else if (exp.startDate) {
      const startYear = Number(exp.startDate.match(/\d{4}/)?.[0]);
      const endYear = exp.endDate?.toLowerCase().includes('present')
        ? currentYear
        : Number(exp.endDate?.match(/\d{4}/)?.[0] || startYear);
      if (startYear) {
        total += Math.max(0, endYear - startYear);
      }
    }
  });

  return Math.round(total);
}

// Determine if a detailed profile passes the targeting criteria
function meetsTargetCriteria(profile = {}, criteria = {}) {
  if (!criteria) return true;
  const { demographics = {}, professional = {} } = criteria;

  // Demographic experience checks
  if (demographics.min_experience_years) {
    const yrs = calculateExperienceYears(profile.fullExperience);
    if (yrs < demographics.min_experience_years) return false;
  }
  if (demographics.max_experience_years) {
    const yrs = calculateExperienceYears(profile.fullExperience);
    if (yrs > demographics.max_experience_years) return false;
  }

  // Gender keywords
  if (demographics.gender_keywords?.length) {
    const text = `${profile.pronouns || ''} ${profile.about || ''}`.toLowerCase();
    const hasGenderKw = demographics.gender_keywords.some((kw) => text.includes(kw.toLowerCase()));
    const nameLooksFemale = isLikelyFemale(profile.firstName || (profile.name?.split(' ')[0] || ''));
    if (!hasGenderKw && !nameLooksFemale) return false;
  }

  // Professional keyword inclusion/exclusion
  const profileText = `${profile.about || ''} ${JSON.stringify(profile.fullExperience || [])}`.toLowerCase();
  if (professional.required_keywords?.length) {
    const hasAll = professional.required_keywords.every((kw) => profileText.includes(kw.toLowerCase()));
    if (!hasAll) return false;
  }
  if (professional.excluded_keywords?.length) {
    const hasExcluded = professional.excluded_keywords.some((kw) => profileText.includes(kw.toLowerCase()));
    if (hasExcluded) return false;
  }

  // Current job checks
  const currentJob = profile.fullExperience?.[0];
  if (professional.current_job_titles?.length) {
    if (!currentJob?.title) return false;
    const titleMatch = professional.current_job_titles.some((t) => currentJob.title.toLowerCase().includes(t.toLowerCase()));
    if (!titleMatch) return false;
  }
  if (professional.target_companies?.length) {
    if (!currentJob?.company) return false;
    const companyMatch = professional.target_companies.some((c) => currentJob.company.toLowerCase().includes(c.toLowerCase()));
    if (!companyMatch) return false;
  }

  // ===== SENIORITY LEVEL CHECK (only if explicitly specified) =====
  const seniorityArr = professional.seniority_levels?.length ? professional.seniority_levels : DEFAULT_SENIORITY;
  if (seniorityArr.length && profile.fullExperience?.[0]?.title) {
    const titleText = profile.fullExperience[0].title.toLowerCase();
    const matchesSeniority = seniorityArr.some(level => titleText.includes(level.toLowerCase()));
    if (!matchesSeniority) return false;
  }

  return true;
}

// ----------------- Utility helpers -----------------
function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to detect browser crash errors
function isBrowserCrashError(error) {
  const errorMessage = error?.message || '';
  const crashPatterns = [
    'Target page',
    'browser has been closed',
    'page.evaluate',
    'cdpSession.send',
    'Protocol error',
    'Session closed',
    'Cannot find context',
    'Page crashed',
    'Connection closed',
    'Target closed'
  ];
  
  return crashPatterns.some(pattern => errorMessage.includes(pattern));
}

async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[Worker] Attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function genMessage(firstName, campaign) {
  let msg = campaign.template || '';
  if (msg.toLowerCase().startsWith('ai:')) {
    const prompt = msg.slice(3).trim().replace('{name}', firstName);
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert LinkedIn networker who writes concise, friendly connection requests.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 60,
      });
      msg = completion.choices[0]?.message?.content?.trim() || msg;
    } catch (err) {
      console.warn('[Worker] OpenAI generation failed, falling back to template:', err.message);
    }
  }
  return msg.replace('{name}', firstName);
}

async function sendConnectionRequest(page, target, campaign) {
  try {
    // Only navigate if not already on the profile page
    const currentUrl = page.url();
    if (!currentUrl.includes(target.profileUrl)) {
      await page.goto(target.profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); // Faster timeout, no retry
    }

    await page.waitForTimeout(getRandomDelay(800, 1500)); // Faster settle time

    // Use optimized observe-then-act pattern
    const connectAction = await page.observe('Find the Connect button on this profile');
    if (!connectAction?.length) {
      // Try More actions fallback
      const moreAction = await page.observe('Find More actions button');
      if (moreAction?.length) {
        await page.act(moreAction);
        await page.waitForTimeout(300);
        const dropdownConnect = await page.observe('Find Connect in dropdown');
        if (dropdownConnect?.length) {
          await page.act(dropdownConnect);
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      await page.act(connectAction);
    }
    await page.waitForTimeout(500);

    // ----------- Attach personalized note when required -----------
    let personalizedNote = null;
    if (campaign.cta_mode === 'connect_with_note' && campaign.template) {
      const firstName = target.name.split(' ')[0];
      personalizedNote = await genMessage(firstName, campaign);

      // Try to click "Add a note" if present, else fallback to directly typing in textarea
      let noteArea = await page.observe('Locate the textarea to add a note to the invitation');
      if (!noteArea?.length) {
    const addNoteBtn = await page.observe('Look for Add a note option');
        if (addNoteBtn?.length) {
      await page.act('Click Add a note');
          await page.waitForTimeout(400);
          noteArea = await page.observe('Locate the textarea to add a note to the invitation');
        }
      }

      if (noteArea?.length) {
        await page.act(`Type the message: "${personalizedNote}"`);
        await page.waitForTimeout(400);
      } else {
        console.warn('[Worker] ⚠️ Could not locate note textarea; proceeding without note');
        personalizedNote = null;
      }
    }

    // Try multiple send strategies to handle LinkedIn's changing button text
    const sendStrategies = [
      'Click the "Send invitation" button',
      'Click the "Send" button',
      'Click the "Send without a note" button',
      'Click button[aria-label*="Send without note"]',
      'Click the blue "Send" button',
      'Click any button that will complete the connection request'
    ];
    
    let sendSuccessful = false;
    for (const strategy of sendStrategies) {
      try {
        await page.act(strategy);
        console.log(`[Worker] ✅ Successfully sent invitation using: ${strategy}`);
        sendSuccessful = true;
        break;
      } catch (strategyErr) {
        console.log(`[Worker] ⏭️ Strategy failed: ${strategy}`);
      }
    }
    
    if (!sendSuccessful) {
      console.error(`[Worker] ❌ All send strategies failed`);
      return false;
    }

    // Persist invite
    const prospectLinkedInId = target.profileUrl.split('/in/')[1]?.split(/[/?]/)[0] ?? null;

    // ensure prospect row exists
    let prospectId;
    const { data: existingProspect } = await db
      .from('prospects')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('profile_url', target.profileUrl)
      .maybeSingle();

    if (existingProspect) {
      prospectId = existingProspect.id;
    } else {
      const { data: newP } = await db
        .from('prospects')
        .insert({
          id: crypto.randomUUID(),
          campaign_id: campaign.id,
          profile_url: target.profileUrl,
          first_name: target.name.split(' ')[0],
          status: 'contacted',
        })
        .select()
        .single();
      prospectId = newP.id;
    }

    await db.from('invites').insert({
      id: crypto.randomUUID(),
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      prospect_id: prospectId,
      prospect_linkedin_id: prospectLinkedInId,
      note: personalizedNote ?? null,
      sent_at: new Date().toISOString(),
    });

    // Update campaign daily count
    await updateCampaignDailyCount(db, campaign.id);

    // For "connect_then_followup" campaigns, track the connection for future follow-up processing
    if (campaign.cta_mode === 'connect_then_followup') {
      await trackConnectionForFollowUp(campaign, {
        name: target.name,
        profileUrl: target.profileUrl,
        profile_url: target.profileUrl
      });
    }

    return true;
  } catch (err) {
    console.warn(`[Worker] Could not connect with ${target.name}:`, err.message);
    return false;
  }
}

function nonEmpty(arr){return arr.filter(v=>v && v.toLowerCase()!=='any');}

// Utility to close stagehand safely once
async function safeClose(sh) {
  try {
    if (sh && typeof sh.isClosed === 'function' && !sh.isClosed()) {
      await sh.close();
    }
  } catch (_) {}
}

// Scroll until at least n connect buttons are visible or max attempts reached
async function ensureResults(page, n = 30, maxLoops = 15) {
  let lastConnectCount = 0;
  let noProgressCount = 0;
  
  for (let i = 0; i < Math.min(maxLoops, 8); i++) { // Reduced max loops
    // Count both cards and connect buttons for better detection
    const [cardCount, connectCount] = await page.evaluate(() => {
      const cards = document.querySelectorAll('li[class*="result-container"], .search-result');
      const connects = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.textContent.includes('Connect') || btn.getAttribute('aria-label')?.includes('Connect')
      );
      return [cards.length, connects.length];
    });
    
    if (cardCount >= n || connectCount >= Math.min(n/2, 15)) return;
    
    // Smart scrolling - larger jumps if we have few results
    await page.evaluate((cardCount) => {
      const scrollAmount = cardCount < 5 ? window.innerHeight * 1.5 : window.innerHeight * 0.8;
      window.scrollBy(0, scrollAmount);
    }, cardCount);
    await page.waitForTimeout(300); // Faster than random delay
    
    // Exit early if no progress for 2 iterations  
    if (connectCount === lastConnectCount) {
      noProgressCount++;
      if (noProgressCount >= 2) break;
    } else {
      noProgressCount = 0;
    }
    lastConnectCount = connectCount;
  }
}

// Debug logger – only prints when LOG_LEVEL=debug
const debugLog = (...args) => {
  if (process.env.LOG_LEVEL === 'debug') console.log(...args);
};

// Shared seniority keywords list - removed hard-coded filter to boost connect volume
const DEFAULT_SENIORITY = [];

// First-name gender heuristic
export const isLikelyFemale = (name, thresh = 0.9) => {
  try {
    return detector.detect(name) === 'female';
  } catch {
    return false;
  }
};

function meetsSnippetCriteria(snippet = '', criteria = {}, firstName = '') {
  if (!snippet) return true; // Allow profiles without snippets for broad searches like YC
  const text = snippet.toLowerCase();
  const prof = criteria?.professional || {};
  const demo = criteria?.demographics || {};

  debugLog(`[Worker] 🔍 Checking snippet: "${snippet.substring(0, 100)}..."`);

  // ======= EXCLUDED KEYWORDS – IMMEDIATE REJECT =======
  if (prof.excluded_keywords?.length) {
    const arr = Array.isArray(prof.excluded_keywords)
      ? prof.excluded_keywords
      : prof.excluded_keywords.split(',').map((s) => s.trim());
    
    // Enhanced student/intern detection patterns
    const studentPatterns = [
      'student', 'intern', 'trainee', 'entry level', 'recent graduate', 
      'graduate student', 'undergraduate', 'phd candidate', 'mba student',
      'college', 'university', 'seeking opportunities', 'new grad',
      'fresh graduate', 'looking for', 'entry-level', 'junior level'
    ];
    
    // Check both explicit excluded keywords and student patterns
    const hasExcluded = arr.some((kw) => kw && text.includes(kw.toLowerCase())) ||
                       studentPatterns.some(pattern => text.includes(pattern));
    
    if (hasExcluded) {
      debugLog(`[Worker] ❌ EXCLUDED: Found excluded keyword or student pattern in "${snippet.substring(0, 50)}..."`);
      return false;
    }
  }

  // ======= EXPERIENCE LEVEL CHECKS =======
  if (demo.min_experience_years) {
    // Look for experience indicators that suggest senior level
    const seniorIndicators = [
      'director', 'vp', 'vice president', 'chief', 'head of', 'senior',
      'lead', 'principal', 'founder', 'ceo', 'cto', 'cfo', 'president',
      'executive', 'manager', '20+ years', '15+ years', 'veteran', 'expert'
    ];
    
    // Look for junior indicators that suggest less experience
    const juniorIndicators = [
      'junior', 'entry', 'associate level', 'recent', 'new to', 'starting',
      'beginning', 'first job', 'early career', 'graduate program'
    ];
    
    const hasSeniorIndicators = seniorIndicators.some(indicator => text.includes(indicator));
    const hasJuniorIndicators = juniorIndicators.some(indicator => text.includes(indicator));
    
    // If minimum experience is high (15+ years) and we see junior indicators, exclude
    if (demo.min_experience_years >= 15 && hasJuniorIndicators && !hasSeniorIndicators) {
      debugLog(`[Worker] ❌ EXCLUDED: Junior-level indicators found for high experience requirement`);
      return false;
    }
    
    // If minimum experience is high but no senior indicators, be more cautious
    if (demo.min_experience_years >= 20 && !hasSeniorIndicators) {
      debugLog(`[Worker] ⚠️ WARNING: High experience requirement but no senior indicators found`);
      // Still allow, but log the concern
    }
  }

  // ======= GENDER KEYWORD / NAME HEURISTIC CHECKS =======
  if (demo.gender_keywords?.length) {
    const genderArr = Array.isArray(demo.gender_keywords)
      ? demo.gender_keywords
      : demo.gender_keywords.split(',').map((s) => s.trim());
    const genderPatterns = genderArr.map(kw => kw.toLowerCase());
    const hasGenderKw = genderPatterns.some((kw) => text.includes(kw));
    
    // Updated logic: Only exclude if name is clearly male AND no gender keywords found
    let firstNameGender;
    try {
      firstNameGender = detector.detect(firstName);
    } catch (error) {
      firstNameGender = 'unknown'; // Default to unknown if detection fails
    }
    const isNotMale = firstNameGender !== 'male'; // Allow 'female' and 'unknown'
    
    if (!hasGenderKw && !isNotMale) {
      debugLog('[Worker] ❌ EXCLUDED: gender test failed (no keyword & name is male)');
      return false;
    }
    
    // Log the gender detection for debugging
    debugLog(`[Worker] 🔍 Gender check: hasKeyword=${hasGenderKw}, name="${firstName}", detected="${firstNameGender}"`);
  }

  // ======= REQUIRED KEYWORDS =======
  if (prof.required_keywords?.length) {
    const arr = Array.isArray(prof.required_keywords)
      ? prof.required_keywords
      : prof.required_keywords.split(',').map((s) => s.trim());
    
    // Must match at least one required keyword
    const hasRequired = arr.some((kw) => kw && text.includes(kw.toLowerCase()));
    if (!hasRequired) {
      debugLog(`[Worker] ❌ EXCLUDED: Required keywords not found: ${arr.join(', ')}`);
      return false;
    }
  }

  // ======= SENIORITY LEVEL CHECKS =======
  const seniorityArr = (prof.seniority_levels?.length
    ? (Array.isArray(prof.seniority_levels) ? prof.seniority_levels : prof.seniority_levels.split(',').map((s) => s.trim()))
    : DEFAULT_SENIORITY);
  
  // Only check seniority if explicitly specified - no default filtering
  if (seniorityArr.length > 0) {
    const seniorityMappings = {
      'director': ['director', 'head of', 'vp', 'vice president'],
      'executive': ['ceo', 'cto', 'cfo', 'chief', 'executive', 'president', 'founder'],
      'senior': ['senior', 'lead', 'principal', 'staff', 'sr.'],
      'manager': ['manager', 'mgr', 'team lead'],
      'mid-senior': ['senior', 'lead', 'principal', 'manager', 'specialist']
    };
    
    const matchesSeniority = seniorityArr.some(level => {
      const patterns = seniorityMappings[level.toLowerCase()] || [level.toLowerCase()];
      return patterns.some(pattern => text.includes(pattern));
    });
    
    if (!matchesSeniority) {
      debugLog(`[Worker] ❌ EXCLUDED: Seniority level not matched: ${seniorityArr.join(', ')}`);
      return false;
    }
  }

  // ======= SPECIAL HANDLING FOR STARTUP/YC SEARCHES =======
  if (text.includes('yc') || text.includes('y combinator') || text.includes('combinator')) {
    debugLog(`[Worker] ✅ INCLUDED: YC-related profile (special handling)`);
    return true;
  }

  // Include startup-related keywords for YC campaigns  
  const startupTerms = ['founder', 'startup', 'entrepreneur', 'ceo', 'cto', 'co-founder'];
  if (startupTerms.some(term => text.includes(term))) {
    debugLog(`[Worker] ✅ INCLUDED: Startup-related profile`);
    return true;
  }

  // ======= JOB TITLE CHECKS =======
  if (prof.current_job_titles?.length) {
    const titles = Array.isArray(prof.current_job_titles) 
      ? prof.current_job_titles 
      : prof.current_job_titles.split(',').map(s => s.trim());
    
    const titleMatch = titles.some(title => text.includes(title.toLowerCase()));
    if (!titleMatch) {
      debugLog(`[Worker] ❌ EXCLUDED: Job title not matched: ${titles.join(', ')}`);
      return false;
    }
  }

  debugLog(`[Worker] ✅ INCLUDED: Profile meets all targeting criteria`);
  return true; // Default to inclusive - connect first, qualify in follow-up
}

async function logDirectInvite(db, campaign, person) {
  const prospectLinkedInId = person.profileUrl.split('/in/')[1]?.split(/[/?]/)[0] ?? null;
  let prospectId;

  // Ensure prospect exists (or create)
  const { data: existingProspect } = await db
    .from('prospects')
    .select('id')
    .eq('campaign_id', campaign.id)
    .eq('profile_url', person.profileUrl)
    .maybeSingle();

  if (existingProspect) {
    prospectId = existingProspect.id;
  } else {
    const { data: newP } = await db
      .from('prospects')
      .insert({
        id: crypto.randomUUID(),
        campaign_id: campaign.id,
        profile_url: person.profileUrl,
        first_name: person.name.split(' ')[0],
        status: 'contacted',
      })
      .select()
      .single();
    prospectId = newP.id;
  }

  await db.from('invites').insert({
    id: crypto.randomUUID(),
    campaign_id: campaign.id,
    user_id: campaign.user_id,
    prospect_id: prospectId,
    prospect_linkedin_id: prospectLinkedInId,
    note: null,
    sent_at: new Date().toISOString(),
  });

  // 🔧 UPDATE: Increment the daily_sent count in campaigns table
  await updateCampaignDailyCount(db, campaign.id);
}

// Helper function to increment campaign daily_sent count
async function updateCampaignDailyCount(db, campaignId) {
  try {
    const { data, error } = await db
      .from('campaigns')
      .select('daily_sent')
      .eq('id', campaignId)
      .single();
    
    if (error) {
      console.error('[Worker] ❌ Failed to get current daily count:', error.message);
      return;
    }
    
    const newCount = (data.daily_sent || 0) + 1;
    
    const { error: updateError } = await db
      .from('campaigns')
      .update({ 
        daily_sent: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);
    
    if (updateError) {
      console.error('[Worker] ❌ Failed to update campaign daily count:', updateError.message);
    } else {
      console.log(`[Worker] ✅ Updated campaign daily_sent count to ${newCount}`);
    }
  } catch (err) {
    console.error('[Worker] ❌ Error updating campaign daily count:', err.message);
  }
}

async function quickConnect(page, person) {
  try {
    console.log(`[Worker] 🔗 Attempting quick connect with ${person.name}`);
    
    // Simplified approach: direct string commands instead of observe-then-act
    await page.act(`Click the blue "Connect" button for ${person.name} (not Withdraw, not Message)`);
    await page.waitForTimeout(1000); // Wait for modal
    
    // Try multiple variations of send button
    try {
      await page.act('Click "Send invitation" button');
    } catch {
      try {
        await page.act('Click "Send" button');  
      } catch {
        await page.act('Click the blue "Send" button in the connection modal');
      }
    }
    
    console.log(`[Worker] ✅ Connected with ${person.name}`);
    return true;
  } catch (err) {
    console.warn(`[Worker] ❌ quickConnect failed for ${person.name}:`, err.message);
    return false;
  }
}

async function massConnect(page, db, campaign, limit) {
  try {
    let sent = 0;
    console.log(`[Worker] 🚀 Mass connect: targeting ${limit} connections`);
    
    for (let i = 0; i < limit; i++) {
      try {
        // Simple: click any visible Connect button - be specific to avoid withdrawals
        await page.act('Click a blue "Connect" button (not "Withdraw", not "Message", only "Connect") in the search results');
        await page.waitForTimeout(800);
        
        // Send invitation
        try {
          await page.act('Click "Send invitation" button');
        } catch {
          await page.act('Click "Send" button');
        }
        
        // Log the invite (without detailed profile info)
        const prospectId = crypto.randomUUID();
        await db.from('prospects').insert({
          id: prospectId,
          campaign_id: campaign.id,
          profile_url: null, // Unknown since we didn't extract
          first_name: null,
          status: 'contacted',
        });
        
        await db.from('invites').insert({
          id: crypto.randomUUID(),
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          prospect_id: prospectId,
          prospect_linkedin_id: null,
          note: null,
          sent_at: new Date().toISOString(),
        });
        
        // Update campaign daily count
        await updateCampaignDailyCount(db, campaign.id);
        
        sent++;
        console.log(`[Worker] ✅ Mass connect ${sent}/${limit}`);
        await page.waitForTimeout(getRandomDelay(1000, 2000));
        
        // Scroll to reveal more results if needed
        if (i < limit - 1) {
          await page.act('Scroll down to reveal more search results');
      await page.waitForTimeout(500);
        }
      } catch (err) {
        console.warn(`[Worker] ⚠️ Mass connect ${i+1} failed:`, err.message);
        // Try to scroll and continue
        try {
          await page.act('Scroll down to reveal more search results');
      await page.waitForTimeout(500);
        } catch (_) {}
      }
    }
    
    return sent;
  } catch (err) {
    console.error('[Worker] ❌ Mass connect failed:', err.message);
    return 0;
  }
}

async function simplePageConnect(page, db, campaign, limit) {
  let sent = 0;
  console.log(`[Worker] 🚀 Simple connect: targeting ${limit} connections`);
  
  for (let i = 0; i < limit; i++) {
    let connectionAttempted = false;
    let connectionSuccessful = false;
    
    try {
      // Step 1: Try to click a Connect button - be very specific to avoid Withdraw buttons
      await page.act('Click a blue "Connect" button (not "Withdraw", not "Pending", only "Connect") in the search results');
      await page.waitForTimeout(1200); // Wait for modal
      connectionAttempted = true;
      
      // Step 2: Try to send the invitation  
      try {
        await page.act('Click "Send invitation" button');
        connectionSuccessful = true;
      } catch {
        try {
          await page.act('Click "Send" button');
          connectionSuccessful = true;
        } catch {
          try {
            await page.act('Click the blue "Send" button in the connection modal');
            connectionSuccessful = true;
          } catch {
            console.warn(`[Worker] ⚠️ Could not find Send button for connection ${i+1}`);
          }
        }
      }
      
      // Step 3: Log to database if connection was successful
      if (connectionSuccessful) {
        try {
          const prospectId = crypto.randomUUID();
          
          // Insert prospect
          await db.from('prospects').insert({
            id: prospectId,
            campaign_id: campaign.id,
            profile_url: null,
            first_name: null,
            status: 'contacted',
          });
          
          // Insert invite
          await db.from('invites').insert({
            id: crypto.randomUUID(),
            campaign_id: campaign.id,
            user_id: campaign.user_id,
            prospect_id: prospectId,
            prospect_linkedin_id: null,
            note: null,
            sent_at: new Date().toISOString(),
          });
          
          // Update campaign daily count
          await updateCampaignDailyCount(db, campaign.id);
          
          sent++;
          console.log(`[Worker] ✅ Simple connect ${sent}/${limit} - successfully logged to database`);
        } catch (dbErr) {
          console.error(`[Worker] ❌ Database error for connection ${i+1}:`, dbErr.message);
          // Still count as sent since the LinkedIn action succeeded
          sent++;
          console.log(`[Worker] ✅ Simple connect ${sent}/${limit} - LinkedIn success, DB failed`);
        }
      }
      
      // Wait between attempts
      await page.waitForTimeout(getRandomDelay(1500, 2500));
      
      // Scroll to reveal more results if needed
      if (i < limit - 1) {
        try {
          await page.act('Scroll down to reveal more search results');
          await page.waitForTimeout(700);
        } catch (scrollErr) {
          console.warn(`[Worker] ⚠️ Scroll failed: ${scrollErr.message}`);
        }
      }
      
    } catch (err) {
      console.warn(`[Worker] ⚠️ Simple connect ${i+1} failed:`, err.message);
      
      // If it's a browser crash, re-throw to trigger restart
      if (err.message.includes('Target page') || err.message.includes('browser has been closed') || err.message.includes('page.evaluate')) {
        throw err; // Let the calling function handle browser restart
      }
      
      // For other errors, try to recover by scrolling
      try {
        await page.act('Scroll down to reveal more search results');
        await page.waitForTimeout(1000);
      } catch (_) {
        console.warn(`[Worker] ⚠️ Recovery scroll also failed, continuing...`);
      }
    }
  }
  
  console.log(`[Worker] 📊 Simple connect complete: ${sent}/${limit} connections made`);
  return sent;
}

async function safeConnect(page, db, campaign) {
  try {
    console.log(`[Worker] 🔍 Identifying and targeting profiles with precision...`);
    
    // Step 1: Get all profile candidates with specific data extraction
    const profileCandidates = await page.evaluate(() => {
      // Find all search result items
      const resultItems = Array.from(document.querySelectorAll('li[class*="search-result"], li[data-chameleon-result-urn], .reusable-search__result-container'));
      
      return resultItems.slice(0, 10).map((item, index) => {
        // Extract name from various possible selectors
        const nameSelectors = [
          '.entity-result__title-text a span[aria-hidden="true"]',
          '.actor-name-with-distance span[aria-hidden="true"]',
          '.search-result__info .linked-area .app-aware-link .actor-name',
          'a[data-control-name*="actor"] span[aria-hidden="true"]',
          '.result-lockup__name a span'
        ];
        
        let name = null;
        let profileUrl = null;
        
        for (const selector of nameSelectors) {
          const nameElement = item.querySelector(selector);
          if (nameElement && nameElement.textContent?.trim()) {
            name = nameElement.textContent.trim();
            
            // Get profile URL from the same link
            const linkElement = nameElement.closest('a') || item.querySelector('a[href*="/in/"]');
            if (linkElement) {
              profileUrl = linkElement.href;
            }
            break;
          }
        }
        
        // Extract snippet/subtitle text
        const snippetSelectors = [
          '.entity-result__primary-subtitle',
          '.entity-result__secondary-subtitle',
          '.subline-level-1',
          '.result-lockup__subtitle'
        ];
        
        let snippet = '';
        for (const selector of snippetSelectors) {
          const snippetElement = item.querySelector(selector);
          if (snippetElement) {
            snippet += snippetElement.textContent?.trim() + ' ';
          }
        }
        
        // Check for Connect button specifically in this item
        const connectButton = item.querySelector('button[aria-label*="Connect"], button:contains("Connect")') || 
                             Array.from(item.querySelectorAll('button')).find(btn => btn.textContent?.includes('Connect'));
        
        return {
          index: index + 1,
          name: name,
          snippet: snippet.trim(),
          profileUrl: profileUrl,
          hasConnectButton: !!connectButton,
          domIndex: index // For precise targeting
        };
      }).filter(profile => profile.name && profile.hasConnectButton);
    });
    
    if (!profileCandidates.length) {
      console.log(`[Worker] ⚠️ No profiles with Connect buttons found`);
      return false;
    }
    
    console.log(`[Worker] 🔍 Found ${profileCandidates.length} profiles with Connect buttons`);
    
    // Step 2: Apply targeting criteria to select the best candidate
    let selectedProfile = null;
    
    for (const candidate of profileCandidates) {
      console.log(`[Worker] 🔍 Evaluating: ${candidate.name} - ${candidate.snippet.substring(0, 100)}...`);
      
      const firstName = candidate.name.split(' ')[0] || '';
      
      // Fast gender filter for female-targeted campaigns
      if (campaign.targeting_criteria?.demographics?.gender_keywords?.length && 
          detector.detect(firstName) === 'male') {
        console.log(`[Worker] ⚡ Fast skip: ${firstName} detected as male`);
        continue;
      }
      
      // Apply targeting criteria
      const meetsTargeting = meetsSnippetCriteria(candidate.snippet, campaign.targeting_criteria, firstName);
      
      if (meetsTargeting) {
        selectedProfile = candidate;
        console.log(`[Worker] ✅ Selected: ${candidate.name} (meets targeting criteria)`);
        break;
      } else {
        console.log(`[Worker] ❌ Skipped: ${candidate.name} (doesn't meet criteria)`);
      }
    }
    
    if (!selectedProfile) {
      console.log(`[Worker] ⚠️ No profiles meet targeting criteria`);
      return false;
    }
    
    // Step 3: ATOMIC ACTION - Target specific person by name
    const targetName = selectedProfile.name;
    console.log(`[Worker] 🎯 Attempting atomic connection with "${targetName}"`);
    
    try {
      // NEW ATOMIC PROMPT - Eliminates index confusion
      await page.act(
        `Find the person named "${targetName}" in the search results list. Then click the "Connect" button that is in the same list item/card as their name. Do not click "Follow", "Message", or "Withdraw" buttons.`
      );
      
      console.log(`[Worker] ✅ Clicked Connect button for ${targetName}`);
    } catch (err) {
      console.warn(`[Worker] ❌ Stagehand could not find or click Connect button for ${targetName}:`, err.message);
      return false;
    }
    
    // Step 4: OUTCOME VALIDATION - Verify the action had intended effect
    await page.waitForTimeout(3000); // Give UI time to respond
    
    // Check if modal appeared (expected outcome for connection request)
    const modalCheck = await page.evaluate(() => {
      // Look for common LinkedIn connection modal selectors
      const modalSelectors = [
        'div[aria-labelledby*="send-invite"]',
        'div[data-test-modal]',
        '.send-invite',
        '.artdeco-modal[aria-labelledby]',
        '[role="dialog"]'
      ];
      
      for (const selector of modalSelectors) {
        if (document.querySelector(selector)) {
          return { modalFound: true, type: 'connection_modal' };
        }
      }
      
      return { modalFound: false };
    });
    
    if (modalCheck.modalFound) {
      console.log(`[Worker] ✅ Modal appeared as expected for ${targetName}. Proceeding to send invite.`);
      
      // Handle the connection modal
      try {
        // Handle "How do you know" modals
        try {
          await page.act('If there is a modal asking "How do you know" this person, click "Other" or the most general option available');
          await page.waitForTimeout(2000);
          console.log(`[Worker] ✅ Handled "How do you know" modal`);
        } catch (knowModalErr) {
          console.log(`[Worker] ℹ️ No "How do you know" modal found`);
        }
        
        // Handle personalized notes if required
        if (campaign.cta_mode === 'connect_with_note' && campaign.template) {
          try {
            const firstName = selectedProfile.name.split(' ')[0] || 'there';
            const personalizedNote = await genMessage(firstName, campaign);
            
            await page.act(`Type this message in the note field: "${personalizedNote}"`);
            console.log(`[Worker] ✅ Added personalized note`);
            await page.waitForTimeout(2000);
          } catch (noteErr) {
            console.log(`[Worker] ℹ️ Could not add note: ${noteErr.message}`);
          }
        }
        
        // Send the invitation
        let sendSuccessful = false;
        const sendStrategies = [
          'Click the "Send invitation" button',
          'Click the "Send" button',
          'Click the "Send without a note" button',
          'Click any blue button that will send the connection request'
        ];
        
        for (const strategy of sendStrategies) {
          try {
            await page.act(strategy);
            console.log(`[Worker] ✅ Successfully sent invitation using: ${strategy}`);
            sendSuccessful = true;
            break;
          } catch (strategyErr) {
            console.log(`[Worker] ⏭️ Strategy failed: ${strategy}`);
          }
        }
        
        if (!sendSuccessful) {
          console.error(`[Worker] ❌ All send strategies failed for ${targetName}`);
          return false;
        }
        
      } catch (modalErr) {
        console.warn(`[Worker] ⚠️ Modal handling failed for ${targetName}:`, modalErr.message);
        return false;
      }
      
    } else {
      // No modal appeared - check if connection was sent directly or if wrong button was clicked
      console.log(`[Worker] ⚠️ No modal appeared after clicking Connect for ${targetName}`);
      
      // Check if the button status changed to "Pending" (immediate connection)
      const statusCheck = await page.evaluate((name) => {
        // Look for the person's name and check button status in their card
        const searchResults = Array.from(document.querySelectorAll('li[class*="search-result"], li[data-chameleon-result-urn]'));
        
        for (const item of searchResults) {
          const nameElement = item.querySelector('span[aria-hidden="true"]');
          if (nameElement && nameElement.textContent?.includes(name)) {
            // Check button status in this specific card
            const pendingButton = item.querySelector('button[aria-label*="Pending"], button:contains("Pending")') ||
                                 Array.from(item.querySelectorAll('button')).find(btn => btn.textContent?.includes('Pending'));
            
            const followingButton = item.querySelector('button[aria-label*="Following"], button:contains("Following")') ||
                                   Array.from(item.querySelectorAll('button')).find(btn => btn.textContent?.includes('Following'));
            
            return {
              isPending: !!pendingButton,
              isFollowing: !!followingButton,
              found: true
            };
          }
        }
        
        return { found: false };
      }, targetName);
      
      if (statusCheck.found && statusCheck.isPending) {
        console.log(`[Worker] ✅ Connection sent directly for ${targetName}. Button shows "Pending".`);
      } else if (statusCheck.found && statusCheck.isFollowing) {
        console.warn(`[Worker] ⚠️ WRONG ACTION: Clicked "Follow" instead of "Connect" for ${targetName}. This is a targeting error.`);
        return false; // Don't count this as a successful connection
      } else {
        console.warn(`[Worker] ⚠️ UNEXPECTED STATE: Clicked Connect for ${targetName}, but cannot verify outcome.`);
        // Continue anyway - LinkedIn UI can be inconsistent
      }
    }
    
    // Step 5: Log successful connection to database
    const prospectId = crypto.randomUUID();
    const firstName = selectedProfile.name.split(' ')[0] || null;
    
    await db.from('prospects').insert({
      id: prospectId,
      campaign_id: campaign.id,
      profile_url: selectedProfile.profileUrl || null,
      first_name: firstName,
      status: 'contacted',
    });
    
    await db.from('invites').insert({
      id: crypto.randomUUID(),
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      prospect_id: prospectId,
      prospect_linkedin_id: selectedProfile.profileUrl ? selectedProfile.profileUrl.split('/in/')[1]?.split('/')[0] : null,
      note: campaign.cta_mode === 'connect_with_note' ? 'Added via Stagehand' : null,
      sent_at: new Date().toISOString(),
    });
    
    // Update campaign daily count
    await updateCampaignDailyCount(db, campaign.id);
    
    // Track connection for follow-up campaigns
    await trackConnectionForFollowUp(campaign, {
      name: selectedProfile.name,
      profileUrl: selectedProfile.profileUrl || null,
      firstName: firstName
    });
    
    console.log(`[Worker] ✅ Successfully connected with ${selectedProfile.name} and logged to database`);
    return true;
    
  } catch (err) {
    console.error(`[Worker] ❌ safeConnect failed:`, err.message);
    
    // Enhanced error logging for debugging
    if (err.message.includes('Target page') || err.message.includes('browser has been closed')) {
      console.error(`[Worker] 🔄 Browser crash detected in safeConnect`);
    }
    
    return false;
  }
} 