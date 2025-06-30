# LinkDMS Admin Setup Guide

This guide explains how to use the white-glove admin setup process for connecting LinkedIn accounts.

## Overview

The LinkDMS V1 Core Architecture uses a "white-glove," admin-driven process for the initial, one-time account connection. This completely avoids iframe and CORS issues while ensuring maximum reliability.

## Prerequisites

1. Node.js and npm installed
2. Access to Supabase admin credentials
3. Browserbase account with API access

## Environment Setup

Create a `.env` file in the project root with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Browserbase Configuration  
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here
```

## Running the Admin Setup

1. **Get the User ID**: First, identify the Supabase user ID for the account you need to set up. You can find this in your Supabase dashboard under Authentication > Users.

2. **Run the Setup Script**:
   ```bash
   npx ts-node admin-setup.ts
   ```

3. **Follow the Prompts**:
   - Enter the Supabase User ID when prompted
   - The script will create a Browserbase session and provide a Live View URL
   - Open the URL in your browser
   - Manually log into the user's LinkedIn account
   - Once logged in and on the LinkedIn feed, press Enter in the terminal

4. **Verification**: The script will automatically save the context to the database and mark it as ready.

## User Experience

After setup is complete:

- Users will see a simple status indicator in Settings showing "✅ Connected"
- No complex UI, buttons, or iframe interactions needed
- The saved context will be used automatically for all campaign automations

## How It Works

1. **One-Time Setup**: Admin runs the script to create a persistent Browserbase context
2. **Manual Login**: Admin logs into LinkedIn via the live browser view
3. **Context Persistence**: Browserbase saves all cookies and session data
4. **Database Storage**: Context ID is saved to `user_browserbase_contexts` table
5. **Automation**: Campaign runs use the saved context for pre-authenticated sessions

## Architecture Benefits

- **Reliability**: No iframe/CORS issues
- **Security**: Admin-controlled setup process
- **Simplicity**: Clean user interface
- **Persistence**: One-time setup, permanent sessions
- **Robustness**: Professional white-glove service approach

## Troubleshooting

- **Context Creation Fails**: Check Browserbase API credentials
- **Database Save Fails**: Verify Supabase service role permissions
- **Login Issues**: Ensure you're logging into the correct LinkedIn account
- **Session Expires**: Re-run the setup script for that user

This process ensures maximum reliability and avoids the technical complexities that have caused issues with automated browser login flows. 