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
      dispute_events: {
        Row: {
          actor_membership_id: string
          created_at: string
          dispute_id: string
          event_type: string
          household_id: string
          id: string
          note: string | null
        }
        Insert: {
          actor_membership_id: string
          created_at?: string
          dispute_id: string
          event_type: string
          household_id: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_membership_id?: string
          created_at?: string
          dispute_id?: string
          event_type?: string
          household_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_events_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
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
      notification_channel_preferences: {
        Row: {
          category: string
          channel: string
          delivery_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          delivery_mode: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          delivery_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempt_count: number
          available_at: string
          channel: string
          claim_expires_at: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          event_id: string
          failure_category: string | null
          failure_code: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          next_attempt_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
          user_notification_id: string | null
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          channel: string
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          event_id: string
          failure_category?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
          user_notification_id?: string | null
        }
        Update: {
          attempt_count?: number
          available_at?: string
          channel?: string
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          event_id?: string
          failure_category?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
          user_notification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscription_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_notification_id_fkey"
            columns: ["user_notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_digest_batches: {
        Row: {
          claim_expires_at: string | null
          claim_token: string | null
          created_at: string
          id: string
          idempotency_key: string
          period_end: string
          period_start: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          claim_expires_at?: string | null
          claim_token?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          claim_expires_at?: string | null
          claim_token?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_digest_items: {
        Row: {
          batch_id: string
          created_at: string
          delivery_id: string | null
          id: string
          user_notification_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          user_notification_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          user_notification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_digest_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "notification_digest_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "notification_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_items_user_notification_id_fkey"
            columns: ["user_notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_membership_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          household_id: string | null
          id: string
          idempotency_key: string
          payload: Json
        }
        Insert: {
          actor_membership_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          household_id?: string | null
          id?: string
          idempotency_key: string
          payload?: Json
        }
        Update: {
          actor_membership_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          household_id?: string | null
          id?: string
          idempotency_key?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_quiet_hours: {
        Row: {
          allow_urgent_override: boolean
          enabled: boolean
          end_local: string
          preview_mode: string
          start_local: string
          time_zone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_urgent_override?: boolean
          enabled?: boolean
          end_local?: string
          preview_mode?: string
          start_local?: string
          time_zone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_urgent_override?: boolean
          enabled?: boolean
          end_local?: string
          preview_mode?: string
          start_local?: string
          time_zone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          household_id: string
          id: string
          obligation_id: string
          payment_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          household_id: string
          id?: string
          obligation_id: string
          payment_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          household_id?: string
          id?: string
          obligation_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "payment_allocations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_private_details: {
        Row: {
          created_at: string
          external_reference: string | null
          household_id: string
          payment_id: string
          private_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_reference?: string | null
          household_id: string
          payment_id: string
          private_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_reference?: string | null
          household_id?: string
          payment_id?: string
          private_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_private_details_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_private_details_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reversals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          payment_id: string
          reason: string
          reversed_by_membership_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          payment_id: string
          reason: string
          reversed_by_membership_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          payment_id?: string
          reason?: string
          reversed_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reversals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reversals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reversals_reversed_by_membership_id_fkey"
            columns: ["reversed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          claimed_paid_at?: string | null
          client_idempotency_key: string
          confirmed_at?: string | null
          confirmed_by_membership_id?: string | null
          created_at?: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id?: string
          public_note?: string | null
          recipient_membership_id: string
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejection_reason?: string | null
          reversed_at?: string | null
          sender_membership_id: string
          status?: string
          submitted_at?: string | null
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          claimed_paid_at?: string | null
          client_idempotency_key?: string
          confirmed_at?: string | null
          confirmed_by_membership_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          currency?: string
          external_method?: string
          household_id?: string
          id?: string
          public_note?: string | null
          recipient_membership_id?: string
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejection_reason?: string | null
          reversed_at?: string | null
          sender_membership_id?: string
          status?: string
          submitted_at?: string | null
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cancelled_by_membership_id_fkey"
            columns: ["cancelled_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_confirmed_by_membership_id_fkey"
            columns: ["confirmed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recipient_membership_id_fkey"
            columns: ["recipient_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rejected_by_membership_id_fkey"
            columns: ["rejected_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sender_membership_id_fkey"
            columns: ["sender_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
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
      push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          created_at: string
          device_label: string | null
          disabled_reason: string | null
          endpoint: string
          endpoint_hash: string
          expiration_time: string | null
          failure_count: number
          id: string
          installation_id: string | null
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          platform_category: string | null
          updated_at: string
          user_agent_summary: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth: string
          created_at?: string
          device_label?: string | null
          disabled_reason?: string | null
          endpoint: string
          endpoint_hash: string
          expiration_time?: string | null
          failure_count?: number
          id?: string
          installation_id?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          platform_category?: string | null
          updated_at?: string
          user_agent_summary?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth?: string
          created_at?: string
          device_label?: string | null
          disabled_reason?: string | null
          endpoint?: string
          endpoint_hash?: string
          expiration_time?: string | null
          failure_count?: number
          id?: string
          installation_id?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          platform_category?: string | null
          updated_at?: string
          user_agent_summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reimbursement_disputes: {
        Row: {
          created_at: string
          dispute_type: string
          expense_id: string | null
          household_id: string
          id: string
          obligation_id: string | null
          payment_id: string | null
          raised_by_membership_id: string
          reason: string
          related_corrective_entity_id: string | null
          related_corrective_entity_type: string | null
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispute_type: string
          expense_id?: string | null
          household_id: string
          id?: string
          obligation_id?: string | null
          payment_id?: string | null
          raised_by_membership_id: string
          reason: string
          related_corrective_entity_id?: string | null
          related_corrective_entity_type?: string | null
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispute_type?: string
          expense_id?: string | null
          household_id?: string
          id?: string
          obligation_id?: string | null
          payment_id?: string | null
          raised_by_membership_id?: string
          reason?: string
          related_corrective_entity_id?: string | null
          related_corrective_entity_type?: string | null
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_disputes_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_raised_by_membership_id_fkey"
            columns: ["raised_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_disputes_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
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
          obligation_kind: string
          original_amount_cents: number
          reversed_by_obligation_id: string | null
          settled_at: string | null
          source_expense_amendment_id: string | null
          source_obligation_id: string | null
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
          obligation_kind?: string
          original_amount_cents: number
          reversed_by_obligation_id?: string | null
          settled_at?: string | null
          source_expense_amendment_id?: string | null
          source_obligation_id?: string | null
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
          obligation_kind?: string
          original_amount_cents?: number
          reversed_by_obligation_id?: string | null
          settled_at?: string | null
          source_expense_amendment_id?: string | null
          source_obligation_id?: string | null
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
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_reversed_by_obligation_id_fkey"
            columns: ["reversed_by_obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_source_expense_amendment_id_fkey"
            columns: ["source_expense_amendment_id"]
            isOneToOne: false
            referencedRelation: "expense_amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_source_obligation_id_fkey"
            columns: ["source_obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "reimbursement_obligations_source_obligation_id_fkey"
            columns: ["source_obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_waiver_reversals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          reason: string
          reversed_by_membership_id: string
          waiver_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          reason: string
          reversed_by_membership_id: string
          waiver_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          reason?: string
          reversed_by_membership_id?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_waiver_reversals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_waiver_reversals_reversed_by_membership_id_fkey"
            columns: ["reversed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_waiver_reversals_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: true
            referencedRelation: "reimbursement_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_waivers: {
        Row: {
          amount_cents: number
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          obligation_id: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          obligation_id: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          obligation_id?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_waivers_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_waivers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_waivers_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "reimbursement_waivers_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notification_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          notification_event_id: string | null
          payload: Json
          processed_at: string | null
          recipient_user_id: string
          scheduled_at: string
          source_id: string
          source_type: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          notification_event_id?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_user_id: string
          scheduled_at: string
          source_id: string
          source_type: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          notification_event_id?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_user_id?: string
          scheduled_at?: string
          source_id?: string
          source_type?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notification_requests_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          action_href: string | null
          action_oriented: boolean
          body: string
          category: string | null
          created_at: string
          event_id: string
          household_id: string | null
          id: string
          privacy_class: string
          read_at: string | null
          title: string
          urgency: string
          user_id: string
        }
        Insert: {
          action_href?: string | null
          action_oriented?: boolean
          body?: string
          category?: string | null
          created_at?: string
          event_id: string
          household_id?: string | null
          id?: string
          privacy_class?: string
          read_at?: string | null
          title: string
          urgency?: string
          user_id: string
        }
        Update: {
          action_href?: string | null
          action_oriented?: boolean
          body?: string
          category?: string | null
          created_at?: string
          event_id?: string
          household_id?: string | null
          id?: string
          privacy_class?: string
          read_at?: string | null
          title?: string
          urgency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          current_household_id: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_household_id?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_household_id?: string | null
          theme?: string
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
      obligation_balances_v: {
        Row: {
          confirmed_paid_cents: number | null
          created_at: string | null
          creditor_membership_id: string | null
          debtor_membership_id: string | null
          effective_amount_cents: number | null
          expense_id: string | null
          household_id: string | null
          obligation_id: string | null
          obligation_kind: string | null
          official_outstanding_cents: number | null
          original_amount_cents: number | null
          pending_payment_cents: number | null
          projected_outstanding_cents: number | null
          settlement_state: string | null
          stored_status: string | null
          updated_at: string | null
          waived_cents: number | null
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
        ]
      }
      push_subscription_devices: {
        Row: {
          active: boolean | null
          created_at: string | null
          device_label: string | null
          disabled_reason: string | null
          failure_count: number | null
          id: string | null
          installation_id: string | null
          last_success_at: string | null
          platform_category: string | null
          updated_at: string | null
          user_agent_summary: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          device_label?: string | null
          disabled_reason?: string | null
          failure_count?: number | null
          id?: string | null
          installation_id?: string | null
          last_success_at?: string | null
          platform_category?: string | null
          updated_at?: string | null
          user_agent_summary?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          device_label?: string | null
          disabled_reason?: string | null
          failure_count?: number | null
          id?: string | null
          installation_id?: string | null
          last_success_at?: string | null
          platform_category?: string | null
          updated_at?: string | null
          user_agent_summary?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _allow_privileged_mutation: { Args: never; Returns: boolean }
      _blocking_submitted_payment_id: {
        Args: { p_expense_id: string }
        Returns: string
      }
      _cancel_scheduled_notification_request: {
        Args: { p_idempotency_key: string }
        Returns: boolean
      }
      _create_refund_obligation: {
        Args: {
          p_amendment_id: string
          p_amount_cents: number
          p_corr: string
          p_expense_id: string
          p_household_id: string
          p_original_creditor: string
          p_original_debtor: string
          p_source_obligation_id: string
        }
        Returns: string
      }
      _create_scheduled_notification_request: {
        Args: {
          p_event_type: string
          p_idempotency_key: string
          p_payload?: Json
          p_recipient_user_id: string
          p_scheduled_at: string
          p_source_id: string
          p_source_type: string
          p_time_zone: string
        }
        Returns: string
      }
      _emit_notification_event: {
        Args: {
          p_action_href?: string
          p_actor_membership_id: string
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_idempotency_key: string
          p_payload: Json
          p_recipient_user_ids: string[]
          p_title: string
        }
        Returns: string
      }
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
      _membership_user_id: {
        Args: { p_membership_id: string }
        Returns: string
      }
      _notification_meta_for_event_type: {
        Args: { p_event_type: string }
        Returns: {
          action_oriented: boolean
          category: string
          urgency: string
        }[]
      }
      _official_outstanding_cents: {
        Args: { p_obligation_id: string }
        Returns: number
      }
      _payment_audit: {
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
      _quiet_hours_available_at: {
        Args: { p_now?: string; p_urgency: string; p_user_id: string }
        Returns: string
      }
      _raise_if_submitted_payments: {
        Args: { p_expense_id: string }
        Returns: undefined
      }
      _sanitize_delivery_error: { Args: { p_error: string }; Returns: string }
      _sync_obligation_settlement_status: {
        Args: { p_obligation_id: string }
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
      cancel_payment: {
        Args: { p_payment_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_membership_roles: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_roles: string[]
        }
        Returns: undefined
      }
      claim_notification_deliveries: {
        Args: {
          p_batch_size?: number
          p_claim_ttl_seconds?: number
          p_worker_id?: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          channel: string
          claim_expires_at: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          event_id: string
          failure_category: string | null
          failure_code: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          next_attempt_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
          user_notification_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_test_household_data: {
        Args: { p_test_run_id: string }
        Returns: number
      }
      complete_notification_delivery: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_provider_message_id?: string
          p_subscription_id?: string
        }
        Returns: boolean
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
      confirm_payment: {
        Args: { p_payment_id: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
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
      create_household_for_current_user: {
        Args: {
          p_acknowledge_reimbursement_policy?: boolean
          p_currency?: string
          p_idempotency_key?: string
          p_lease_end?: string
          p_lease_start?: string
          p_name: string
          p_property_nickname?: string
          p_purchase_approval_threshold_cents?: number
          p_timezone?: string
        }
        Returns: {
          household_id: string
          membership_id: string
        }[]
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
      create_reimbursement_waiver: {
        Args: {
          p_amount_cents: number
          p_obligation_id: string
          p_reason: string
        }
        Returns: {
          amount_cents: number
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          obligation_id: string
          reason: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_waivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_membership_id: {
        Args: { p_household_id: string }
        Returns: string
      }
      deactivate_push_subscription: {
        Args: { p_endpoint_hash?: string; p_subscription_id?: string }
        Returns: boolean
      }
      decline_household_invitation: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      enqueue_test_notification: { Args: never; Returns: string }
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
      fail_notification_delivery: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_failure_category?: string
          p_failure_code: string
          p_last_error?: string
          p_retry?: boolean
          p_retry_delay_seconds?: number
          p_subscription_id?: string
        }
        Returns: boolean
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
      get_notification_delivery_mode: {
        Args: { p_category: string; p_channel: string; p_user_id: string }
        Returns: string
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
      mark_all_notifications_read: {
        Args: { p_household_id?: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_unread: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      membership_belongs_to_household: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: boolean
      }
      obligation_confirmed_paid_inline: {
        Args: { p_obligation_id: string }
        Returns: number
      }
      obligation_waived_cents_inline: {
        Args: { p_obligation_id: string }
        Returns: number
      }
      open_dispute: {
        Args: {
          p_dispute_type: string
          p_expense_id?: string
          p_household_id: string
          p_obligation_id?: string
          p_payment_id?: string
          p_reason: string
        }
        Returns: {
          created_at: string
          dispute_type: string
          expense_id: string | null
          household_id: string
          id: string
          obligation_id: string | null
          payment_id: string | null
          raised_by_membership_id: string
          reason: string
          related_corrective_entity_id: string | null
          related_corrective_entity_type: string | null
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_due_scheduled_notifications: {
        Args: { p_limit?: number }
        Returns: number
      }
      reject_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_household_member: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      resolve_dispute: {
        Args: {
          p_dispute_id: string
          p_related_corrective_entity_id?: string
          p_related_corrective_entity_type?: string
          p_resolution_note: string
          p_resolution_type: string
        }
        Returns: {
          created_at: string
          dispute_type: string
          expense_id: string | null
          household_id: string
          id: string
          obligation_id: string | null
          payment_id: string | null
          raised_by_membership_id: string
          reason: string
          related_corrective_entity_id: string | null
          related_corrective_entity_type: string | null
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_reimbursement_waiver: {
        Args: { p_reason: string; p_waiver_id: string }
        Returns: {
          amount_cents: number
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          obligation_id: string
          reason: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_waivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_household_invitation: {
        Args: { p_household_id: string; p_invitation_id: string }
        Returns: undefined
      }
      set_current_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      submit_payment: {
        Args: {
          p_allocations: Json
          p_claimed_paid_at?: string
          p_external_method: string
          p_external_reference?: string
          p_household_id: string
          p_idempotency_key: string
          p_private_note?: string
          p_public_note?: string
          p_recipient_membership_id: string
          p_total_amount_cents: number
        }
        Returns: {
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          claimed_paid_at: string | null
          client_idempotency_key: string
          confirmed_at: string | null
          confirmed_by_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          external_method: string
          household_id: string
          id: string
          public_note: string | null
          recipient_membership_id: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_reason: string | null
          reversed_at: string | null
          sender_membership_id: string
          status: string
          submitted_at: string | null
          total_amount_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_notification_preference: {
        Args: { p_category: string; p_channel: string; p_delivery_mode: string }
        Returns: undefined
      }
      upsert_push_subscription: {
        Args: {
          p_auth: string
          p_device_label?: string
          p_endpoint: string
          p_expiration_time?: string
          p_installation_id?: string
          p_p256dh: string
          p_platform_category?: string
          p_user_agent_summary?: string
        }
        Returns: string
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
      withdraw_dispute: {
        Args: { p_dispute_id: string }
        Returns: {
          created_at: string
          dispute_type: string
          expense_id: string | null
          household_id: string
          id: string
          obligation_id: string | null
          payment_id: string | null
          raised_by_membership_id: string
          reason: string
          related_corrective_entity_id: string | null
          related_corrective_entity_type: string | null
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_disputes"
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
