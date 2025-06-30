import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Mail, MessageSquare, UserCheck } from "lucide-react";
import CampaignManager from './CampaignManager';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('get_all_campaign_stats_for_user', { in_user_id: user.id });
      if (error) throw error;
      return data?.[0] || { dms_sent: 0, replies: 0, acceptance_rate: 0, leads: 0 };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const statMappings = useMemo(() => ([
    { key: 'dms_sent', label: 'DMs Sent (Month)', icon: <Mail /> },
    { key: 'replies', label: 'Replies', icon: <MessageSquare /> },
    { key: 'acceptance_rate', label: 'Acceptance Rate', icon: <UserCheck /> },
    { key: 'leads', label: 'New Leads', icon: <BarChart3 /> },
  ]), []);

  // Activity feed: last 10 invites/messages
  const { data: feed } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      if (!user) return [];
      const [{ data: inv }, { data: msg }] = await Promise.all([
        supabase.from('invites').select('sent_at, prospect_id').eq('user_id', user.id).order('sent_at', { ascending: false }).limit(10),
        supabase.from('messages').select('sent_at, prospect_id, body').eq('user_id', user.id).order('sent_at', { ascending: false }).limit(10)
      ]);
      const rows = [
        ...(inv || []).map(r => ({ ...r, type: 'Invite' })),
        ...(msg || []).map(r => ({ ...r, type: 'Message' })),
      ];
      return rows.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()).slice(0, 10);
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your LinkedIn outreach at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statMappings.map(s => (
          <StatCard key={s.key} title={s.label} value={stats ? (s.key === 'acceptance_rate' ? `${stats[s.key]}%` : stats[s.key]) : '—'} icon={s.icon} />
        ))}
      </div>
      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feed || []).map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.prospect_id}</TableCell>
                  <TableCell>{new Date(row.sent_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div>
        <CampaignManager />
      </div>
    </div>
  );
};

export default Dashboard;
