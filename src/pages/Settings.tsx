import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const LinkedinSettings = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'not_connected' | 'pending' | 'ready'>('loading');
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);

  const fetchContextStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_browserbase_contexts')
        .select('context_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setStatus(data?.context_id ? 'ready' : 'not_connected');
    } catch (error) {
      toast.error('Failed to fetch connection status.');
      setStatus('not_connected');
    }
  }, [user]);

  useEffect(() => {
    fetchContextStatus();
  }, [fetchContextStatus]);

  const handleCreateContext = async () => {
    if (!user) {
      toast.error("You must be logged in.");
      return;
    }
    setStatus('loading');
    
    try {
      const response = await fetch('/api/create-browserbase-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create context.');
      }

      const json = await response.json();

      if (!json.connectUrl || !json.contextId) throw new Error('Invalid response from server.');

      setConnectUrl(json.connectUrl);
      setContextId(json.contextId);
      setStatus('pending');
      toast.info("Please log in to your LinkedIn account below.");
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
      setStatus('not_connected');
    }
  };

  const handleConfirmLogin = async () => {
    if (!contextId || !user) return;

    const { error } = await supabase
      .from('user_browserbase_contexts')
      .update({ context_ready: true })
      .eq('user_id', user.id);
    
    if (error) {
      toast.error("Failed to save session. Please try again.");
    } else {
      setStatus('ready');
      setConnectUrl(null);
      toast.success("LinkedIn account connected successfully!");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and connections</p>
      </div>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>LinkedIn Connection</CardTitle>
          <CardDescription>Connect your LinkedIn account to enable automated messaging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border p-4 rounded-lg flex items-center justify-between">
            <div>
              <Label className="text-base">LinkedIn Session Status</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {status === 'ready' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'not_connected' && <XCircle className="h-4 w-4 text-red-500" />}
                {status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
                <span>
                  {{
                    'loading': 'Checking status...',
                    'not_connected': 'Not Connected',
                    'pending': 'Awaiting Login',
                    'ready': 'Connected & Ready'
                  }[status]}
                </span>
              </div>
            </div>
            {status === 'not_connected' && (
              <Button onClick={handleCreateContext}>
                Connect Account
              </Button>
            )}
          </div>
          {status === 'pending' && connectUrl && (
            <div className="space-y-4 pt-4">
              <Label className="font-bold">1. Log in to LinkedIn below</Label>
              <div className="w-full h-[500px] border rounded-lg overflow-hidden">
                 <iframe src={connectUrl} className="w-full h-full" title="LinkedIn Login" />
              </div>
              <Label className="font-bold">2. Click here to finalize</Label>
              <Button onClick={handleConfirmLogin} className="w-full">Confirm Login & Save Connection</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkedinSettings;
