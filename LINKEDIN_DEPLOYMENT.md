# LinkedIn Job Automation Deployment Guide

This guide will help you deploy the LinkedIn job automation system with cron-driven edge functions.

## Prerequisites

1. **Supabase Project**: Ensure you have a Supabase project set up
2. **Browserbase Account**: Sign up at [browserbase.com](https://browserbase.com)
3. **OpenAI API Key**: For cover letter generation (optional)
4. **Supabase CLI**: Install the Supabase CLI tool

## 1. Environment Variables Setup

Add the following environment variables to your Supabase project:

### In Supabase Dashboard → Settings → Configuration → Env vars:

```bash
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key_here
BROWSERBASE_API_KEY = bb_sk_live_your_api_key_here  
BROWSERBASE_PROJECT = your_project_id_here
OPENAI_API_KEY = sk-your_openai_key_here  # Optional
```

## 2. Database Migration

Apply the new database schema by running the migration:

```bash
# First, make sure you're in the project directory
cd your-project-directory

# Apply the migration
supabase db push
```

This will create the following tables:
- `user_browserbase_contexts` - Stores LinkedIn authentication contexts
- `campaigns` - User-defined job search campaigns  
- `campaign_executions` - Logs of automation runs
- `job_applications` - Individual job application records

## 3. Deploy Edge Function

Deploy the LinkedIn job automation edge function:

```bash
# Deploy the function
supabase functions deploy linkedin_job

# Verify deployment
supabase functions list
```

## 4. Configure Cron Job

The cron job is automatically set up in the migration, but you can verify it:

```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'linkedin_weekdays';

-- Manual scheduling (if needed)
SELECT cron.schedule(
  'linkedin_weekdays',
  '30 14 * * 1-5',      -- 9:30 AM Central / 2:30 PM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://your-project-id.supabase.co/functions/v1/linkedin_job',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

## 5. Frontend Setup

### Add Route for LinkedIn Settings

Add to your routing configuration:

```tsx
// In your App.tsx or routing file
import LinkedinSettings from '@/pages/LinkedinSettings';
import CampaignManager from '@/pages/CampaignManager';

// Add routes:
// /settings/linkedin -> LinkedinSettings
// /campaigns -> CampaignManager
```

### Update Navigation

Add LinkedIn automation links to your navigation:

```tsx
<NavLink to="/settings/linkedin">LinkedIn Setup</NavLink>
<NavLink to="/campaigns">Job Campaigns</NavLink>
```

## 6. API Endpoint Setup

For Vite/React projects, you'll need to set up API endpoints. Create:

```bash
mkdir -p public/api/browserbase
```

Or if using a framework like Next.js, create the API routes in the appropriate directory.

## 7. Testing the Setup

### 1. Test Database Migration
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('campaigns', 'user_browserbase_contexts', 'campaign_executions', 'job_applications');
```

### 2. Test Edge Function
```bash
# Test the function manually
curl -X POST \
  'https://your-project-id.supabase.co/functions/v1/linkedin_job' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json'
```

### 3. Test Cron Schedule
```sql
-- Check cron job status
SELECT * FROM cron.job_run_details WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'linkedin_weekdays'
) ORDER BY start_time DESC LIMIT 5;
```

## 8. User Workflow

Once deployed, users will follow this workflow:

1. **LinkedIn Setup** (`/settings/linkedin`):
   - Click "Set Up LinkedIn Authentication"
   - Complete LinkedIn login in secure browser
   - Mark context as ready

2. **Create Campaign** (`/campaigns`):
   - Set campaign name and search terms
   - Configure daily application limits
   - Write cover letter template
   - Activate campaign

3. **Automation Runs**:
   - System runs weekdays at 9:30 AM Central
   - Applies to jobs based on campaign settings
   - Tracks applications in database

## 9. Monitoring and Logs

### Check Edge Function Logs
```bash
supabase functions logs linkedin_job
```

### Check Campaign Executions
```sql
SELECT 
  c.name as campaign_name,
  ce.executed_at,
  ce.applications_submitted,
  ce.status,
  ce.error_message
FROM campaign_executions ce
JOIN campaigns c ON c.id = ce.campaign_id
ORDER BY ce.executed_at DESC
LIMIT 10;
```

### Check Job Applications
```sql
SELECT 
  ja.job_title,
  ja.company,
  ja.application_date,
  ja.status,
  c.name as campaign_name
FROM job_applications ja
JOIN campaigns c ON c.id = ja.campaign_id
ORDER BY ja.application_date DESC
LIMIT 20;
```

## 10. Security Considerations

1. **RLS Policies**: All tables have Row Level Security enabled
2. **Service Role**: Edge function uses service role for database access
3. **Browserbase**: LinkedIn sessions are stored securely in Browserbase
4. **API Keys**: All sensitive keys are stored as environment variables

## 11. Troubleshooting

### Common Issues:

1. **Cron not running**: Check pg_cron extension is enabled
2. **Edge function fails**: Verify environment variables are set
3. **Browserbase errors**: Check API key and project ID
4. **Database errors**: Ensure migration was applied correctly

### Debug Commands:

```bash
# Check Supabase status
supabase status

# View edge function logs
supabase functions logs linkedin_job --follow

# Test database connection
supabase db ping
```

## 12. Scaling Considerations

- **Rate Limiting**: LinkedIn has rate limits for job applications
- **Daily Limits**: Users can set per-campaign daily limits
- **Error Handling**: System logs errors and continues with other campaigns
- **Context Persistence**: Browserbase contexts persist across runs

## Next Steps

After deployment:
1. Test the system with a small campaign
2. Monitor logs for any issues
3. Adjust cron timing if needed for your timezone
4. Add additional features like email notifications
5. Implement analytics dashboard for application tracking

## Support

If you encounter issues:
1. Check the Supabase dashboard for errors
2. Review edge function logs
3. Verify all environment variables are set
4. Ensure Browserbase account is active 