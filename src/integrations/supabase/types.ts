export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: {
          campaign_name: string | null
          created_at: string | null
          cta_mode: string | null
          daily_limit: number | null
          id: number
          keywords: string | null
          search_page: number
          status: string | null
          targeting_criteria: Json | null
          template: string | null
          updated_at: string | null
          user_id: string | null
          weekly_limit: number | null
          daily_sent: number | null
          total_sent: number | null
          last_run_date: string | null
          next_run_date: string | null
          is_active: boolean | null
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string | null
          cta_mode?: string | null
          daily_limit?: number | null
          id?: never
          keywords?: string | null
          search_page?: number
          status?: string | null
          targeting_criteria?: Json | null
          template?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_limit?: number | null
          daily_sent?: number | null
          total_sent?: number | null
          last_run_date?: string | null
          next_run_date?: string | null
          is_active?: boolean | null
        }
        Update: {
          campaign_name?: string | null
          created_at?: string | null
          cta_mode?: string | null
          daily_limit?: number | null
          id?: never
          keywords?: string | null
          search_page?: number
          status?: string | null
          targeting_criteria?: Json | null
          template?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_limit?: number | null
          daily_sent?: number | null
          total_sent?: number | null
          last_run_date?: string | null
          next_run_date?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          campaign_id: number | null
          id: string
          note: string | null
          prospect_id: string | null
          prospect_linkedin_id: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: number | null
          id?: string
          note?: string | null
          prospect_id?: string | null
          prospect_linkedin_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: number | null
          id?: string
          note?: string | null
          prospect_id?: string | null
          prospect_linkedin_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          campaign_id: number | null
          created_at: string | null
          details: string | null
          id: number
          status: string | null
        }
        Insert: {
          campaign_id?: number | null
          created_at?: string | null
          details?: string | null
          id?: number
          status?: string | null
        }
        Update: {
          campaign_id?: number | null
          created_at?: string | null
          details?: string | null
          id?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          campaign_id: number | null
          cta_type: string | null
          id: string
          prospect_id: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          campaign_id?: number | null
          cta_type?: string | null
          id?: string
          prospect_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: number | null
          cta_type?: string | null
          id?: string
          prospect_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          slack_webhook_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          slack_webhook_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          slack_webhook_url?: string | null
        }
        Relationships: []
      }
      prospects: {
        Row: {
          campaign_id: number | null
          created_at: string | null
          first_name: string | null
          headline: string | null
          id: string
          profile_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: number | null
          created_at?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string
          profile_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: number | null
          created_at?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string
          profile_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_browserbase_contexts: {
        Row: {
          context_id: string | null
          context_ready: boolean | null
          created_at: string | null
          latest_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_ready?: boolean | null
          created_at?: string | null
          latest_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_ready?: boolean | null
          created_at?: string | null
          latest_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          approved: boolean | null
          created_at: string | null
          email: string
          id: string
          referred_by: string | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          referred_by?: string | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          referred_by?: string | null
        }
        Relationships: []
      }
      waitlist_applications: {
        Row: {
          created_at: string
          email: string
          id: string
          linkedin: string
          name: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          linkedin: string
          name: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          linkedin?: string
          name?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      daily_weekly_counts: {
        Args: { in_campaign_id: number }
        Returns: {
          daily: number
          weekly: number
        }[]
      }
      get_all_campaign_stats_for_user: {
        Args: { in_user_id: string }
        Returns: {
          dms_sent: number
          replies: number
          acceptance_rate: number
          leads: number
        }[]
      }
      is_user_accepted_on_waitlist: {
        Args: { user_email: string }
        Returns: boolean
      }
    }
    Enums: {
      waitlist_status: "pending" | "accepted" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      waitlist_status: ["pending", "accepted", "rejected"],
    },
  },
} as const
