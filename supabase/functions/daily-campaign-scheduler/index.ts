import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Campaign {
  campaign_id: number;
  campaign_name: string;
  daily_limit: number;
  daily_sent: number;
  remaining_today: number;
  user_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[Scheduler] Daily campaign scheduler started');

    // Reset daily counters for new day
    const { error: resetError } = await supabaseClient.rpc('reset_daily_counters');
    if (resetError) {
      console.error('[Scheduler] Error resetting daily counters:', resetError);
    }

    // Get campaigns ready for execution
    const { data: campaigns, error: campaignsError } = await supabaseClient
      .rpc('get_campaigns_ready_for_execution');

    if (campaignsError) {
      throw new Error(`Failed to get campaigns: ${campaignsError.message}`);
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[Scheduler] No campaigns ready for execution');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No campaigns ready for execution',
          campaigns_processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Scheduler] Found ${campaigns.length} campaigns ready for execution`);

    // Process each campaign
    const results = [];
    for (const campaign of campaigns as Campaign[]) {
      try {
        const result = await processCampaign(supabaseClient, campaign);
        results.push(result);
      } catch (error) {
        console.error(`[Scheduler] Error processing campaign ${campaign.campaign_id}:`, error);
        results.push({
          campaign_id: campaign.campaign_id,
          success: false,
          error: error.message
        });
      }
    }

    // Process follow-up campaigns
    const followUpResults = await processFollowUpCampaigns(supabaseClient);

    // Schedule next runs for all active campaigns
    await scheduleNextRuns(supabaseClient);

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns_processed: campaigns.length,
        followup_campaigns_processed: followUpResults.length,
        results,
        followup_results: followUpResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Scheduler] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processCampaign(supabaseClient: any, campaign: Campaign) {
  console.log(`[Scheduler] Processing campaign: ${campaign.campaign_name} (${campaign.remaining_today} remaining)`);

  if (campaign.remaining_today <= 0) {
    console.log(`[Scheduler] Campaign ${campaign.campaign_name} already reached daily limit`);
    return {
      campaign_id: campaign.campaign_id,
      success: true,
      message: 'Daily limit already reached',
      batches_scheduled: 0
    };
  }

  // Calculate optimal batch strategy
  const batchStrategy = calculateBatchStrategy(campaign.remaining_today);
  console.log(`[Scheduler] Batch strategy for ${campaign.campaign_name}:`, batchStrategy);

  // Execute first batch immediately
  const firstBatchResult = await executeBatch(supabaseClient, campaign, batchStrategy.batches[0], 1, batchStrategy.totalBatches);

  // Schedule remaining batches with delays
  const scheduledBatches = [];
  for (let i = 1; i < batchStrategy.batches.length; i++) {
    const batch = batchStrategy.batches[i];
    const delayMinutes = batch.delayMinutes;
    
    // Schedule batch execution
    const scheduleResult = await scheduleBatchExecution(
      supabaseClient, 
      campaign, 
      batch, 
      i + 1, 
      batchStrategy.totalBatches, 
      delayMinutes
    );
    scheduledBatches.push(scheduleResult);
  }

  return {
    campaign_id: campaign.campaign_id,
    success: true,
    immediate_batch: firstBatchResult,
    scheduled_batches: scheduledBatches,
    total_batches: batchStrategy.totalBatches
  };
}

function calculateBatchStrategy(remainingConnections: number) {
  const maxBatchSize = 7;
  const minBatchSize = 3;
  
  if (remainingConnections <= maxBatchSize) {
    // Single batch
    return {
      totalBatches: 1,
      batches: [{
        size: remainingConnections,
        delayMinutes: 0
      }]
    };
  }

  // Multiple batches - aim for 5-7 connections per batch
  const optimalBatchSize = Math.min(maxBatchSize, Math.max(minBatchSize, Math.ceil(remainingConnections / 3)));
  const numBatches = Math.ceil(remainingConnections / optimalBatchSize);
  
  const batches = [];
  let remaining = remainingConnections;
  
  for (let i = 0; i < numBatches; i++) {
    const batchSize = Math.min(optimalBatchSize, remaining);
    const delayMinutes = i === 0 ? 0 : (120 + Math.random() * 120); // 2-4 hour delays between batches
    
    batches.push({
      size: batchSize,
      delayMinutes: Math.round(delayMinutes)
    });
    
    remaining -= batchSize;
  }

  return {
    totalBatches: numBatches,
    batches
  };
}

async function executeBatch(supabaseClient: any, campaign: Campaign, batch: any, batchNumber: number, totalBatches: number) {
  console.log(`[Scheduler] Executing immediate batch ${batchNumber}/${totalBatches} for ${campaign.campaign_name}: ${batch.size} connections`);

  // Create execution log
  const { data: execution, error: executionError } = await supabaseClient
    .from('campaign_executions')
    .insert({
      campaign_id: campaign.campaign_id,
      execution_type: 'scheduled',
      batch_number: batchNumber,
      total_batches: totalBatches,
      status: 'running'
    })
    .select()
    .single();

  if (executionError) {
    throw new Error(`Failed to create execution log: ${executionError.message}`);
  }

  try {
    // Call the LinkedIn worker
    const workerResponse = await fetch('https://linkdms-worker.fly.dev/run-linkedin-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaign_id: campaign.campaign_id,
        batch_size: batch.size,
        execution_id: execution.id
      })
    });

    const workerResult = await workerResponse.json();

    // Update execution log
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: workerResult.success ? 'completed' : 'failed',
        connections_made: workerResult.invitesSent || 0,
        completed_at: new Date().toISOString(),
        error_message: workerResult.success ? null : workerResult.error,
        worker_logs: workerResult
      })
      .eq('id', execution.id);

    return {
      success: workerResult.success,
      connections_made: workerResult.invitesSent || 0,
      execution_id: execution.id
    };

  } catch (error) {
    // Update execution log with error
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', execution.id);

    throw error;
  }
}

async function scheduleBatchExecution(supabaseClient: any, campaign: Campaign, batch: any, batchNumber: number, totalBatches: number, delayMinutes: number) {
  console.log(`[Scheduler] Scheduling batch ${batchNumber}/${totalBatches} for ${campaign.campaign_name} in ${delayMinutes} minutes`);

  // For now, we'll use a simple delay approach
  // In production, you might want to use a proper job queue like pg_cron or external service
  
  setTimeout(async () => {
    try {
      await executeBatch(supabaseClient, campaign, batch, batchNumber, totalBatches);
      console.log(`[Scheduler] Delayed batch ${batchNumber} completed for ${campaign.campaign_name}`);
    } catch (error) {
      console.error(`[Scheduler] Delayed batch ${batchNumber} failed for ${campaign.campaign_name}:`, error);
    }
  }, delayMinutes * 60 * 1000);

  return {
    batch_number: batchNumber,
    scheduled_for: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
    connections: batch.size
  };
}

async function processFollowUpCampaigns(supabaseClient: any) {
  console.log('[Scheduler] Processing follow-up campaigns');

  try {
    // Get all active follow-up campaigns
    const { data: followUpCampaigns, error: campaignsError } = await supabaseClient
      .from('campaigns')
      .select('id, campaign_name, user_id, cta_mode')
      .eq('cta_mode', 'connect_then_followup')
      .eq('is_active', true)
      .eq('status', 'active');

    if (campaignsError) {
      console.error('[Scheduler] Error fetching follow-up campaigns:', campaignsError);
      return [];
    }

    if (!followUpCampaigns || followUpCampaigns.length === 0) {
      console.log('[Scheduler] No active follow-up campaigns found');
      return [];
    }

    console.log(`[Scheduler] Found ${followUpCampaigns.length} follow-up campaigns to process`);

    const results = [];
    for (const campaign of followUpCampaigns) {
      try {
        // Call the worker's follow-up endpoint
        const workerResponse = await fetch('https://linkdms-worker.fly.dev/process-followups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaign_id: campaign.id
          })
        });

        const workerResult = await workerResponse.json();

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.campaign_name,
          success: workerResult.success,
          followUps_sent: workerResult.followUpsSent || 0,
          newConnections_detected: workerResult.newConnectionsDetected || 0,
          error: workerResult.success ? null : workerResult.error
        });

        console.log(`[Scheduler] Follow-up processing for ${campaign.campaign_name}: ${workerResult.followUpsSent || 0} messages sent`);

      } catch (error) {
        console.error(`[Scheduler] Error processing follow-ups for campaign ${campaign.id}:`, error);
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.campaign_name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[Scheduler] Error in processFollowUpCampaigns:', error);
    return [];
  }
}

async function scheduleNextRuns(supabaseClient: any) {
  console.log('[Scheduler] Scheduling next runs for all active campaigns');

  // Set next_run_date to tomorrow for all active campaigns
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Random time between 9 AM - 5 PM PST (16:00 - 00:00 UTC)
  const randomHour = Math.floor(Math.random() * 8) + 16; // 16-23 UTC (9 AM - 4 PM PST)
  const randomMinute = Math.floor(Math.random() * 60);
  
  tomorrow.setUTCHours(randomHour, randomMinute, 0, 0);

  const { error } = await supabaseClient
    .from('campaigns')
    .update({ next_run_date: tomorrow.toISOString().split('T')[0] })
    .eq('is_active', true)
    .eq('status', 'active');

  if (error) {
    console.error('[Scheduler] Error scheduling next runs:', error);
  } else {
    console.log(`[Scheduler] Scheduled next runs for ${tomorrow.toISOString()}`);
  }
} 