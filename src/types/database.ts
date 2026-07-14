export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type HouseholdRole = "owner" | "admin" | "member";
export type MembershipStatus = "active" | "left" | "removed";
export type HouseholdStatus = "active" | "archived";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: HouseholdStatus;
          created_by: string;
          created_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: HouseholdStatus;
          created_by: string;
          created_at?: string;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          status?: HouseholdStatus;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      household_memberships: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          status: MembershipStatus;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          status?: MembershipStatus;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          role?: HouseholdRole;
          status?: MembershipStatus;
          left_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "household_memberships_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      household_invitations: {
        Row: {
          id: string;
          household_id: string;
          email: string;
          role: Exclude<HouseholdRole, "owner">;
          token_hash: string;
          status: InvitationStatus;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          email: string;
          role: Exclude<HouseholdRole, "owner">;
          token_hash: string;
          status?: InvitationStatus;
          invited_by: string;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: InvitationStatus;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_settings: {
        Row: {
          household_id: string;
          timezone: string;
          currency: string;
          display_name: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          timezone?: string;
          currency?: string;
          display_name: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          timezone?: string;
          currency?: string;
          display_name?: string;
          preferences?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_settings_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          household_id: string | null;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          before_state: Json | null;
          after_state: Json | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          actor_user_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          metadata?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: { p_name: string; p_slug: string; p_display_name: string };
        Returns: string;
      };
      accept_household_invitation: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      create_household_invitation: {
        Args: {
          p_household_id: string;
          p_email: string;
          p_role: string;
          p_token_hash: string;
          p_expires_at: string;
        };
        Returns: string;
      };
      get_invitation_preview: {
        Args: { p_token_hash: string };
        Returns: {
          invitation_id: string;
          household_id: string;
          household_name: string;
          email: string;
          role: string;
          status: string;
          expires_at: string;
        };
      };
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      has_household_role: {
        Args: { p_household_id: string; p_roles: string[] };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
