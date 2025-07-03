import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Play, Pause, Trash2, Edit, Loader2, Calendar, BarChart3, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CampaignFormModal } from '@/components/CampaignFormModal';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Function to fetch campaigns for the current user
const fetchCampaigns = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;
  return data;
};

// Function to fetch user's daily summary
const fetchUserDailySummary = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase.rpc('get_user_daily_summary', {
    p_user_id: user.id
  });

  if (error) throw error;
  return data?.[0] || {
    total_campaigns: 0,
    active_campaigns: 0,
    daily_connections_sent: 0,
    daily_limit_total: 0,
    remaining_today: 0,
    next_execution_time: null
  };
};

// Function to activate campaign automation
const activateCampaignJob = async (campaignId: string) => {
  const { data, error } = await supabase.functions.invoke('linkedin_job', {
    body: { campaign_id: campaignId },
  });
  if (error) throw new Error(error.message);
  return data;
};

// Function to activate/deactivate campaign
const toggleCampaignStatus = async ({ campaignId, newStatus }: { campaignId: string, newStatus: 'active' | 'draft' | 'paused' }) => {
  const { error } = await supabase
    .from('campaigns')
    .update({ status: newStatus })
    .eq('id', campaignId);
  if (error) throw error;
  return { success: true };
};

// Function to finish today's remaining connections for an active campaign
const finishTodaysBatch = async (campaignId: string) => {
  const response = await fetch('https://linkdms-worker.fly.dev/run-linkedin-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaign_id: campaignId
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  
  return data;
};

// Function to delete campaign
const deleteCampaign = async (campaignId: string) => {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId);
  if (error) throw error;
  return { success: true };
};

const CampaignManager = () => {
  // 3. Replace useState with useQuery
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns'], // Unique key for this query
    queryFn: fetchCampaigns, // The function that fetches the data
  });

  // Daily summary query
  const { data: dailySummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['user-daily-summary'],
    queryFn: fetchUserDailySummary,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);

  // --- Activate Mutation ---
  const activateMutation = useMutation({
    mutationFn: activateCampaignJob,
    onSuccess: (data, campaignId) => {
      toast.success("Automation job started! It will run in the background.");
      // Optionally refetch counts to show updated progress
      queryClient.invalidateQueries({ queryKey: ['counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-summary'] });
    },
    onError: (error) => {
      toast.error(`Job failed to start: ${error.message}`);
    },
  });

  // --- Finish Today's Batch Mutation ---
  const finishBatchMutation = useMutation({
    mutationFn: finishTodaysBatch,
    onSuccess: (data) => {
      toast.success(`Batch completed! Sent ${data.invitesSent || 0} connections.`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-summary'] });
    },
    onError: (error) => {
      toast.error(`Batch failed: ${error.message}`);
    },
  });

  // --- Status Toggle Mutation ---
  const statusMutation = useMutation({
    mutationFn: toggleCampaignStatus,
    onSuccess: (data, { newStatus }) => {
      const actionText = newStatus === 'active' ? 'activated' : newStatus === 'paused' ? 'paused' : 'deactivated';
      toast.success(`Campaign ${actionText} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-summary'] });
    },
    onError: (error) => {
      toast.error(`Failed to update campaign: ${error.message}`);
    },
  });

  // --- Delete Mutation ---
  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      toast.success("Campaign deleted successfully.");
      // This is the key to a responsive UI: tell Tanstack Query to refetch the campaign list.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete campaign: ${error.message}`);
    },
  });

  // 4. Handle loading and error states
  if (isLoading) return <div>Loading campaigns...</div>;
  if (error) return <div>Error fetching campaigns: {error.message}</div>;
  
  return (
    <div className="space-y-6 pt-24">
       <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold">Your Campaigns</h2>
         <Button onClick={() => setIsCreateModalOpen(true)}>
           <Plus className="mr-2 h-4 w-4" /> New Campaign
         </Button>
       </div>

       {/* Daily Summary Dashboard */}
       {!summaryLoading && dailySummary && (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Today's Progress</CardTitle>
               <BarChart3 className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">
                 {dailySummary.daily_connections_sent}/{dailySummary.daily_limit_total}
               </div>
               <Progress 
                 value={dailySummary.daily_limit_total > 0 ? (dailySummary.daily_connections_sent / dailySummary.daily_limit_total) * 100 : 0} 
                 className="mt-2"
               />
               <p className="text-xs text-muted-foreground mt-2">
                 {dailySummary.remaining_today} connections remaining today
               </p>
             </CardContent>
           </Card>

           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
               <Calendar className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">
                 {dailySummary.active_campaigns}/{dailySummary.total_campaigns}
               </div>
               <p className="text-xs text-muted-foreground">
                 campaigns running automation
               </p>
             </CardContent>
           </Card>

           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Next Execution</CardTitle>
               <Clock className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-sm font-bold">
                 {dailySummary.next_execution_time 
                   ? new Date(dailySummary.next_execution_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                   : 'No scheduled runs'
                 }
               </div>
               <p className="text-xs text-muted-foreground">
                 {dailySummary.next_execution_time 
                   ? `${Math.round((new Date(dailySummary.next_execution_time).getTime() - Date.now()) / (1000 * 60))} min`
                   : 'Schedule campaigns below'
                 }
               </p>
             </CardContent>
           </Card>

           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Auto Schedule</CardTitle>
               <Pause className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-sm font-bold text-green-600">
                 Active
               </div>
               <p className="text-xs text-muted-foreground">
                 Daily automation running
               </p>
             </CardContent>
           </Card>
         </div>
       )}
      <CampaignFormModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* Edit modal */}
      <CampaignFormModal
        isOpen={!!editingCampaign}
        onClose={() => setEditingCampaign(null)}
        campaign={editingCampaign}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(campaigns || []).map(campaign => (
          <Card key={campaign.id} onClick={() => setSelectedCampaign(campaign)} className="cursor-pointer">
            <CardHeader>
              <CardTitle>{campaign.campaign_name}</CardTitle>
              <CardDescription>
                {campaign.keywords || 'No keywords specified'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProgressBar campaign={campaign} />
              <div className="flex justify-between items-center pt-2">
                <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                  {campaign.status}
                </Badge>
                <p className="text-sm text-muted-foreground">{campaign.daily_limit} Connections/day</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={(e) => {
                   e.stopPropagation();
                   setEditingCampaign(campaign);
                 }}
               >
                 <Edit className="h-4 w-4" />
               </Button>
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="text-destructive"
                 disabled={deleteMutation.isPending}
                 onClick={(e) => {
                   e.stopPropagation();
                   if (window.confirm(`Are you sure you want to delete "${campaign.campaign_name}"?`)) {
                     deleteMutation.mutate(campaign.id);
                   }
                 }}
               >
                 {deleteMutation.isPending && deleteMutation.variables === campaign.id ? (
                   <Loader2 className="h-4 w-4 animate-spin" />
                 ) : (
                   <Trash2 className="h-4 w-4" />
                 )}
               </Button>
               
               {/* Activate/Deactivate Button */}
               <Button 
                 variant={campaign.status === 'active' ? 'secondary' : 'default'}
                 size="sm"
                 disabled={statusMutation.isPending}
                 onClick={(e) => {
                   e.stopPropagation();
                   const newStatus = campaign.status === 'active' ? 'draft' : 'active';
                   statusMutation.mutate({ campaignId: campaign.id, newStatus });
                 }}
               >
                 {statusMutation.isPending && statusMutation.variables?.campaignId === campaign.id ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : campaign.status === 'active' ? (
                   <Pause className="mr-2 h-4 w-4" />
                 ) : (
                   <Play className="mr-2 h-4 w-4" />
                 )}
                 {campaign.status === 'active' ? 'Pause' : 'Activate'}
               </Button>
               
               {/* Finish Today's Batch Button - show for campaigns with remaining connections */}
               {campaign.status === 'active' && campaign.daily_sent < campaign.daily_limit && (
                 <Button 
                   onClick={(e) => {
                     e.stopPropagation();
                     finishBatchMutation.mutate(campaign.id);
                   }} 
                   disabled={finishBatchMutation.isPending}
                   size="sm"
                   variant="outline"
                 >
                   {finishBatchMutation.isPending && finishBatchMutation.variables === campaign.id ? (
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   ) : (
                     <Play className="mr-2 h-4 w-4" />
                   )}
                   Finish Today ({campaign.daily_limit - campaign.daily_sent} left)
                 </Button>
               )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedCampaign && (
        <CampaignLogDialog campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}
    </div>
  );
};

// --- ProgressBar component ---------------------------------------
const ProgressBar = ({ campaign }: { campaign: any }) => {
  // Use the new daily_sent field from campaigns table instead of counting invites
  const dailySent = campaign.daily_sent || 0;
  const dailyLimit = campaign.daily_limit || 1;
  const pct = Math.min(100, (dailySent / dailyLimit) * 100);
  
  return (
    <div className="space-y-1">
      <Progress value={pct} />
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {dailySent}/{dailyLimit} today
        </p>
        {campaign.next_run_date && (
          <p className="text-xs text-blue-600">
            Next: {campaign.next_run_date}
          </p>
        )}
      </div>
    </div>
  );
};

// --- CampaignLogDialog -------------------------------------------
const CampaignLogDialog = ({ campaign, onClose }: { campaign: any, onClose: () => void }) => {
  const { data: executions } = useQuery({
    queryKey: ['campaign-executions', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign,
  });

  const { data: dailyStats } = useQuery({
    queryKey: ['campaign-daily-stats', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_daily_stats', {
        p_campaign_id: campaign.id,
        p_days_back: 30
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign,
  });

  const { data: summary } = useQuery({
    queryKey: ['campaign-execution-summary', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_execution_summary', {
        p_campaign_id: campaign.id
      });
      if (error) throw error;
      return data?.[0] || {};
    },
    enabled: !!campaign,
  });

  return (
    <Dialog open={!!campaign} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campaign Analytics – {campaign.campaign_name}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="daily">Daily Stats</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-4">
            {summary && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Executions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.total_executions || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {summary.successful_executions || 0} successful, {summary.failed_executions || 0} failed
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Connections Made</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.total_connections_made || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {summary.avg_connections_per_execution || 0} per execution
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Last Run</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {summary.last_execution_date 
                        ? new Date(summary.last_execution_date).toLocaleDateString()
                        : 'Never'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Next: {summary.next_scheduled_date || 'Not scheduled'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="executions" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(executions || []).map((execution: any) => (
                  <TableRow key={execution.id}>
                    <TableCell>{new Date(execution.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={execution.execution_type === 'manual' ? 'default' : 'secondary'}>
                        {execution.execution_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        execution.status === 'completed' ? 'default' : 
                        execution.status === 'failed' ? 'destructive' : 
                        'secondary'
                      }>
                        {execution.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{execution.connections_made || 0}</TableCell>
                    <TableCell>
                      {execution.batch_number}/{execution.total_batches}
                    </TableCell>
                    <TableCell>
                      {execution.completed_at && execution.created_at 
                        ? `${Math.round((new Date(execution.completed_at).getTime() - new Date(execution.created_at).getTime()) / 1000 / 60)}m`
                        : execution.status === 'running' ? 'Running...' : '—'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="daily" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dailyStats || []).map((stat: any) => (
                  <TableRow key={stat.date}>
                    <TableCell>{new Date(stat.date).toLocaleDateString()}</TableCell>
                    <TableCell>{stat.connections_sent}</TableCell>
                    <TableCell>{stat.executions_count}</TableCell>
                    <TableCell>
                      {stat.executions_count > 0 
                        ? `${(stat.connections_sent / stat.executions_count).toFixed(1)}/execution`
                        : '—'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignManager;
