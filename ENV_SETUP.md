# Environment Variables Setup Guide

## Required Environment Variables

### 1. Supabase Service Role Key

**Variable**: `SUPABASE_SERVICE_ROLE`  
**Purpose**: Allows edge function to access database with elevated permissions

**How to get it**:
1. Go to your Supabase dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (not the `anon` key)
4. Add to Supabase → Settings → Configuration → Env vars

```makefile
SUPABASE_SERVICE_ROLE = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Browserbase API Key

**Variable**: `BROWSERBASE_API_KEY`  
**Purpose**: Creates and manages browser contexts for LinkedIn automation

**How to get it**:
1. Sign up at [browserbase.com](https://browserbase.com)
2. Go to your dashboard
3. Generate an API key (starts with `bb_sk_live_`)
4. Add to Supabase environment variables

```makefile
BROWSERBASE_API_KEY = bb_sk_live_1234567890abcdef...
```

### 3. Browserbase Project ID

**Variable**: `BROWSERBASE_PROJECT_ID`  
**Purpose**: Specifies which Browserbase project to use for browser sessions

**How to get it**:
1. In your Browserbase dashboard
2. Go to Projects
3. Copy the Project ID (usually a short alphanumeric string)
4. Add to Supabase environment variables

```makefile
BROWSERBASE_PROJECT_ID = proj_abc123
```

### 4. OpenAI API Key (Optional)

**Variable**: `OPENAI_API_KEY`  
**Purpose**: Generates personalized cover letters and improves job matching

**How to get it**:
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to API Keys section
3. Create a new API key (starts with `sk-`)
4. Add to Supabase environment variables

```makefile
OPENAI_API_KEY = sk-1234567890abcdef...
```

## Setting Environment Variables in Supabase

### Method 1: Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to **Settings** → **Configuration** → **Environment Variables**
3. Click **Add new variable**
4. Enter the variable name and value
5. Click **Save**

### Method 2: CLI

```bash
# Set variables using Supabase CLI
supabase secrets set SUPABASE_SERVICE_ROLE=your_key_here
supabase secrets set BROWSERBASE_API_KEY=your_key_here
supabase secrets set BROWSERBASE_PROJECT_ID=your_project_here
supabase secrets set OPENAI_API_KEY=your_key_here
```

### Method 3: Environment File (Local Development)

Create a `.env.local` file in your supabase directory:

```bash
# supabase/.env.local
SUPABASE_SERVICE_ROLE=your_key_here
BROWSERBASE_API_KEY=your_key_here
BROWSERBASE_PROJECT_ID=your_project_here
OPENAI_API_KEY=your_key_here
```

## Verification

### Check if Variables are Set

You can verify your environment variables are set correctly:

```sql
-- In Supabase SQL Editor
SELECT current_setting('app.settings.supabase_service_role') as service_key_set;
```

Or test in your edge function:

```typescript
// In your edge function
console.log('Browserbase API Key set:', !!Deno.env.get('BROWSERBASE_API_KEY'));
console.log('Project ID set:', !!Deno.env.get('BROWSERBASE_PROJECT_ID'));
```

### Test API Connections

#### Test Browserbase Connection

```bash
curl -X POST \
  'https://www.browserbase.com/v1/contexts' \
  -H 'Content-Type: application/json' \
  -H 'X-BB-API-Key: your_browserbase_api_key' \
  -d '{"projectId": "your_project_id"}'
```

Expected response:
```json
{
  "id": "ctx_...",
  "connectUrl": "https://connect.browserbase.com/...",
  "projectId": "your_project_id"
}
```

#### Test OpenAI Connection (if using)

```bash
curl -X POST \
  'https://api.openai.com/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your_openai_api_key' \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 5}'
```

## Security Best Practices

### 1. Never Commit API Keys

Add to `.gitignore`:
```
.env
.env.local
.env.production
*.key
supabase/.env.local
```

### 2. Use Different Keys for Different Environments

- **Development**: Use test/sandbox API keys when available
- **Production**: Use production API keys with appropriate rate limits

### 3. Rotate Keys Regularly

- Set calendar reminders to rotate API keys quarterly
- Update Supabase environment variables when keys change
- Test functionality after key rotation

### 4. Monitor Usage

- **Browserbase**: Check session usage in dashboard
- **OpenAI**: Monitor token usage and costs
- **Supabase**: Review function invocation logs

## Troubleshooting

### Common Issues

1. **"Cannot read environment variable"**
   - Verify variable name spelling
   - Check if variable is set in Supabase dashboard
   - Restart edge function after setting variables

2. **"Invalid API key" errors**
   - Verify API key format and prefix
   - Check if key is active and not revoked
   - Ensure key has correct permissions

3. **"Project not found" errors**
   - Verify Browserbase project ID
   - Check if project is active
   - Ensure API key has access to the project

### Debug Environment Variables

Add debugging to your edge function:

```typescript
// At the start of your edge function
const debugEnv = {
  supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
  serviceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE'),
  browserbaseKey: !!Deno.env.get('BROWSERBASE_API_KEY'),
  browserbaseProject: !!Deno.env.get('BROWSERBASE_PROJECT_ID'),
  openaiKey: !!Deno.env.get('OPENAI_API_KEY'),
};

console.log('Environment check:', debugEnv);
```

This will log which variables are available without exposing their values.

## Production Checklist

Before going live:

- [ ] All required environment variables are set
- [ ] API keys are production-ready (not test keys)
- [ ] Browserbase project has sufficient quota
- [ ] OpenAI API key has sufficient credits
- [ ] Edge function deployment is successful
- [ ] Test cron job executes without errors
- [ ] Monitor logs for the first few executions

## Cost Considerations

### Browserbase
- **Free tier**: Limited sessions per month
- **Paid tiers**: Pay per session/minute
- **Optimization**: Set reasonable daily limits per campaign

### OpenAI
- **GPT-3.5**: ~$0.002 per request for cover letters
- **GPT-4**: Higher cost but better quality
- **Optimization**: Cache cover letter templates when possible

### Supabase
- **Edge functions**: Free tier includes 2GB-hours per month
- **Database**: Free tier includes 500MB storage
- **Monitor**: Function execution time and database usage 