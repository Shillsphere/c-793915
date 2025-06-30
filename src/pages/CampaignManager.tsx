import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Play, Pause, Trash2, Edit, Loader2 } from 'lucide-react';
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

// Function to activate campaign automation
const activateCampaignJob = async (campaignId: string) => {
  const { data, error } = await supabase.functions.invoke('linkedin_job', {
    body: { campaign_id: campaignId },
  });
  if (error) throw new Error(error.message);
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
  
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);

  // --- Activate Mutation ---
  const activateMutation = useMutation({
    mutationFn: activateCampaignJob,
    onSuccess: (data, campaignId) => {
      toast.success("Automation job started! It will run in the background.");
      // Optionally refetch counts to show updated progress
      queryClient.invalidateQueries({ queryKey: ['counts'] });
    },
    onError: (error) => {
      toast.error(`Job failed to start: ${error.message}`);
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
    <div className="space-y-6">
       <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold">Your Campaigns</h2>
         <Button onClick={() => setIsModalOpen(true)}>
           <Plus className="mr-2 h-4 w-4" /> New Campaign
         </Button>
       </div>
      <CampaignFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(campaigns || []).map(campaign => (
          <Card key={campaign.id} onClick={() => setSelectedCampaign(campaign)} className="cursor-pointer">
            <CardHeader>
              <CardTitle>{campaign.name}</CardTitle>
              <CardDescription>Keywords: "{campaign.keywords}"</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProgressBar campaign={campaign} />
              <div className="flex justify-between items-center pt-2">
                <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                  {campaign.status}
                </Badge>
                <p className="text-sm text-muted-foreground">{campaign.daily_limit} DMs/day</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
               <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="text-destructive"
                 disabled={deleteMutation.isPending}
                 onClick={(e) => {
                   e.stopPropagation();
                   if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
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
               <Button 
                 onClick={(e) => {
                   e.stopPropagation();
                   activateMutation.mutate(campaign.id);
                 }} 
                 disabled={activateMutation.isPending}
                 size="sm"
               >
                 {activateMutation.isPending && activateMutation.variables === campaign.id ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                   <Play className="mr-2 h-4 w-4" />
                 )}
                 Run Now
               </Button>
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
  const { data: counts } = useQuery({
    queryKey: ['counts', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('daily_weekly_counts', { in_campaign_id: campaign.id });
      if (error) throw error;
      return data?.[0] || { daily: 0, weekly: 0 };
    },
    refetchInterval: 30000, // 30s
  });
  const pct = Math.min(100, ((counts?.daily || 0) / (campaign.daily_limit || 1)) * 100);
  return (
    <div className="space-y-1">
      <Progress value={pct} />
      <p className="text-xs text-muted-foreground text-right">
        {counts?.daily || 0}/{campaign.daily_limit} today
      </p>
    </div>
  );
};

// --- CampaignLogDialog -------------------------------------------
const CampaignLogDialog = ({ campaign, onClose }: { campaign: any, onClose: () => void }) => {
  const { data: invites } = useQuery({
    queryKey: ['invites', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, prospect_id, sent_at')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, prospect_id, sent_at, body')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign,
  });

  const rows = [
    ...(invites || []).map((row: any) => ({ ...row, type: 'Invite' })),
    ...(messages || []).map((row: any) => ({ ...row, type: 'Message' })),
  ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

  return (
    <Dialog open={!!campaign} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Activity – {campaign.name}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead className="w-[50%]">Body</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={`${r.type}-${r.id}`}>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.prospect_id}</TableCell>
                <TableCell>{new Date(r.sent_at).toLocaleString()}</TableCell>
                <TableCell className="truncate max-w-xs">{r.body || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignManager;
