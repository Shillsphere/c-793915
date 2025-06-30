# LinkDMS Worker Service

A dedicated Node.js service for running LinkedIn automation using Stagehand AI agent.

## Architecture

This worker service runs in a proper Node.js environment where Stagehand can operate without networking restrictions. It receives automation requests from the Supabase Edge Function and executes them using Browserbase + Stagehand.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `env-example.txt` to `.env` and fill in your values:
   ```bash
   cp env-example.txt .env
   ```

3. **Required Environment Variables**
   - `BROWSERBASE_API_KEY` - Your Browserbase API key
   - `BROWSERBASE_PROJECT_ID` - Your Browserbase project ID
   - `OPENAI_API_KEY` - OpenAI API key for Stagehand AI agent
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
   - `PORT` - Server port (default: 3001)

## Local Development

```bash
npm run dev
```

The service will start on `http://localhost:3001`

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add LinkDMS worker service"
   git push
   ```

2. **Deploy to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import your GitHub repository
   - Set the root directory to `linkdms-worker`
   - Add all environment variables in Vercel project settings
   - Deploy

3. **Update Supabase Function**
   Add the Vercel URL as `WORKER_URL` in your Supabase Edge Function secrets:
   ```
   WORKER_URL=https://your-linkdms-worker.vercel.app/run-linkedin-job
   ```

### Fly.io Alternative

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Deploy**
   ```bash
   fly launch
   fly secrets set BROWSERBASE_API_KEY=your_key OPENAI_API_KEY=your_key ...
   fly deploy
   ```

## API Endpoints

### `POST /run-linkedin-job`

Executes LinkedIn automation for a specific campaign.

**Request Body:**
```json
{
  "campaign": {
    "id": 1,
    "name": "Tech Professionals",
    "keywords": "software engineer",
    "template": "Hello {name}! I'd love to connect.",
    "daily_limit": 5,
    "user_id": "user_123"
  },
  "contextId": "ctx_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "result": "Successfully sent 5 LinkedIn invitations",
  "invitesSent": 5,
  "campaignId": 1
}
```

### `GET /health`

Health check endpoint for monitoring.

## How It Works

1. **Supabase Function** calls this worker with campaign data
2. **Worker** initializes Stagehand with proper Node.js environment
3. **Stagehand** loads persistent LinkedIn context (logged-in state)
4. **AI Agent** executes high-level automation goals on LinkedIn
5. **Results** are logged to Supabase and returned to caller

## Features

- ✅ **Stagehand AI Agent** - Natural language automation goals
- ✅ **Persistent Context** - Maintains LinkedIn login across sessions  
- ✅ **Proxy Support** - Uses residential IPs via Browserbase
- ✅ **Error Handling** - Robust logging and recovery
- ✅ **Rate Limiting** - Respects daily limits and human-like pacing
- ✅ **Validation** - Zod schema validation for requests 