import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare } from "lucide-react";
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
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0,0,0,0);

      const [{ count: invitesCount, error: invErr }, { count: repliesCount, error: repErr }] = await Promise.all([
        supabase.from('invites')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('sent_at', firstOfMonth.toISOString()),
        supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('sent_at', firstOfMonth.toISOString()),
      ]);
      if (invErr) throw invErr;
      if (repErr) throw repErr;
      return { connections_sent: invitesCount || 0, replies: repliesCount || 0 };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const statMappings = useMemo(() => ([
    { key: 'connections_sent', label: 'Connections Sent (Month)', icon: <Mail /> },
    { key: 'replies', label: 'Replies', icon: <MessageSquare /> },
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
          <StatCard key={s.key} title={s.label} value={stats ? stats[s.key] : '—'} icon={s.icon} />
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
