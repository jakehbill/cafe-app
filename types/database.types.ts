/**
 * Hand-maintained Supabase types for tables the app reads/writes directly.
 * Regenerate after running `supabase/migrations_manual/07_profiles_drop_legacy_taste.sql`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          username: string | null;
          avatar_url: string | null;
          email: string | null;
          current_city: string | null;
          is_digital_nomad: boolean | null;
          workspace_type_preferences: string[] | null;
          work_style: string | null;
          workspace_frustration: string | null;
          onboarding_completed: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          current_city?: string | null;
          is_digital_nomad?: boolean | null;
          workspace_type_preferences?: string[] | null;
          work_style?: string | null;
          workspace_frustration?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          current_city?: string | null;
          is_digital_nomad?: boolean | null;
          workspace_type_preferences?: string[] | null;
          work_style?: string | null;
          workspace_frustration?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
