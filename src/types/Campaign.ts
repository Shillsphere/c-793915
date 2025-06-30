import { Database } from '@/integrations/supabase/types';

export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];

// Also export other types that might be useful
export type Prospect = Database['public']['Tables']['prospects']['Row'];
export type ProspectInsert = Database['public']['Tables']['prospects']['Insert'];
export type ProspectUpdate = Database['public']['Tables']['prospects']['Update'];

export type UserBrowserbaseContext = Database['public']['Tables']['user_browserbase_contexts']['Row'];
export type UserBrowserbaseContextInsert = Database['public']['Tables']['user_browserbase_contexts']['Insert'];
export type UserBrowserbaseContextUpdate = Database['public']['Tables']['user_browserbase_contexts']['Update'];

export type Invite = Database['public']['Tables']['invites']['Row'];
export type Message = Database['public']['Tables']['messages']['Row']; 