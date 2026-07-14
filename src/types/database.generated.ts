export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          correlation_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          household_id: string | null
          id: string
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          household_id?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          household_id?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_registration_policy: {
        Row: {
          allow_test_emails: boolean
          bootstrap_email: string | null
          id: number
          mode: string
          test_email_domain: string
          updated_at: string
        }
        Insert: {
          allow_test_emails?: boolean
          bootstrap_email?: string | null
          id?: number
          mode?: string
          test_email_domain?: string
          updated_at?: string
        }
        Update: {
          allow_test_emails?: boolean
          bootstrap_email?: string | null
          id?: number
          mode?: string
          test_email_domain?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_adjustment_allocations: {
        Row: {
          adjustment_id: string
          amount_cents: number
          created_at: string
          expense_id: string
          fixed_cents: number | null
          household_id: string
          id: string
          membership_id: string
          percent_bps: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          adjustment_id: string
          amount_cents?: number
          created_at?: string
          expense_id: string
          fixed_cents?: number | null
          household_id: string
          id?: string
          membership_id: string
          percent_bps?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          adjustment_id?: string
          amount_cents?: number
          created_at?: string
          expense_id?: string
          fixed_cents?: number | null
          household_id?: string
          id?: string
          membership_id?: string
          percent_bps?: number | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_adjustment_allocations_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "expense_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_adjustment_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_adjustment_allocations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_adjustment_allocations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_adjustments: {
        Row: {
          adjustment_type: string
          allocation_mode: string
          amount_cents: number
          assigned_membership_id: string | null
          created_at: string
          description: string
          display_order: number
          expense_id: string
          household_id: string
          id: string
          updated_at: string
        }
        Insert: {
          adjustment_type: string
          allocation_mode: string
          amount_cents: number
          assigned_membership_id?: string | null
          created_at?: string
          description: string
          display_order?: number
          expense_id: string
          household_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          allocation_mode?: string
          amount_cents?: number
          assigned_membership_id?: string | null
          created_at?: string
          description?: string
          display_order?: number
          expense_id?: string
          household_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_adjustments_assigned_membership_id_fkey"
            columns: ["assigned_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_adjustments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_adjustments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_amendments: {
        Row: {
          amendment_expense_id: string
          confirmed_at: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          original_expense_id: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          amendment_expense_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          original_expense_id: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          amendment_expense_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          original_expense_id?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_amendments_amendment_expense_id_fkey"
            columns: ["amendment_expense_id"]
            isOneToOne: true
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_amendments_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_amendments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_amendments_original_expense_id_fkey"
            columns: ["original_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_item_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          expense_id: string
          fixed_cents: number | null
          household_id: string
          id: string
          item_id: string
          membership_id: string
          percent_bps: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          expense_id: string
          fixed_cents?: number | null
          household_id: string
          id?: string
          item_id: string
          membership_id: string
          percent_bps?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          expense_id?: string
          fixed_cents?: number | null
          household_id?: string
          id?: string
          item_id?: string
          membership_id?: string
          percent_bps?: number | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_item_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_item_allocations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_item_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_item_allocations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          allocation_mode: string
          classification: string | null
          created_at: string
          description: string
          display_order: number
          exclude_from_adjustment_basis: boolean
          expense_id: string
          household_id: string
          id: string
          personal_membership_id: string | null
          quantity_label: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          allocation_mode: string
          classification?: string | null
          created_at?: string
          description: string
          display_order?: number
          exclude_from_adjustment_basis?: boolean
          expense_id: string
          household_id: string
          id?: string
          personal_membership_id?: string | null
          quantity_label?: string | null
          total_cents: number
          updated_at?: string
        }
        Update: {
          allocation_mode?: string
          classification?: string | null
          created_at?: string
          description?: string
          display_order?: number
          exclude_from_adjustment_basis?: boolean
          expense_id?: string
          household_id?: string
          id?: string
          personal_membership_id?: string | null
          quantity_label?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_personal_membership_id_fkey"
            columns: ["personal_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          calculated_adjustments_cents: number
          calculated_subtotal_cents: number
          category: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description: string
          household_id: string
          id: string
          merchant: string
          payer_membership_id: string
          purchase_date: string
          status: string
          superseded_by_expense_id: string | null
          supersedes_expense_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          calculated_adjustments_cents?: number
          calculated_subtotal_cents?: number
          category?: string | null
          confirmation_idempotency_key?: string | null
          confirmed_at?: string | null
          confirmed_by_membership_id?: string | null
          created_at?: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description?: string
          household_id: string
          id?: string
          merchant?: string
          payer_membership_id: string
          purchase_date: string
          status?: string
          superseded_by_expense_id?: string | null
          supersedes_expense_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          calculated_adjustments_cents?: number
          calculated_subtotal_cents?: number
          category?: string | null
          confirmation_idempotency_key?: string | null
          confirmed_at?: string | null
          confirmed_by_membership_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          currency?: string
          declared_total_cents?: number
          description?: string
          household_id?: string
          id?: string
          merchant?: string
          payer_membership_id?: string
          purchase_date?: string
          status?: string
          superseded_by_expense_id?: string | null
          supersedes_expense_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_confirmed_by_membership_id_fkey"
            columns: ["confirmed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payer_membership_id_fkey"
            columns: ["payer_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_superseded_by_expense_id_fkey"
            columns: ["superseded_by_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supersedes_expense_id_fkey"
            columns: ["supersedes_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          household_id: string
          id: string
          intended_roles: string[]
          invited_by: string
          invited_email: string
          message: string | null
          revoked_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at: string
          household_id: string
          id?: string
          intended_roles?: string[]
          invited_by: string
          invited_email: string
          message?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          intended_roles?: string[]
          invited_by?: string
          invited_email?: string
          message?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_membership_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          membership_id: string
          role: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id: string
          role: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          membership_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_membership_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_memberships: {
        Row: {
          created_at: string
          household_id: string
          id: string
          joined_at: string
          left_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_settings: {
        Row: {
          approval_rule: string
          created_at: string
          household_id: string
          notification_defaults: Json
          purchase_approval_threshold_cents: number
          reimbursement_policy: string
          reimbursement_policy_acknowledged_at: string | null
          updated_at: string
        }
        Insert: {
          approval_rule?: string
          created_at?: string
          household_id: string
          notification_defaults?: Json
          purchase_approval_threshold_cents?: number
          reimbursement_policy?: string
          reimbursement_policy_acknowledged_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_rule?: string
          created_at?: string
          household_id?: string
          notification_defaults?: Json
          purchase_approval_threshold_cents?: number
          reimbursement_policy?: string
          reimbursement_policy_acknowledged_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          lease_end: string | null
          lease_start: string | null
          name: string
          property_nickname: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          name: string
          property_nickname?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          name?: string
          property_nickname?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          display_name: string | null
          email: string
          id: string
          onboarding_draft: Json
          onboarding_status: string
          preferred_locale: string
          preferred_timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email: string
          id: string
          onboarding_draft?: Json
          onboarding_status?: string
          preferred_locale?: string
          preferred_timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email?: string
          id?: string
          onboarding_draft?: Json
          onboarding_status?: string
          preferred_locale?: string
          preferred_timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reimbursement_obligations: {
        Row: {
          created_at: string
          creditor_membership_id: string
          current_amount_cents: number
          debtor_membership_id: string
          expense_id: string
          household_id: string
          id: string
          original_amount_cents: number
          reversed_by_obligation_id: string | null
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creditor_membership_id: string
          current_amount_cents: number
          debtor_membership_id: string
          expense_id: string
          household_id: string
          id?: string
          original_amount_cents: number
          reversed_by_obligation_id?: string | null
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creditor_membership_id?: string
          current_amount_cents?: number
          debtor_membership_id?: string
          expense_id?: string
          household_id?: string
          id?: string
          original_amount_cents?: number
          reversed_by_obligation_id?: string | null
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_obligations_creditor_membership_id_fkey"
            columns: ["creditor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_debtor_membership_id_fkey"
            columns: ["debtor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_reversed_by_obligation_id_fkey"
            columns: ["reversed_by_obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          current_household_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_household_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_household_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_current_household_id_fkey"
            columns: ["current_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _expense_audit: {
        Args: {
          p_after_state?: Json
          p_before_state?: Json
          p_correlation_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      accept_household_invitation: {
        Args: { p_token_hash: string }
        Returns: string
      }
      archive_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      can_confirm_or_void_expense: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_edit_expense_draft: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_view_expense: { Args: { p_expense_id: string }; Returns: boolean }
      change_membership_roles: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_roles: string[]
        }
        Returns: undefined
      }
      confirm_expense: {
        Args: {
          p_expense_id: string
          p_idempotency_key: string
          p_snapshot: Json
        }
        Returns: {
          calculated_adjustments_cents: number
          calculated_subtotal_cents: number
          category: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description: string
          household_id: string
          id: string
          merchant: string
          payer_membership_id: string
          purchase_date: string
          status: string
          superseded_by_expense_id: string | null
          supersedes_expense_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_expense_amendment: {
        Args: {
          p_amendment_expense_id: string
          p_idempotency_key: string
          p_snapshot: Json
        }
        Returns: {
          calculated_adjustments_cents: number
          calculated_subtotal_cents: number
          category: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description: string
          household_id: string
          id: string
          merchant: string
          payer_membership_id: string
          purchase_date: string
          status: string
          superseded_by_expense_id: string | null
          supersedes_expense_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense_amendment: {
        Args: { p_expense_id: string; p_reason: string }
        Returns: {
          calculated_adjustments_cents: number
          calculated_subtotal_cents: number
          category: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description: string
          household_id: string
          id: string
          merchant: string
          payer_membership_id: string
          purchase_date: string
          status: string
          superseded_by_expense_id: string | null
          supersedes_expense_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_household: {
        Args: {
          p_acknowledge_reimbursement_policy?: boolean
          p_currency?: string
          p_lease_end?: string
          p_lease_start?: string
          p_name: string
          p_property_nickname?: string
          p_purchase_approval_threshold_cents?: number
          p_timezone?: string
        }
        Returns: string
      }
      create_household_invitation: {
        Args: {
          p_email: string
          p_expires_at: string
          p_household_id: string
          p_intended_roles?: string[]
          p_message?: string
          p_token_hash: string
        }
        Returns: string
      }
      current_membership_id: {
        Args: { p_household_id: string }
        Returns: string
      }
      decline_household_invitation: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      ensure_profile: {
        Args: never
        Returns: {
          avatar_path: string | null
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          display_name: string | null
          email: string
          id: string
          onboarding_draft: Json
          onboarding_status: string
          preferred_locale: string
          preferred_timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation_preview: {
        Args: { p_token_hash: string }
        Returns: {
          expires_at: string
          household_name: string
          invited_email_domain: string
          property_nickname: string
          status: string
        }[]
      }
      has_responsibility: {
        Args: { p_household_id: string; p_roles: string[] }
        Returns: boolean
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_active_member: { Args: { p_household_id: string }; Returns: boolean }
      leave_household: {
        Args: { p_household_id: string; p_reason?: string }
        Returns: undefined
      }
      membership_belongs_to_household: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: boolean
      }
      remove_household_member: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      revoke_household_invitation: {
        Args: { p_household_id: string; p_invitation_id: string }
        Returns: undefined
      }
      set_current_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      void_expense: {
        Args: { p_expense_id: string; p_reason: string }
        Returns: {
          calculated_adjustments_cents: number
          calculated_subtotal_cents: number
          category: string | null
          confirmation_idempotency_key: string | null
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          declared_total_cents: number
          description: string
          household_id: string
          id: string
          merchant: string
          payer_membership_id: string
          purchase_date: string
          status: string
          superseded_by_expense_id: string | null
          supersedes_expense_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      write_audit_event: {
        Args: {
          p_after_state?: Json
          p_before_state?: Json
          p_correlation_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_reason?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
