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
      calendar_event_attendees: {
        Row: {
          created_at: string
          event_id: string
          guest_count: number
          guest_note: string | null
          household_id: string
          id: string
          membership_id: string
          participation_role: string
          responded_at: string | null
          rsvp_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_count?: number
          guest_note?: string | null
          household_id: string
          id?: string
          membership_id: string
          participation_role?: string
          responded_at?: string | null
          rsvp_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_count?: number
          guest_note?: string | null
          household_id?: string
          id?: string
          membership_id?: string
          participation_role?: string
          responded_at?: string | null
          rsvp_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_attendees_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_attendees_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_attendees_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_exception_attendees: {
        Row: {
          created_at: string
          event_id: string
          exception_id: string
          guest_count: number
          guest_note: string | null
          household_id: string
          id: string
          membership_id: string
          participation_role: string
          rsvp_status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          exception_id: string
          guest_count?: number
          guest_note?: string | null
          household_id: string
          id?: string
          membership_id: string
          participation_role?: string
          rsvp_status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          exception_id?: string
          guest_count?: number
          guest_note?: string | null
          household_id?: string
          id?: string
          membership_id?: string
          participation_role?: string
          rsvp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_exception_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exception_attendees_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_exception_attendees_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "calendar_event_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exception_attendees_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exception_attendees_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_exception_reminders: {
        Row: {
          created_at: string
          event_id: string
          exception_id: string
          household_id: string
          id: string
          offset_minutes: number
          recipient_groups: string[]
        }
        Insert: {
          created_at?: string
          event_id: string
          exception_id: string
          household_id: string
          id?: string
          offset_minutes: number
          recipient_groups?: string[]
        }
        Update: {
          created_at?: string
          event_id?: string
          exception_id?: string
          household_id?: string
          id?: string
          offset_minutes?: number
          recipient_groups?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_exception_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exception_reminders_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_exception_reminders_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "calendar_event_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exception_reminders_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_exceptions: {
        Row: {
          all_day: boolean | null
          created_at: string
          created_by_membership_id: string
          description: string | null
          end_date_exclusive: string | null
          ends_at: string | null
          event_guest_count: number | null
          event_id: string
          guest_label: string | null
          household_id: string
          id: string
          kind: string
          location: string | null
          original_starts_at: string
          overrides_attendees: boolean
          overrides_reminders: boolean
          start_date: string | null
          starts_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number | null
          event_id: string
          guest_label?: string | null
          household_id: string
          id?: string
          kind: string
          location?: string | null
          original_starts_at: string
          overrides_attendees?: boolean
          overrides_reminders?: boolean
          start_date?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean | null
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number | null
          event_id?: string
          guest_label?: string | null
          household_id?: string
          id?: string
          kind?: string
          location?: string | null
          original_starts_at?: string
          overrides_attendees?: boolean
          overrides_reminders?: boolean
          start_date?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_exceptions_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exceptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_exceptions_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_exceptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_occurrences: {
        Row: {
          all_day: boolean
          created_at: string
          end_date_exclusive: string | null
          ends_at: string
          event_id: string
          exception_id: string | null
          household_id: string
          id: string
          is_cancelled: boolean
          original_starts_at: string
          start_date: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          end_date_exclusive?: string | null
          ends_at: string
          event_id: string
          exception_id?: string | null
          household_id: string
          id?: string
          is_cancelled?: boolean
          original_starts_at: string
          start_date?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          end_date_exclusive?: string | null
          ends_at?: string
          event_id?: string
          exception_id?: string | null
          household_id?: string
          id?: string
          is_cancelled?: boolean
          original_starts_at?: string
          start_date?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_occurrences_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_occurrences_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "calendar_event_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_occurrences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_reminders: {
        Row: {
          created_at: string
          event_id: string
          household_id: string
          id: string
          offset_minutes: number
          recipient_groups: string[]
        }
        Insert: {
          created_at?: string
          event_id: string
          household_id: string
          id?: string
          offset_minutes: number
          recipient_groups?: string[]
        }
        Update: {
          created_at?: string
          event_id?: string
          household_id?: string
          id?: string
          offset_minutes?: number
          recipient_groups?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_reminders_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_reminders_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          calendar_uid: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          category: string
          client_idempotency_key: string
          created_at: string
          description: string | null
          end_date_exclusive: string | null
          ends_at: string | null
          event_guest_count: number
          guest_label: string | null
          household_id: string
          id: string
          location: string | null
          materialized_through: string | null
          organizer_membership_id: string
          recurrence_count: number | null
          recurrence_until: string | null
          rrule: string | null
          sequence: number
          series_id: string
          source_id: string | null
          source_type: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          time_zone: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          all_day?: boolean
          calendar_uid: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          category?: string
          client_idempotency_key: string
          created_at?: string
          description?: string | null
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number
          guest_label?: string | null
          household_id: string
          id?: string
          location?: string | null
          materialized_through?: string | null
          organizer_membership_id: string
          recurrence_count?: number | null
          recurrence_until?: string | null
          rrule?: string | null
          sequence?: number
          series_id?: string
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          time_zone?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          all_day?: boolean
          calendar_uid?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          category?: string
          client_idempotency_key?: string
          created_at?: string
          description?: string | null
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number
          guest_label?: string | null
          household_id?: string
          id?: string
          location?: string | null
          materialized_through?: string | null
          organizer_membership_id?: string
          recurrence_count?: number | null
          recurrence_until?: string | null
          rrule?: string | null
          sequence?: number
          series_id?: string
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          time_zone?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_cancelled_by_membership_id_fkey"
            columns: ["cancelled_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organizer_membership_id_fkey"
            columns: ["organizer_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feed_tokens: {
        Row: {
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          household_id: string
          id: string
          label: string
          last_accessed_at: string | null
          revoked_at: string | null
          scope: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          household_id: string
          id?: string
          label?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          label?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feed_tokens_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          created_at: string
          household_id: string
          id: string
          membership_id: string
          occurrence_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
          occurrence_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          occurrence_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_assignments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_assignments_occurrence_id_household_id_fkey"
            columns: ["occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      chore_completion_records: {
        Row: {
          completed_by_membership_id: string
          completion_note: string | null
          created_at: string
          household_id: string
          id: string
          occurrence_id: string
          reopen_reason: string | null
          status: string
          submitted_at: string
          verified_at: string | null
          verified_by_membership_id: string | null
          version: number
        }
        Insert: {
          completed_by_membership_id: string
          completion_note?: string | null
          created_at?: string
          household_id: string
          id?: string
          occurrence_id: string
          reopen_reason?: string | null
          status?: string
          submitted_at?: string
          verified_at?: string | null
          verified_by_membership_id?: string | null
          version?: number
        }
        Update: {
          completed_by_membership_id?: string
          completion_note?: string | null
          created_at?: string
          household_id?: string
          id?: string
          occurrence_id?: string
          reopen_reason?: string | null
          status?: string
          submitted_at?: string
          verified_at?: string | null
          verified_by_membership_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "chore_completion_records_completed_by_membership_id_fkey"
            columns: ["completed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completion_records_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completion_records_occurrence_id_household_id_fkey"
            columns: ["occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_completion_records_verified_by_membership_id_fkey"
            columns: ["verified_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_definitions: {
        Row: {
          all_day: boolean
          calendar_category: string
          category: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          due_time_minutes: number | null
          end_date: string | null
          ended_at: string | null
          escalation_coordinator: boolean
          grace_period_minutes: number
          household_id: string
          id: string
          materialized_through: string | null
          paused_at: string | null
          recurrence_count: number | null
          reminder_offsets: number[]
          requires_verification: boolean
          responsibility_area_id: string | null
          rotation_id: string | null
          rrule: string | null
          show_on_calendar: boolean
          start_date: string
          status: string
          time_zone: string
          title: string
          updated_at: string
          verifier_membership_id: string | null
          visibility: string
        }
        Insert: {
          all_day?: boolean
          calendar_category?: string
          category: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          due_time_minutes?: number | null
          end_date?: string | null
          ended_at?: string | null
          escalation_coordinator?: boolean
          grace_period_minutes?: number
          household_id: string
          id?: string
          materialized_through?: string | null
          paused_at?: string | null
          recurrence_count?: number | null
          reminder_offsets?: number[]
          requires_verification?: boolean
          responsibility_area_id?: string | null
          rotation_id?: string | null
          rrule?: string | null
          show_on_calendar?: boolean
          start_date: string
          status?: string
          time_zone?: string
          title: string
          updated_at?: string
          verifier_membership_id?: string | null
          visibility?: string
        }
        Update: {
          all_day?: boolean
          calendar_category?: string
          category?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          due_time_minutes?: number | null
          end_date?: string | null
          ended_at?: string | null
          escalation_coordinator?: boolean
          grace_period_minutes?: number
          household_id?: string
          id?: string
          materialized_through?: string | null
          paused_at?: string | null
          recurrence_count?: number | null
          reminder_offsets?: number[]
          requires_verification?: boolean
          responsibility_area_id?: string | null
          rotation_id?: string | null
          rrule?: string | null
          show_on_calendar?: boolean
          start_date?: string
          status?: string
          time_zone?: string
          title?: string
          updated_at?: string
          verifier_membership_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_definitions_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_definitions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_definitions_responsibility_area_id_household_id_fkey"
            columns: ["responsibility_area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_definitions_rotation_id_household_id_fkey"
            columns: ["rotation_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_rotations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_definitions_verifier_membership_id_fkey"
            columns: ["verifier_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_occurrences: {
        Row: {
          all_day: boolean
          assignment_version: number
          blocked_note: string | null
          blocked_reason: string | null
          calendar_event_id: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          definition_id: string
          due_at: string
          due_date: string | null
          grace_ends_at: string | null
          household_id: string
          id: string
          occurrence_index: number
          original_due_at: string
          reopen_reason: string | null
          skip_reason: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assignment_version?: number
          blocked_note?: string | null
          blocked_reason?: string | null
          calendar_event_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          definition_id: string
          due_at: string
          due_date?: string | null
          grace_ends_at?: string | null
          household_id: string
          id?: string
          occurrence_index: number
          original_due_at: string
          reopen_reason?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assignment_version?: number
          blocked_note?: string | null
          blocked_reason?: string | null
          calendar_event_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          definition_id?: string
          due_at?: string
          due_date?: string | null
          grace_ends_at?: string | null
          household_id?: string
          id?: string
          occurrence_index?: number
          original_due_at?: string
          reopen_reason?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_occurrences_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_occurrences_definition_id_household_id_fkey"
            columns: ["definition_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_definitions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_occurrences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_reassignment_requests: {
        Row: {
          created_at: string
          household_id: string
          id: string
          occurrence_id: string
          reason: string
          requested_by_membership_id: string
          requested_effective_at: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          suggested_membership_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          occurrence_id: string
          reason: string
          requested_by_membership_id: string
          requested_effective_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          suggested_membership_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          occurrence_id?: string
          reason?: string
          requested_by_membership_id?: string
          requested_effective_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          suggested_membership_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_reassignment_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_reassignment_requests_occurrence_id_household_id_fkey"
            columns: ["occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_reassignment_requests_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_reassignment_requests_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_reassignment_requests_suggested_membership_id_fkey"
            columns: ["suggested_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_rotation_members: {
        Row: {
          created_at: string
          excluded_until: string | null
          household_id: string
          id: string
          membership_id: string
          rotation_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          excluded_until?: string | null
          household_id: string
          id?: string
          membership_id: string
          rotation_id: string
          sort_order: number
        }
        Update: {
          created_at?: string
          excluded_until?: string | null
          household_id?: string
          id?: string
          membership_id?: string
          rotation_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "chore_rotation_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_rotation_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_rotation_members_rotation_id_household_id_fkey"
            columns: ["rotation_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_rotations"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      chore_rotations: {
        Row: {
          created_at: string
          created_by_membership_id: string
          ended_at: string | null
          household_id: string
          id: string
          name: string
          paused_at: string | null
          start_membership_id: string | null
          strategy: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          ended_at?: string | null
          household_id: string
          id?: string
          name: string
          paused_at?: string | null
          start_membership_id?: string | null
          strategy: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          ended_at?: string | null
          household_id?: string
          id?: string
          name?: string
          paused_at?: string | null
          start_membership_id?: string | null
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_rotations_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_rotations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_rotations_start_membership_id_fkey"
            columns: ["start_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
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
      household_locations: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_locations_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_locations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_locations_parent_id_household_id_fkey"
            columns: ["parent_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
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
      inventory_condition_events: {
        Row: {
          changed_by_membership_id: string
          created_at: string
          household_id: string
          id: string
          inventory_item_id: string
          new_condition: string
          note: string | null
          previous_condition: string
          reason: string | null
        }
        Insert: {
          changed_by_membership_id: string
          created_at?: string
          household_id: string
          id?: string
          inventory_item_id: string
          new_condition: string
          note?: string | null
          previous_condition: string
          reason?: string | null
        }
        Update: {
          changed_by_membership_id?: string
          created_at?: string
          household_id?: string
          id?: string
          inventory_item_id?: string
          new_condition?: string
          note?: string | null
          previous_condition?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_condition_events_changed_by_membership_id_fkey"
            columns: ["changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_condition_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_condition_events_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          acquired_by_membership_id: string | null
          brand: string | null
          category: string
          condition: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          household_id: string
          id: string
          loan_return_at: string | null
          location_id: string | null
          model: string | null
          move_out_disposition: string | null
          name: string
          owner_membership_id: string | null
          ownership_mode: string
          purchase_date: string | null
          purchase_price_cents: number | null
          quantity: number
          quantity_is_approximate: boolean
          quantity_unit: string
          related_chore_definition_id: string | null
          responsibility_area_id: string | null
          responsible_membership_id: string | null
          serial_number: string | null
          status: string
          updated_at: string
          visibility: string
          warranty_expires_at: string | null
        }
        Insert: {
          acquired_by_membership_id?: string | null
          brand?: string | null
          category: string
          condition?: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          household_id: string
          id?: string
          loan_return_at?: string | null
          location_id?: string | null
          model?: string | null
          move_out_disposition?: string | null
          name: string
          owner_membership_id?: string | null
          ownership_mode?: string
          purchase_date?: string | null
          purchase_price_cents?: number | null
          quantity?: number
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_chore_definition_id?: string | null
          responsibility_area_id?: string | null
          responsible_membership_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          warranty_expires_at?: string | null
        }
        Update: {
          acquired_by_membership_id?: string | null
          brand?: string | null
          category?: string
          condition?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          household_id?: string
          id?: string
          loan_return_at?: string | null
          location_id?: string | null
          model?: string | null
          move_out_disposition?: string | null
          name?: string
          owner_membership_id?: string | null
          ownership_mode?: string
          purchase_date?: string | null
          purchase_price_cents?: number | null
          quantity?: number
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_chore_definition_id?: string | null
          responsibility_area_id?: string | null
          responsible_membership_id?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_acquired_by_membership_id_fkey"
            columns: ["acquired_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_location_id_household_id_fkey"
            columns: ["location_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "inventory_items_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_related_chore_definition_id_household_id_fkey"
            columns: ["related_chore_definition_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_definitions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "inventory_items_responsibility_area_id_household_id_fkey"
            columns: ["responsibility_area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "inventory_items_responsible_membership_id_fkey"
            columns: ["responsible_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ownership_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          inventory_item_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          inventory_item_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          inventory_item_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ownership_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ownership_members_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "inventory_ownership_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
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
      notification_worker_heartbeats: {
        Row: {
          calendar_horizons_extended: number
          claimed: number
          created_at: string
          dead_letter: number
          delivery_enabled: boolean
          duration_ms: number
          empty: boolean
          horizon_extension_current: boolean
          id: string
          last_attempted_at: string
          last_horizon_extension_at: string | null
          last_successful_at: string | null
          retried: number
          scheduled_processed: number
          sent: number
          updated_at: string
        }
        Insert: {
          calendar_horizons_extended?: number
          claimed?: number
          created_at?: string
          dead_letter?: number
          delivery_enabled: boolean
          duration_ms?: number
          empty?: boolean
          horizon_extension_current?: boolean
          id?: string
          last_attempted_at: string
          last_horizon_extension_at?: string | null
          last_successful_at?: string | null
          retried?: number
          scheduled_processed?: number
          sent?: number
          updated_at?: string
        }
        Update: {
          calendar_horizons_extended?: number
          claimed?: number
          created_at?: string
          dead_letter?: number
          delivery_enabled?: boolean
          duration_ms?: number
          empty?: boolean
          horizon_extension_current?: boolean
          id?: string
          last_attempted_at?: string
          last_horizon_extension_at?: string | null
          last_successful_at?: string | null
          retried?: number
          scheduled_processed?: number
          sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          best_by: string | null
          category: string
          communal_available: boolean
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          location_id: string | null
          name: string
          name_aliases: string[]
          normalized_name: string | null
          notes: string | null
          opened_at: string | null
          owner_membership_id: string | null
          ownership_mode: string
          prepared_at: string | null
          purchased_at: string | null
          quantity: number | null
          quantity_is_approximate: boolean
          quantity_unit: string
          remaining_state: string | null
          state: string
          updated_at: string
          use_by: string | null
          use_soon_at: string | null
          visibility: string
        }
        Insert: {
          best_by?: string | null
          category: string
          communal_available?: boolean
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          location_id?: string | null
          name: string
          name_aliases?: string[]
          normalized_name?: string | null
          notes?: string | null
          opened_at?: string | null
          owner_membership_id?: string | null
          ownership_mode?: string
          prepared_at?: string | null
          purchased_at?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          remaining_state?: string | null
          state?: string
          updated_at?: string
          use_by?: string | null
          use_soon_at?: string | null
          visibility?: string
        }
        Update: {
          best_by?: string | null
          category?: string
          communal_available?: boolean
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          location_id?: string | null
          name?: string
          name_aliases?: string[]
          normalized_name?: string | null
          notes?: string | null
          opened_at?: string | null
          owner_membership_id?: string | null
          ownership_mode?: string
          prepared_at?: string | null
          purchased_at?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          remaining_state?: string | null
          state?: string
          updated_at?: string
          use_by?: string | null
          use_soon_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_items_location_id_household_id_fkey"
            columns: ["location_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "pantry_items_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_stock_events: {
        Row: {
          created_at: string
          delta_quantity: number | null
          event_type: string
          household_id: string
          id: string
          new_quantity: number | null
          new_state: string | null
          note: string | null
          pantry_item_id: string
          previous_quantity: number | null
          previous_state: string | null
          reason: string | null
          recorded_by_membership_id: string
        }
        Insert: {
          created_at?: string
          delta_quantity?: number | null
          event_type: string
          household_id: string
          id?: string
          new_quantity?: number | null
          new_state?: string | null
          note?: string | null
          pantry_item_id: string
          previous_quantity?: number | null
          previous_state?: string | null
          reason?: string | null
          recorded_by_membership_id: string
        }
        Update: {
          created_at?: string
          delta_quantity?: number | null
          event_type?: string
          household_id?: string
          id?: string
          new_quantity?: number | null
          new_state?: string | null
          note?: string | null
          pantry_item_id?: string
          previous_quantity?: number | null
          previous_state?: string | null
          reason?: string | null
          recorded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_stock_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_stock_events_pantry_item_id_household_id_fkey"
            columns: ["pantry_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "pantry_stock_events_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_visibility_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          membership_id: string
          pantry_item_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
          pantry_item_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          pantry_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_visibility_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_visibility_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_visibility_members_pantry_item_id_household_id_fkey"
            columns: ["pantry_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id", "household_id"]
          },
        ]
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
      resource_expense_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          expense_id: string
          expense_item_id: string
          household_id: string
          id: string
          link_kind: string
          resource_id: string
          resource_type: string
          unlinked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          expense_id: string
          expense_item_id: string
          household_id: string
          id?: string
          link_kind: string
          resource_id: string
          resource_type: string
          unlinked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          expense_id?: string
          expense_item_id?: string
          household_id?: string
          id?: string
          link_kind?: string
          resource_id?: string
          resource_type?: string
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_expense_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_expense_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_expense_links_expense_item_id_household_id_fkey"
            columns: ["expense_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "resource_expense_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_areas: {
        Row: {
          category: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          end_date: string | null
          handoff_expectations: string | null
          household_id: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          end_date?: string | null
          handoff_expectations?: string | null
          household_id: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          end_date?: string | null
          handoff_expectations?: string | null
          household_id?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_areas_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_areas_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_assignments: {
        Row: {
          area_id: string
          created_at: string
          ended_at: string | null
          household_id: string
          id: string
          membership_id: string
          role: string
          started_at: string
          status: string
        }
        Insert: {
          area_id: string
          created_at?: string
          ended_at?: string | null
          household_id: string
          id?: string
          membership_id: string
          role: string
          started_at?: string
          status?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          ended_at?: string | null
          household_id?: string
          id?: string
          membership_id?: string
          role?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_assignments_area_id_household_id_fkey"
            columns: ["area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "responsibility_assignments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_transfers: {
        Row: {
          area_id: string
          created_at: string
          from_membership_id: string
          household_id: string
          id: string
          note: string | null
          requested_at: string
          resolved_at: string | null
          status: string
          to_membership_id: string
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          from_membership_id: string
          household_id: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          to_membership_id: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          from_membership_id?: string
          household_id?: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          to_membership_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_transfers_area_id_household_id_fkey"
            columns: ["area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "responsibility_transfers_from_membership_id_fkey"
            columns: ["from_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_transfers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_transfers_to_membership_id_fkey"
            columns: ["to_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
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
      shopping_list_items: {
        Row: {
          approval_hint: boolean
          assigned_shopper_membership_id: string | null
          cancelled_at: string | null
          category: string
          created_at: string
          description: string | null
          estimated_cost_cents: number | null
          household_id: string
          id: string
          intended_owner_membership_id: string | null
          intended_ownership: string
          list_id: string
          name: string
          needed_by: string | null
          priority: string
          purchased_at: string | null
          purchased_quantity: number | null
          purchaser_membership_id: string | null
          quantity: number | null
          quantity_is_approximate: boolean
          quantity_unit: string
          related_calendar_event_id: string | null
          related_chore_occurrence_id: string | null
          related_inventory_id: string | null
          related_pantry_id: string | null
          related_supply_id: string | null
          requested_by_membership_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_hint?: boolean
          assigned_shopper_membership_id?: string | null
          cancelled_at?: string | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_cost_cents?: number | null
          household_id: string
          id?: string
          intended_owner_membership_id?: string | null
          intended_ownership?: string
          list_id: string
          name: string
          needed_by?: string | null
          priority?: string
          purchased_at?: string | null
          purchased_quantity?: number | null
          purchaser_membership_id?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_calendar_event_id?: string | null
          related_chore_occurrence_id?: string | null
          related_inventory_id?: string | null
          related_pantry_id?: string | null
          related_supply_id?: string | null
          requested_by_membership_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_hint?: boolean
          assigned_shopper_membership_id?: string | null
          cancelled_at?: string | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_cost_cents?: number | null
          household_id?: string
          id?: string
          intended_owner_membership_id?: string | null
          intended_ownership?: string
          list_id?: string
          name?: string
          needed_by?: string | null
          priority?: string
          purchased_at?: string | null
          purchased_quantity?: number | null
          purchaser_membership_id?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_calendar_event_id?: string | null
          related_chore_occurrence_id?: string | null
          related_inventory_id?: string | null
          related_pantry_id?: string | null
          related_supply_id?: string | null
          requested_by_membership_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_assigned_shopper_membership_id_fkey"
            columns: ["assigned_shopper_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_intended_owner_membership_id_fkey"
            columns: ["intended_owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_list_id_household_id_fkey"
            columns: ["list_id", "household_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_purchaser_membership_id_fkey"
            columns: ["purchaser_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_related_calendar_event_id_fkey"
            columns: ["related_calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_related_chore_occurrence_id_household__fkey"
            columns: ["related_chore_occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_related_inventory_id_household_id_fkey"
            columns: ["related_inventory_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_related_pantry_id_household_id_fkey"
            columns: ["related_pantry_id", "household_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_related_supply_id_household_id_fkey"
            columns: ["related_supply_id", "household_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          archived_at: string | null
          calendar_event_id: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          is_default: boolean
          name: string
          responsibility_area_id: string | null
          store_label: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          is_default?: boolean
          name: string
          responsibility_area_id?: string | null
          store_label?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          is_default?: boolean
          name?: string
          responsibility_area_id?: string | null
          store_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_responsibility_area_id_household_id_fkey"
            columns: ["responsibility_area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      supply_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          last_purchased_at: string | null
          last_restocked_at: string | null
          last_stock_check_at: string | null
          location_id: string | null
          name: string
          notes: string | null
          owner_membership_id: string | null
          ownership_mode: string
          preferred_brand: string | null
          quantity: number | null
          quantity_is_approximate: boolean
          quantity_unit: string
          related_chore_definition_id: string | null
          reorder_threshold: number | null
          responsibility_area_id: string | null
          responsible_membership_id: string | null
          restock_policy: string
          stock_state: string
          target_quantity: number | null
          updated_at: string
          visibility: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          last_purchased_at?: string | null
          last_restocked_at?: string | null
          last_stock_check_at?: string | null
          location_id?: string | null
          name: string
          notes?: string | null
          owner_membership_id?: string | null
          ownership_mode?: string
          preferred_brand?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_chore_definition_id?: string | null
          reorder_threshold?: number | null
          responsibility_area_id?: string | null
          responsible_membership_id?: string | null
          restock_policy?: string
          stock_state?: string
          target_quantity?: number | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          last_purchased_at?: string | null
          last_restocked_at?: string | null
          last_stock_check_at?: string | null
          location_id?: string | null
          name?: string
          notes?: string | null
          owner_membership_id?: string | null
          ownership_mode?: string
          preferred_brand?: string | null
          quantity?: number | null
          quantity_is_approximate?: boolean
          quantity_unit?: string
          related_chore_definition_id?: string | null
          reorder_threshold?: number | null
          responsibility_area_id?: string | null
          responsible_membership_id?: string | null
          restock_policy?: string
          stock_state?: string
          target_quantity?: number | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_items_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_items_location_id_household_id_fkey"
            columns: ["location_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "supply_items_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_items_related_chore_definition_id_household_id_fkey"
            columns: ["related_chore_definition_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_definitions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "supply_items_responsibility_area_id_household_id_fkey"
            columns: ["responsibility_area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "supply_items_responsible_membership_id_fkey"
            columns: ["responsible_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_stock_events: {
        Row: {
          created_at: string
          delta_quantity: number | null
          event_type: string
          household_id: string
          id: string
          new_quantity: number | null
          new_stock_state: string | null
          note: string | null
          previous_quantity: number | null
          previous_stock_state: string | null
          reason: string | null
          recorded_by_membership_id: string
          supply_item_id: string
        }
        Insert: {
          created_at?: string
          delta_quantity?: number | null
          event_type: string
          household_id: string
          id?: string
          new_quantity?: number | null
          new_stock_state?: string | null
          note?: string | null
          previous_quantity?: number | null
          previous_stock_state?: string | null
          reason?: string | null
          recorded_by_membership_id: string
          supply_item_id: string
        }
        Update: {
          created_at?: string
          delta_quantity?: number | null
          event_type?: string
          household_id?: string
          id?: string
          new_quantity?: number | null
          new_stock_state?: string | null
          note?: string | null
          previous_quantity?: number | null
          previous_stock_state?: string | null
          reason?: string | null
          recorded_by_membership_id?: string
          supply_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_stock_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_stock_events_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_stock_events_supply_item_id_household_id_fkey"
            columns: ["supply_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id", "household_id"]
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
      _calendar_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _calendar_assert_same_household_member: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: undefined
      }
      _calendar_audit: {
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
      _calendar_exception_has_time_override: {
        Args: {
          p_all_day: boolean
          p_end_date_exclusive: string
          p_ends_at: string
          p_kind: string
          p_start_date: string
          p_starts_at: string
        }
        Returns: boolean
      }
      _calendar_user_id_for_membership: {
        Args: { p_membership_id: string }
        Returns: string
      }
      _cancel_resource_source_reminders: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: undefined
      }
      _cancel_scheduled_notification_request: {
        Args: { p_idempotency_key: string }
        Returns: boolean
      }
      _chore_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _chore_assert_member: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: undefined
      }
      _chore_audit: {
        Args: {
          p_after?: Json
          p_before?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      _chore_notify: {
        Args: {
          p_actor: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_memberships: string[]
        }
        Returns: undefined
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
      _link_chore_occurrence_calendar: {
        Args: { p_occurrence_id: string }
        Returns: string
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
      _reconcile_calendar_reminders: {
        Args: { p_event_id: string }
        Returns: number
      }
      _reconcile_chore_reminders: {
        Args: { p_occurrence_id: string }
        Returns: number
      }
      _reconcile_inventory_reminders: {
        Args: { p_inventory_item_id: string }
        Returns: number
      }
      _reconcile_pantry_reminders: {
        Args: { p_pantry_item_id: string }
        Returns: number
      }
      _resolve_chore_reassignment: {
        Args: {
          p_request_id: string
          p_resolution_note?: string
          p_status: string
        }
        Returns: string
      }
      _resolve_responsibility_transfer: {
        Args: { p_status: string; p_transfer_id: string }
        Returns: string
      }
      _resource_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _resource_assert_member: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: undefined
      }
      _resource_audit: {
        Args: {
          p_after?: Json
          p_before?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      _resource_default_visibility: {
        Args: { p_ownership_mode: string }
        Returns: string
      }
      _resource_inventory_recipients: {
        Args: { p_item_id: string }
        Returns: string[]
      }
      _resource_notify: {
        Args: {
          p_action_href: string
          p_actor_membership_id: string
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
          p_memberships: string[]
          p_title: string
        }
        Returns: undefined
      }
      _resource_validate_ownership: {
        Args: {
          p_household_id: string
          p_owner_membership_id: string
          p_ownership_mode: string
          p_shared_membership_ids: string[]
        }
        Returns: undefined
      }
      _sanitize_delivery_error: { Args: { p_error: string }; Returns: string }
      _set_chore_definition_status: {
        Args: { p_definition_id: string; p_status: string }
        Returns: string
      }
      _sync_obligation_settlement_status: {
        Args: { p_obligation_id: string }
        Returns: undefined
      }
      _transition_chore_occurrence: {
        Args: {
          p_action: string
          p_note?: string
          p_occurrence_id: string
          p_reason?: string
        }
        Returns: string
      }
      _valid_chore_reminder_offsets: {
        Args: { p_offsets: number[] }
        Returns: boolean
      }
      accept_household_invitation: {
        Args: { p_token_hash: string }
        Returns: string
      }
      accept_responsibility_transfer: {
        Args: { p_transfer_id: string }
        Returns: string
      }
      approve_chore_reassignment: {
        Args: { p_request_id: string; p_resolution_note?: string }
        Returns: string
      }
      archive_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      archive_household_location: {
        Args: { p_location_id: string }
        Returns: string
      }
      assign_chore_occurrence: {
        Args: {
          p_membership_id: string
          p_occurrence_id: string
          p_role?: string
        }
        Returns: string
      }
      assign_responsibility_area: {
        Args: { p_area_id: string; p_membership_id: string; p_role?: string }
        Returns: string
      }
      assign_shopping_item: {
        Args: { p_item_id: string; p_shopper_membership_id: string }
        Returns: string
      }
      can_confirm_or_void_expense: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_edit_expense_draft: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_view_chore_definition: {
        Args: { p_definition_id: string }
        Returns: boolean
      }
      can_view_chore_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: boolean
      }
      can_view_expense: { Args: { p_expense_id: string }; Returns: boolean }
      can_view_inventory_item: { Args: { p_item_id: string }; Returns: boolean }
      can_view_pantry_item: { Args: { p_item_id: string }; Returns: boolean }
      can_view_supply_item: { Args: { p_item_id: string }; Returns: boolean }
      cancel_calendar_event: {
        Args: {
          p_coordinator_override?: boolean
          p_event_id: string
          p_reason?: string
        }
        Returns: string
      }
      cancel_calendar_occurrence: {
        Args: {
          p_event_id: string
          p_original_starts_at: string
          p_reason?: string
        }
        Returns: string
      }
      cancel_chore_occurrence: {
        Args: { p_occurrence_id: string; p_reason?: string }
        Returns: string
      }
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
      cancel_shopping_item: { Args: { p_item_id: string }; Returns: string }
      change_inventory_condition: {
        Args: {
          p_item_id: string
          p_new_condition: string
          p_note?: string
          p_reason?: string
        }
        Returns: string
      }
      change_inventory_ownership: {
        Args: {
          p_item_id: string
          p_owner_membership_id?: string
          p_ownership_mode: string
          p_shared_membership_ids?: string[]
          p_visibility?: string
        }
        Returns: string
      }
      change_membership_roles: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_roles: string[]
        }
        Returns: undefined
      }
      claim_calendar_horizon_extensions: {
        Args: { p_limit?: number }
        Returns: {
          event_id: string
        }[]
      }
      claim_chore_horizon_extensions: {
        Args: { p_limit?: number }
        Returns: {
          definition_id: string
        }[]
      }
      claim_chore_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: string
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
      claim_shopping_item: { Args: { p_item_id: string }; Returns: string }
      cleanup_test_household_data: {
        Args: { p_test_run_id: string }
        Returns: number
      }
      complete_chore_occurrence: {
        Args: { p_completion_note?: string; p_occurrence_id: string }
        Returns: string
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
      create_calendar_event: {
        Args: {
          p_all_day?: boolean
          p_attendee_membership_ids?: string[]
          p_category?: string
          p_client_idempotency_key?: string
          p_description?: string
          p_end_date_exclusive?: string
          p_ends_at?: string
          p_event_guest_count?: number
          p_guest_label?: string
          p_household_id: string
          p_location?: string
          p_recurrence_count?: number
          p_recurrence_until?: string
          p_reminder_offsets_minutes?: number[]
          p_rrule?: string
          p_start_date?: string
          p_starts_at?: string
          p_time_zone?: string
          p_title: string
          p_visibility?: string
        }
        Returns: string
      }
      create_calendar_feed: {
        Args: {
          p_household_id: string
          p_label?: string
          p_scope?: string
          p_token_hash: string
        }
        Returns: string
      }
      create_chore_definition: {
        Args: {
          p_all_day?: boolean
          p_calendar_category?: string
          p_category: string
          p_description?: string
          p_due_time_minutes?: number
          p_end_date?: string
          p_escalation_coordinator?: boolean
          p_grace_period_minutes?: number
          p_household_id: string
          p_recurrence_count?: number
          p_reminder_offsets?: number[]
          p_requires_verification?: boolean
          p_responsibility_area_id?: string
          p_rotation_id?: string
          p_rrule: string
          p_show_on_calendar?: boolean
          p_start_date: string
          p_time_zone?: string
          p_title: string
          p_verifier_membership_id?: string
          p_visibility?: string
        }
        Returns: string
      }
      create_chore_rotation: {
        Args: {
          p_household_id: string
          p_membership_ids?: string[]
          p_name: string
          p_start_membership_id?: string
          p_strategy: string
        }
        Returns: string
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
      create_household_location: {
        Args: { p_household_id: string; p_name: string; p_parent_id?: string }
        Returns: string
      }
      create_inventory_item: {
        Args: {
          p_category: string
          p_condition?: string
          p_description?: string
          p_household_id: string
          p_location_id?: string
          p_name: string
          p_owner_membership_id?: string
          p_ownership_mode?: string
          p_quantity?: number
          p_quantity_unit?: string
          p_shared_membership_ids?: string[]
          p_visibility?: string
        }
        Returns: string
      }
      create_one_time_chore: {
        Args: {
          p_all_day?: boolean
          p_assignee_membership_ids?: string[]
          p_category: string
          p_description?: string
          p_due_at: string
          p_due_date?: string
          p_grace_period_minutes?: number
          p_household_id: string
          p_reminder_offsets?: number[]
          p_requires_verification?: boolean
          p_responsibility_area_id?: string
          p_show_on_calendar?: boolean
          p_title: string
          p_verifier_membership_id?: string
          p_visibility?: string
        }
        Returns: string
      }
      create_pantry_item: {
        Args: {
          p_best_by?: string
          p_category: string
          p_communal_available?: boolean
          p_household_id: string
          p_location_id?: string
          p_name: string
          p_normalized_name?: string
          p_notes?: string
          p_owner_membership_id?: string
          p_ownership_mode?: string
          p_quantity?: number
          p_quantity_unit?: string
          p_remaining_state?: string
          p_use_by?: string
          p_use_soon_at?: string
          p_visibility?: string
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
      create_responsibility_area: {
        Args: {
          p_category: string
          p_description?: string
          p_handoff_expectations?: string
          p_household_id: string
          p_name: string
          p_start_date: string
        }
        Returns: string
      }
      create_shopping_item: {
        Args: {
          p_category?: string
          p_description?: string
          p_estimated_cost_cents?: number
          p_household_id: string
          p_intended_owner_membership_id?: string
          p_intended_ownership?: string
          p_list_id?: string
          p_name: string
          p_needed_by?: string
          p_priority?: string
          p_quantity?: number
          p_quantity_unit?: string
          p_related_inventory_id?: string
          p_related_pantry_id?: string
          p_related_supply_id?: string
        }
        Returns: string
      }
      create_shopping_list: {
        Args: { p_household_id: string; p_name: string; p_store_label?: string }
        Returns: string
      }
      create_supply_item: {
        Args: {
          p_category: string
          p_household_id: string
          p_location_id?: string
          p_name: string
          p_notes?: string
          p_owner_membership_id?: string
          p_ownership_mode?: string
          p_quantity?: number
          p_quantity_unit?: string
          p_reorder_threshold?: number
          p_responsibility_area_id?: string
          p_responsible_membership_id?: string
          p_restock_policy?: string
          p_stock_state?: string
          p_target_quantity?: number
        }
        Returns: string
      }
      current_membership_id: {
        Args: { p_household_id: string }
        Returns: string
      }
      deactivate_push_subscription: {
        Args: { p_endpoint_hash?: string; p_subscription_id?: string }
        Returns: boolean
      }
      decline_chore_reassignment: {
        Args: { p_request_id: string; p_resolution_note?: string }
        Returns: string
      }
      decline_household_invitation: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      decline_responsibility_transfer: {
        Args: { p_transfer_id: string }
        Returns: string
      }
      discard_pantry_item: {
        Args: { p_item_id: string; p_note?: string }
        Returns: string
      }
      dispose_inventory_item: {
        Args: { p_disposition?: string; p_item_id: string; p_status: string }
        Returns: string
      }
      effective_calendar_occurrence_fields: {
        Args: { p_event_id: string; p_original_starts_at: string }
        Returns: {
          description: string
          event_guest_count: number
          exception_id: string
          guest_label: string
          location: string
          overrides_attendees: boolean
          overrides_reminders: boolean
          title: string
        }[]
      }
      end_chore_definition: {
        Args: { p_definition_id: string }
        Returns: string
      }
      enqueue_test_notification: { Args: never; Returns: string }
      ensure_default_shopping_list: {
        Args: { p_household_id: string }
        Returns: string
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
      get_calendar_feed_context: {
        Args: { p_token_hash: string }
        Returns: {
          expires_at: string
          feed_id: string
          household_id: string
          membership_active: boolean
          revoked_at: string
          scope: string
          user_id: string
        }[]
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
      get_notification_worker_health: {
        Args: { p_household_id: string }
        Returns: Json
      }
      has_responsibility: {
        Args: { p_household_id: string; p_roles: string[] }
        Returns: boolean
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_active_member: { Args: { p_household_id: string }; Returns: boolean }
      is_calendar_event_participant: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_chore_assignee: { Args: { p_occurrence_id: string }; Returns: boolean }
      is_household_coordinator: {
        Args: { p_household_id: string }
        Returns: boolean
      }
      leave_household: {
        Args: { p_household_id: string; p_reason?: string }
        Returns: undefined
      }
      link_resource_to_expense_item: {
        Args: {
          p_expense_item_id: string
          p_household_id: string
          p_link_kind: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: string
      }
      list_authorized_feed_events: {
        Args: { p_feed_id: string; p_range_end: string; p_range_start: string }
        Returns: {
          all_day: boolean
          calendar_uid: string
          category: string
          description: string
          end_date_exclusive: string
          ends_at: string
          event_id: string
          household_id: string
          location: string
          recurrence_count: number
          recurrence_until: string
          rrule: string
          series_id: string
          start_date: string
          starts_at: string
          status: string
          time_zone: string
          title: string
          visibility: string
        }[]
      }
      mark_all_notifications_read: {
        Args: { p_household_id?: string }
        Returns: number
      }
      mark_chore_blocked: {
        Args: { p_note?: string; p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_unread: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_pantry_finished: {
        Args: { p_item_id: string; p_note?: string }
        Returns: string
      }
      mark_shopping_item_purchased: {
        Args: {
          p_expense_item_id?: string
          p_item_id: string
          p_purchased_quantity?: number
          p_update_related_stock?: boolean
        }
        Returns: string
      }
      mark_shopping_item_unavailable: {
        Args: { p_item_id: string; p_note?: string }
        Returns: string
      }
      mark_supply_low: {
        Args: { p_item_id: string; p_note?: string }
        Returns: string
      }
      materialize_chore_occurrences: {
        Args: { p_definition_id: string; p_occurrences: Json }
        Returns: number
      }
      membership_belongs_to_household: {
        Args: { p_household_id: string; p_membership_id: string }
        Returns: boolean
      }
      move_inventory_item: {
        Args: { p_item_id: string; p_location_id: string }
        Returns: string
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
      pause_chore_definition: {
        Args: { p_definition_id: string }
        Returns: string
      }
      process_due_scheduled_notifications: {
        Args: { p_limit?: number }
        Returns: number
      }
      reconcile_calendar_event_occurrences: {
        Args: { p_event_id: string; p_occurrences: Json }
        Returns: number
      }
      record_notification_worker_heartbeat: {
        Args: {
          p_calendar_horizons_extended?: number
          p_claimed?: number
          p_dead_letter?: number
          p_delivery_enabled: boolean
          p_duration_ms?: number
          p_empty?: boolean
          p_horizon_extension_current?: boolean
          p_retried?: number
          p_scheduled_processed?: number
          p_sent?: number
          p_successful?: boolean
        }
        Returns: undefined
      }
      record_pantry_stock: {
        Args: {
          p_event_type: string
          p_item_id: string
          p_new_quantity?: number
          p_note?: string
          p_reason?: string
          p_remaining_state?: string
          p_state?: string
        }
        Returns: string
      }
      record_supply_stock: {
        Args: {
          p_event_type: string
          p_item_id: string
          p_new_quantity?: number
          p_note?: string
          p_reason?: string
          p_stock_state?: string
        }
        Returns: string
      }
      regenerate_calendar_feed: {
        Args: { p_feed_id: string; p_new_token_hash: string }
        Returns: string
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
      rename_household_location: {
        Args: { p_location_id: string; p_name: string }
        Returns: string
      }
      reopen_chore_occurrence: {
        Args: { p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      request_chore_reassignment: {
        Args: {
          p_occurrence_id: string
          p_reason: string
          p_requested_effective_at?: string
          p_suggested_membership_id?: string
        }
        Returns: string
      }
      request_responsibility_transfer: {
        Args: { p_area_id: string; p_note?: string; p_to_membership_id: string }
        Returns: string
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
      respond_to_calendar_event: {
        Args: {
          p_event_id: string
          p_guest_count?: number
          p_guest_note?: string
          p_rsvp_status: string
        }
        Returns: string
      }
      restock_supply_item: {
        Args: {
          p_item_id: string
          p_note?: string
          p_quantity?: number
          p_stock_state?: string
        }
        Returns: string
      }
      resume_chore_definition: {
        Args: { p_definition_id: string }
        Returns: string
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
      revoke_calendar_feed: { Args: { p_feed_id: string }; Returns: string }
      revoke_household_invitation: {
        Args: { p_household_id: string; p_invitation_id: string }
        Returns: undefined
      }
      set_current_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      skip_chore_occurrence: {
        Args: { p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      start_chore_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: string
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
      touch_supply_stock_check: { Args: { p_item_id: string }; Returns: string }
      unlink_resource_from_expense_item: {
        Args: { p_link_id: string }
        Returns: string
      }
      update_calendar_event: {
        Args: {
          p_all_day?: boolean
          p_attendee_membership_ids?: string[]
          p_category?: string
          p_coordinator_override?: boolean
          p_description?: string
          p_end_date_exclusive?: string
          p_ends_at?: string
          p_event_guest_count?: number
          p_event_id: string
          p_guest_label?: string
          p_location?: string
          p_recurrence_count?: number
          p_recurrence_until?: string
          p_reminder_offsets_minutes?: number[]
          p_rrule?: string
          p_start_date?: string
          p_starts_at?: string
          p_time_zone?: string
          p_title?: string
          p_visibility?: string
        }
        Returns: string
      }
      update_calendar_occurrence: {
        Args: {
          p_all_day?: boolean
          p_attendee_membership_ids?: string[]
          p_clear_description?: boolean
          p_clear_guest_label?: boolean
          p_clear_location?: boolean
          p_clear_title?: boolean
          p_description?: string
          p_end_date_exclusive?: string
          p_ends_at?: string
          p_event_guest_count?: number
          p_event_id: string
          p_guest_label?: string
          p_location?: string
          p_original_starts_at: string
          p_reminder_offsets?: number[]
          p_start_date?: string
          p_starts_at?: string
          p_title?: string
        }
        Returns: string
      }
      update_chore_definition: {
        Args: { p_changes: Json; p_definition_id: string }
        Returns: string
      }
      update_chore_rotation: {
        Args: {
          p_ended?: boolean
          p_name?: string
          p_paused?: boolean
          p_rotation_id: string
          p_start_membership_id?: string
          p_strategy?: string
        }
        Returns: string
      }
      update_chore_rotation_members: {
        Args: { p_membership_ids: string[]; p_rotation_id: string }
        Returns: string
      }
      update_inventory_item: {
        Args: { p_item_id: string; p_patch: Json }
        Returns: string
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
      verify_chore_completion: {
        Args: { p_occurrence_id: string }
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
