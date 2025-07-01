import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

// Helper to get connection status from DB
const fetchContextStatus = async (userId: string | undefined) => {
  if (!userId) return null;
  const { data } = await supabase
    .from("user_browserbase_contexts")
    .select("context_ready")
    .eq("user_id", userId)
    .single();
  return data;
};

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Live view url while user is logging in
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);

  // Current connection status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["contextStatus", user?.id],
    queryFn: () => fetchContextStatus(user?.id),
    enabled: !!user,
  });

  const isReady = statusData?.context_ready === true;

  /* ---------------- Mutations ---------------- */
  // Start a new login session
  const { mutate: startConnection, isPending: isCreating } = useMutation({
    mutationFn: () =>
      supabase.functions.invoke("create-context-session", {
        body: { user_id: user!.id },
      }),
    onSuccess: (res) => {
      if (res.error) throw new Error(res.error.message);
      setLiveViewUrl(res.data.liveViewUrl as string);
      queryClient.invalidateQueries({ queryKey: ["contextStatus", user?.id] });
    },
    onError: (err: any) => toast.error(`Failed to start connection: ${err.message}`),
  });

  // Finalize once user has logged in
  const { mutate: finalizeConnection, isPending: isConfirming } = useMutation({
    mutationFn: () =>
      supabase.functions.invoke("finalize-context-session", {
        body: { user_id: user!.id },
      }),
    onSuccess: () => {
      toast.success("LinkedIn account connected successfully!");
      setLiveViewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["contextStatus", user?.id] });
    },
    onError: (err: any) => toast.error(`Failed to finalize session: ${err.message}`),
  });

  const copyUrl = () => {
    if (liveViewUrl) {
      navigator.clipboard.writeText(liveViewUrl);
      toast.success("Login URL copied to clipboard!");
    }
  };

  const LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login";

  /* ---------------- Render ---------------- */
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto pt-36 flex items-center gap-2">
        <Loader2 className="animate-spin" /> Loading settings...
      </div>
    );
    }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-36 pb-16">
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn Connection</CardTitle>
          <CardDescription>
            Connect or manage your LinkedIn account for automated campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Row */}
          <div className="border p-4 rounded-lg flex items-center justify-between">
            <p className="font-medium">Session Status</p>
            {isReady ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle size={16} /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle size={16} /> Not Connected
            </div>
            )}
          </div>
          
          {/* STATE: Not connected, idle */}
          {!isReady && !liveViewUrl && (
            <Button
              onClick={() => startConnection()}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating secure session...
                </>
              ) : (
                "Connect Account"
          )}
            </Button>
          )}

          {/* STATE: Awaiting login */}
          {!isReady && liveViewUrl && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle className="font-bold">Action Required</AlertTitle>
                <AlertDescription>
                  Log in to LinkedIn below, then click "Finalize Connection".
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={liveViewUrl!} readOnly className="flex-1" />
                  <Button variant="outline" size="icon" onClick={copyUrl}>
                    <Copy size={16} />
                </Button>
                  <Button variant="secondary" onClick={() => window.open(liveViewUrl!, "_blank")}>Open in New Tab</Button>
              </div>
                <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gray-100">
                  <iframe
                    src={liveViewUrl}
                    className="w-full h-full"
                    title="Browserbase Live View"
                    sandbox="allow-same-origin allow-scripts"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
                {/* Provide direct LinkedIn login URL for copy/paste convenience */}
                <div className="flex items-center gap-2">
                  <Input value={LINKEDIN_LOGIN_URL} readOnly className="flex-1" />
                  <Button variant="outline" size="icon" onClick={() => {navigator.clipboard.writeText(LINKEDIN_LOGIN_URL); toast.success("LinkedIn login URL copied!");}}>
                    <Copy size={16} />
                    </Button>
                  <Button variant="secondary" onClick={() => window.open(LINKEDIN_LOGIN_URL, "_blank")}>Open linkedin.com/login</Button>
                </div>
                  </div>

              <Button
                onClick={() => finalizeConnection()}
                disabled={isConfirming}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...
                  </>
                ) : (
                  "✅ I've Logged In, Finalize Connection"
                )}
              </Button>
            </div>
          )}

          {/* STATE: Connected */}
          {isReady && (
            <Button
              onClick={() => startConnection()}
              variant="outline"
              className="w-full"
            >
              Reconnect Account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
