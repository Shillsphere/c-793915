import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// UI components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Info } from "lucide-react";

const fetchContextStatus = async (userId: string) => {
  const { data } = await supabase
    .from('user_browserbase_contexts')
    .select('context_ready')
    .eq('user_id', userId)
    .single();
  return data?.context_ready || false;
};

export default function LinkedinSettings() {
  const { user } = useAuth();
  
  const { data: isReady, isLoading } = useQuery({
    queryKey: ['contextStatus', user?.id],
    queryFn: () => fetchContextStatus(user!.id),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p>Please log in to view LinkedIn settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              LinkedIn Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                  Checking connection status...
                  </AlertDescription>
                </Alert>
            ) : isReady ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                  ✅ Connected - Your LinkedIn account is ready for automation
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  ❌ Not Connected - Please contact support to set up your LinkedIn connection
                  </AlertDescription>
                </Alert>
            )}
                
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>How it works:</strong> Your LinkedIn connection is set up through a secure, 
                one-time administrative process to ensure maximum reliability and security.
                </p>
              <p>
                If you need to connect or reconnect your LinkedIn account, please contact our support team.
                </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 