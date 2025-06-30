// linkdms-worker/index.js
// Node.js Worker Service for LinkedIn Automation using Stagehand
import express from 'express';
import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';

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

  // Initialize Stagehand with basic config
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    modelName: "gpt-4o",
    modelClientOptions: { 
      apiKey: process.env.OPENAI_API_KEY 
    },
  });

  try {
    await stagehand.init();
    console.log(`[Worker] ✅ Stagehand initialized successfully`);
    
    const { page } = stagehand;
    
    // Basic test: Load LinkedIn feed
    console.log(`[Worker] 📱 Navigating to LinkedIn...`);
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    console.log(`[Worker] ✅ Successfully loaded page. Title: ${title}`);
    
    // Check if we're logged in
    const isLoggedIn = !await page.locator('input[name="session_key"]').count();
    console.log(`[Worker] 🔐 Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
    
    await stagehand.close();
    console.log(`[Worker] 🧹 Stagehand session closed`);
    
    res.status(200).json({ 
      success: true, 
      message: "Job completed successfully.", 
      pageTitle: title,
      loggedIn: isLoggedIn,
      campaignId: campaign_id
    });

  } catch (error) {
    console.error(`[Worker] ❌ Job failed:`, error.message);
    try {
      if (stagehand) await stagehand.close();
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 LinkDMS Worker listening on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🤖 Endpoint: http://localhost:${PORT}/run-linkedin-job`);
}); 