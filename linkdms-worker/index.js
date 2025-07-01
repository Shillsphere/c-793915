// linkdms-worker/index.js
// Node.js Worker Service for LinkedIn Automation using Stagehand
import express from 'express';
import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

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
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: campaign, error: cErr } = await db
    .from('campaigns')
    .select('id,user_id,daily_limit,keywords,search_page,targeting_criteria,template')
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

  // Initialize Stagehand with the user's persistent context
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        context: { id: ctx.context_id, persist: true },
        blockAds: true,
        viewport: { width: 1440, height: 900 },
      },
    },
    modelName: 'gpt-4o-mini',
    modelClientOptions: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    selfHeal: true,
    enableCaching: true,
    verbose: 1,
    domSettleTimeoutMs: 4000,
    logger: (l) => console.log(`[sh:${l.category}]`, l.message),
  });

  try {
    await stagehand.init();
    console.log(`[Worker] ✅ Stagehand initialized successfully using context ${ctx.context_id}`);
    
    const { page } = stagehand;
    
    /* ----------------- 1. Navigate to Advanced Search URL ----------------- */
    const searchUrl = buildAdvancedSearchUrl(campaign.targeting_criteria || {}, campaign.keywords);
    console.log(`[Worker] 📍 Navigating to search URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    /* ----------------- 2. Extract search results ----------------- */
    const listSchema = z.object({
      people: z.array(z.object({
        name: z.string(),
        profileUrl: z.string().url(),
        hasConnectButton: z.boolean(),
      })),
    });

    const initialResults = await page.extract({
      instruction: 'Extract all visible profiles, including their name, profile URL and if a Connect button is visible.',
      schema: listSchema,
    });

    const qualified = [];

    /* ----------------- 3. Drill into each profile ----------------- */
    for (const person of initialResults.people) {
      if (qualified.length >= campaign.daily_limit) break;
      if (!person.profileUrl || !person.hasConnectButton) continue;

      try {
        console.log(`[Worker] 🔍 Inspecting profile ${person.name}`);
        await page.goto(person.profileUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(getRandomDelay(1500, 3000));

        const detailSchema = z.object({
          fullExperience: z.array(z.object({
            title: z.string().optional(),
            company: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            duration: z.string().optional(),
            description: z.string().optional(),
            location: z.string().optional(),
          })).optional(),
          about: z.string().optional(),
          pronouns: z.string().optional(),
        });

        const detailedProfile = await withRetry(() => page.extract({
          instruction: 'Extract the person\'s full work experience including dates/duration, their "About" section, and their pronouns if listed.',
          schema: detailSchema,
        }), 2);

        if (meetsTargetCriteria(detailedProfile, campaign.targeting_criteria)) {
          console.log(`[Worker] ✅ Qualified: ${person.name}`);
          qualified.push({ ...person, detailedProfile });
        } else {
          console.log(`[Worker] ❌ Skipped: ${person.name}`);
        }
      } catch (err) {
        console.warn(`[Worker] ⚠️ Error inspecting profile ${person.name}:`, err.message);
      }
    }

    /* ----------------- 4. Send connection requests ----------------- */
    let sent = 0;
    for (const target of qualified) {
      if (sent >= campaign.daily_limit) break;
      const success = await sendConnectionRequest(page, target, campaign);
      if (success) {
        sent++;
        await page.waitForTimeout(getRandomDelay(3000, 8000));
      } else {
        if (stagehand.isClosed()) break;
      }
    }

    await safeClose(stagehand);
    console.log(`[Worker] 🧹 Session closed. Invites sent: ${sent}`);

    res.status(200).json({
      success: true,
      invitesSent: sent,
      qualifiedCount: qualified.length,
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
  }
});

// Start the worker service
// Fly.io injects the internal port via the PORT env variable at runtime. Default to 3000 (the same as fly.toml) if not set.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LinkDMS Worker listening on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🤖 Endpoint: http://localhost:${PORT}/run-linkedin-job`);
});

// +++++++++++++ HELPER FUNCTIONS +++++++++++++
// Build LinkedIn search URL with advanced filters
function buildAdvancedSearchUrl(criteria = {}, keywords = '') {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const params = new URLSearchParams();

  // Keywords always first
  const cleaned = keywords.replace(/[\(\)"]+/g, '').trim();
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
    const genderMatch = demographics.gender_keywords.some((kw) => text.includes(kw.toLowerCase()));
    if (!genderMatch) return false;
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

  return true;
}

// ----------------- Utility helpers -----------------
function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    await page.goto(target.profileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(getRandomDelay(2000, 4000));

    const connectBtn = await page.observe('Locate the Connect button near the top of the profile');
    if (!connectBtn?.length) throw new Error('Connect button not found');

    await page.act('Click the Connect button');
    await page.waitForTimeout(getRandomDelay(1000, 2000));

    const addNoteBtn = await page.observe('Look for Add a note option');
    if (addNoteBtn?.length && campaign.template) {
      await page.act('Click Add a note');
      await page.waitForTimeout(500);
      const firstName = target.name.split(' ')[0];
      const personalized = await genMessage(firstName, campaign);
      await page.act(`Type the message: "${personalized}"`);
      await page.waitForTimeout(500);
    }

    await page.act('Click the Send invitation button');
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