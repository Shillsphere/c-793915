# LinkedIn Automation Deployment Checklist

## 1. Environment Variables Setup ✅

Set these in Supabase Dashboard → Settings → Configuration → Env vars:

```makefile
SUPABASE_SERVICE_ROLE   = <service_role_key>
BROWSERBASE_API_KEY     = bb_sk_live_xxx
BROWSERBASE_PROJECT_ID  = prj_abc123
OPENAI_API_KEY          = sk-xxx  # optional for AI message generation
```

## 2. Database Migration ✅

Apply the migration to create the required tables:

```bash
supabase db push
```

**Tables Created:**
- `user_browserbase_contexts` - LinkedIn auth contexts
- `campaigns` - User job search campaigns  
- `prospects` - LinkedIn profile tracking
- `invites` - Connection request tracking
- `messages` - Direct message tracking
- `campaign_executions` - Automation run logs

## 3. Edge Function Deployment ✅

Deploy the Stagehand-powered edge function:

```bash
# Deploy function
supabase functions deploy linkedin_job

# Verify deployment
supabase functions list
```

**Function Structure:**
```
supabase/functions/linkedin_job/
├── index.ts          # Entry point - calls runCampaign for each active campaign
└── runCampaign.ts    # Browserbase + Stagehand automation logic
```

## 4. Cron Job Verification ✅

Verify the cron job is scheduled (automatically set up in migration):

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'linkedin_weekdays';

-- Manual scheduling if needed
SELECT cron.schedule(
  'linkedin_weekdays',
  '30 14 * * 1-5',  -- 9:30 AM Central / 2:30 PM UTC
  $$ SELECT net.http_post('https://your-project-id.supabase.co/functions/v1/linkedin_job', '{}') $$
);
```

## 5. RLS Security Test

Verify Row Level Security is working:

```sql
-- Switch to authenticated user role
SET role authenticated;

-- Should return empty (user can only see their own data)
SELECT * FROM invites;
SELECT * FROM messages;

-- Reset role
RESET role;
```

## 6. Local Testing

Test the function locally before going live:

```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve linkedin_job

# Test with curl
curl -X POST http://localhost:54321/functions/v1/linkedin_job \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Check database for test inserts
```

## 7. Production Workflow

The complete user workflow:

### User Setup:
1. Navigate to `/settings/linkedin`
2. Click "Set Up LinkedIn Authentication"
3. Complete LinkedIn login in Browserbase iframe
4. Mark context as ready

### Campaign Creation:
1. Navigate to `/campaigns`
2. Create new campaign with:
   - Keywords for LinkedIn search
   - Daily message limit (5-20 recommended)
   - Message template with {name} and {headline} placeholders
   - CTA mode (calls/lead_magnet/retreat)
3. Set status to "active"

### Automation:
- Runs weekdays at 9:30 AM Central
- Searches LinkedIn for prospects using keywords
- Sends connection requests or direct messages
- Tracks all interactions in database
- Respects daily limits per campaign

## 8. Key Features Implemented

✅ **Browserbase Integration**: Persistent LinkedIn sessions
✅ **Stagehand Automation**: Lightweight browser automation 
✅ **Cron Scheduling**: Automated weekday execution
✅ **Rate Limiting**: Per-campaign daily limits
✅ **Message Personalization**: Template variables + CTA modes
✅ **Duplicate Prevention**: Tracks contacted prospects
✅ **RLS Security**: Users only see their own data
✅ **Error Handling**: Continues on failures, logs errors

## 9. Monitoring Commands

### Check Function Logs:
```bash
supabase functions logs linkedin_job --follow
```

### Check Campaign Performance:
```sql
-- Recent executions
SELECT 
  c.name,
  ce.executed_at,
  ce.messages_sent,
  ce.invites_sent,
  ce.status
FROM campaign_executions ce
JOIN campaigns c ON c.id = ce.campaign_id
ORDER BY ce.executed_at DESC
LIMIT 10;

-- Message stats by campaign
SELECT 
  c.name,
  COUNT(m.id) as total_messages,
  COUNT(m.replied_at) as replies,
  ROUND(COUNT(m.replied_at)::numeric / COUNT(m.id) * 100, 2) as reply_rate
FROM campaigns c
LEFT JOIN prospects p ON p.campaign_id = c.id
LEFT JOIN messages m ON m.prospect_id = p.id
GROUP BY c.id, c.name;
```

## 10. Troubleshooting

### Common Issues:

1. **"No context for user"** → User hasn't completed LinkedIn setup
2. **"Failed to create session"** → Check Browserbase API key/project ID
3. **"Stagehand connection failed"** → Browserbase session timeout
4. **"RLS violation"** → Service role not configured correctly

### Debug Steps:

1. Check environment variables are set
2. Verify Browserbase account status and quota
3. Test function manually with curl
4. Check cron job execution logs
5. Verify database table permissions

## 11. Security Notes

- **LinkedIn Sessions**: Stored securely in Browserbase, not local database
- **API Keys**: All stored as environment variables, never in code
- **User Data**: Protected by RLS policies
- **Rate Limiting**: Prevents LinkedIn abuse/blocking
- **Stealth Mode**: Browserbase runs with anti-detection features

## 12. Next Steps

After successful deployment:

1. **Monitor Initial Runs**: Watch logs for first few executions
2. **Adjust Timing**: Modify cron schedule if needed for timezone
3. **User Onboarding**: Guide users through LinkedIn setup process
4. **Analytics Dashboard**: Build reporting UI for campaign performance
5. **Advanced Features**: 
   - OpenAI integration for smarter messaging
   - Email notifications for responses
   - A/B testing for message templates
   - Integration with CRM systems

## Final Verification

Before going live, confirm:

- [ ] All environment variables set correctly
- [ ] Database migration applied successfully  
- [ ] Edge function deploys without errors
- [ ] Cron job is scheduled and active
- [ ] RLS policies prevent unauthorized access
- [ ] Local testing passes with sample data
- [ ] Browserbase account has sufficient quota
- [ ] LinkedIn authentication flow works end-to-end

🚀 **System is ready for production LinkedIn automation!** 