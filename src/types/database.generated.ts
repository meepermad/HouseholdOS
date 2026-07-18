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
      calendar_availability_overrides: {
        Row: {
          created_at: string
          ends_at: string
          household_id: string
          id: string
          membership_id: string
          note: string | null
          override_kind: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          household_id: string
          id?: string
          membership_id: string
          note?: string | null
          override_kind: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          note?: string | null
          override_kind?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_availability_overrides_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_availability_overrides_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_availability_rules: {
        Row: {
          calendar_ids: string[]
          created_at: string
          end_minute: number
          household_id: string
          id: string
          is_active: boolean
          max_event_minutes: number | null
          membership_id: string
          min_notice_minutes: number
          priority: number
          rule_kind: string
          start_minute: number
          time_zone: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          calendar_ids?: string[]
          created_at?: string
          end_minute: number
          household_id: string
          id?: string
          is_active?: boolean
          max_event_minutes?: number | null
          membership_id: string
          min_notice_minutes?: number
          priority?: number
          rule_kind: string
          start_minute: number
          time_zone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          calendar_ids?: string[]
          created_at?: string
          end_minute?: number
          household_id?: string
          id?: string
          is_active?: boolean
          max_event_minutes?: number | null
          membership_id?: string
          min_notice_minutes?: number
          priority?: number
          rule_kind?: string
          start_minute?: number
          time_zone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "calendar_availability_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_availability_rules_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_attendees: {
        Row: {
          created_at: string
          event_id: string
          guest_count: number
          guest_note: string | null
          household_id: string
          id: string
          is_required: boolean
          membership_id: string
          needs_reconfirmation: boolean
          participation_role: string
          responded_at: string | null
          response_event_sequence: number
          response_note: string | null
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
          is_required?: boolean
          membership_id: string
          needs_reconfirmation?: boolean
          participation_role?: string
          responded_at?: string | null
          response_event_sequence?: number
          response_note?: string | null
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
          is_required?: boolean
          membership_id?: string
          needs_reconfirmation?: boolean
          participation_role?: string
          responded_at?: string | null
          response_event_sequence?: number
          response_note?: string | null
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
      calendar_event_conflicts: {
        Row: {
          conflict_class: string
          conflict_kind: string
          conflicting_event_id: string | null
          created_at: string
          event_id: string
          household_id: string
          id: string
          is_resolved: boolean
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          resource_id: string | null
          summary: string
        }
        Insert: {
          conflict_class: string
          conflict_kind: string
          conflicting_event_id?: string | null
          created_at?: string
          event_id: string
          household_id: string
          id?: string
          is_resolved?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          resource_id?: string | null
          summary: string
        }
        Update: {
          conflict_class?: string
          conflict_kind?: string
          conflicting_event_id?: string | null
          created_at?: string
          event_id?: string
          household_id?: string
          id?: string
          is_resolved?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          resource_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_conflicts_conflicting_event_id_fkey"
            columns: ["conflicting_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_conflicts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_conflicts_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_conflicts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_conflicts_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_conflicts_resource_fkey"
            columns: ["resource_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id", "household_id"]
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
      calendar_event_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          event_id: string
          external_url: string | null
          household_id: string
          id: string
          label: string | null
          link_kind: string
          related_id: string | null
          related_table: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          event_id: string
          external_url?: string | null
          household_id: string
          id?: string
          label?: string | null
          link_kind: string
          related_id?: string | null
          related_table?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          event_id?: string
          external_url?: string | null
          household_id?: string
          id?: string
          label?: string | null
          link_kind?: string
          related_id?: string | null
          related_table?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_links_household_id_fkey"
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
          busy_status: string
          calendar_id: string
          calendar_uid: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          canonical_deep_link: string | null
          category: string
          client_idempotency_key: string
          created_at: string
          description: string | null
          draft_status: string
          end_date_exclusive: string | null
          ends_at: string | null
          event_guest_count: number
          guest_label: string | null
          household_id: string
          id: string
          is_deletable: boolean
          is_editable: boolean
          lifecycle_owner: string
          location: string | null
          materialized_through: string | null
          meeting_url: string | null
          organizer_membership_id: string
          recurrence_count: number | null
          recurrence_until: string | null
          rrule: string | null
          sequence: number
          series_id: string
          source_id: string | null
          source_system: string | null
          source_type: string | null
          source_version: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          time_zone: string
          title: string
          travel_buffer_minutes: number
          updated_at: string
          visibility: string
        }
        Insert: {
          all_day?: boolean
          busy_status?: string
          calendar_id: string
          calendar_uid: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          canonical_deep_link?: string | null
          category?: string
          client_idempotency_key: string
          created_at?: string
          description?: string | null
          draft_status?: string
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number
          guest_label?: string | null
          household_id: string
          id?: string
          is_deletable?: boolean
          is_editable?: boolean
          lifecycle_owner?: string
          location?: string | null
          materialized_through?: string | null
          meeting_url?: string | null
          organizer_membership_id: string
          recurrence_count?: number | null
          recurrence_until?: string | null
          rrule?: string | null
          sequence?: number
          series_id?: string
          source_id?: string | null
          source_system?: string | null
          source_type?: string | null
          source_version?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          time_zone?: string
          title: string
          travel_buffer_minutes?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          all_day?: boolean
          busy_status?: string
          calendar_id?: string
          calendar_uid?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          canonical_deep_link?: string | null
          category?: string
          client_idempotency_key?: string
          created_at?: string
          description?: string | null
          draft_status?: string
          end_date_exclusive?: string | null
          ends_at?: string | null
          event_guest_count?: number
          guest_label?: string | null
          household_id?: string
          id?: string
          is_deletable?: boolean
          is_editable?: boolean
          lifecycle_owner?: string
          location?: string | null
          materialized_through?: string | null
          meeting_url?: string | null
          organizer_membership_id?: string
          recurrence_count?: number | null
          recurrence_until?: string | null
          rrule?: string | null
          sequence?: number
          series_id?: string
          source_id?: string | null
          source_system?: string | null
          source_type?: string | null
          source_version?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          time_zone?: string
          title?: string
          travel_buffer_minutes?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_calendars"
            referencedColumns: ["id", "household_id"]
          },
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
      calendar_external_calendars: {
        Row: {
          connection_id: string
          created_at: string
          display_name: string
          household_calendar_id: string | null
          household_id: string
          id: string
          is_selected: boolean
          last_synced_at: string | null
          provider_calendar_id: string
          provider_etag: string | null
          provider_sync_token: string | null
          sync_direction: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          display_name: string
          household_calendar_id?: string | null
          household_id: string
          id?: string
          is_selected?: boolean
          last_synced_at?: string | null
          provider_calendar_id: string
          provider_etag?: string | null
          provider_sync_token?: string | null
          sync_direction?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          display_name?: string
          household_calendar_id?: string | null
          household_id?: string
          id?: string
          is_selected?: boolean
          last_synced_at?: string | null
          provider_calendar_id?: string
          provider_etag?: string | null
          provider_sync_token?: string | null
          sync_direction?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_external_calendars_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_external_calendars_connection_id_household_id_fkey"
            columns: ["connection_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_connections"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_external_calendars_household_calendar_id_fkey"
            columns: ["household_calendar_id"]
            isOneToOne: false
            referencedRelation: "household_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_external_calendars_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_external_connections: {
        Row: {
          access_token_expires_at: string | null
          account_email: string | null
          created_at: string
          household_id: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_sync_at: string | null
          owner_user_id: string
          provider: string
          refresh_token_ciphertext: string | null
          refresh_token_nonce: string | null
          revoked_at: string | null
          scopes: string[]
          status: string
          sync_mode: string
          updated_at: string
        }
        Insert: {
          access_token_expires_at?: string | null
          account_email?: string | null
          created_at?: string
          household_id: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          owner_user_id: string
          provider: string
          refresh_token_ciphertext?: string | null
          refresh_token_nonce?: string | null
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          sync_mode?: string
          updated_at?: string
        }
        Update: {
          access_token_expires_at?: string | null
          account_email?: string | null
          created_at?: string
          household_id?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          owner_user_id?: string
          provider?: string
          refresh_token_ciphertext?: string | null
          refresh_token_nonce?: string | null
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          sync_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_external_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_external_event_mappings: {
        Row: {
          conflict_resolution: string | null
          conflict_type: string | null
          connection_id: string
          created_at: string
          event_id: string
          external_calendar_id: string
          household_id: string
          id: string
          last_synced_local_version: number | null
          last_synced_provider_version: string | null
          local_version: number
          provider_etag: string | null
          provider_event_id: string
          provider_version: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          conflict_resolution?: string | null
          conflict_type?: string | null
          connection_id: string
          created_at?: string
          event_id: string
          external_calendar_id: string
          household_id: string
          id?: string
          last_synced_local_version?: number | null
          last_synced_provider_version?: string | null
          local_version?: number
          provider_etag?: string | null
          provider_event_id: string
          provider_version?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          conflict_resolution?: string | null
          conflict_type?: string | null
          connection_id?: string
          created_at?: string
          event_id?: string
          external_calendar_id?: string
          household_id?: string
          id?: string
          last_synced_local_version?: number | null
          last_synced_provider_version?: string | null
          local_version?: number
          provider_etag?: string | null
          provider_event_id?: string
          provider_version?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_external_event_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_external_event_mappings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_external_event_mappings_external_calendar_id_fkey"
            columns: ["external_calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_external_event_mappings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feed_tokens: {
        Row: {
          calendar_ids: string[]
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          household_id: string
          id: string
          include_private: boolean
          label: string
          last_accessed_at: string | null
          purpose: string
          revoked_at: string | null
          scope: string
          token_hash: string
          user_id: string
        }
        Insert: {
          calendar_ids?: string[]
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          household_id: string
          id?: string
          include_private?: boolean
          label?: string
          last_accessed_at?: string | null
          purpose?: string
          revoked_at?: string | null
          scope?: string
          token_hash: string
          user_id: string
        }
        Update: {
          calendar_ids?: string[]
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          include_private?: boolean
          label?: string
          last_accessed_at?: string | null
          purpose?: string
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
      calendar_ics_import_uids: {
        Row: {
          calendar_id: string
          event_id: string
          household_id: string
          ics_uid: string
          id: string
          imported_at: string
        }
        Insert: {
          calendar_id: string
          event_id: string
          household_id: string
          ics_uid: string
          id?: string
          imported_at?: string
        }
        Update: {
          calendar_id?: string
          event_id?: string
          household_id?: string
          ics_uid?: string
          id?: string
          imported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_ics_import_uids_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "household_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_ics_import_uids_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_ics_import_uids_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_resource_reservations: {
        Row: {
          confirmed: boolean
          created_at: string
          created_by_membership_id: string
          event_id: string
          household_id: string
          id: string
          quantity: number
          resource_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          created_by_membership_id: string
          event_id: string
          household_id: string
          id?: string
          quantity?: number
          resource_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          created_by_membership_id?: string
          event_id?: string
          household_id?: string
          id?: string
          quantity?: number
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_resource_reservations_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_resource_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_resource_reservations_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_resource_reservations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_resource_reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_resource_reservations_resource_id_household_id_fkey"
            columns: ["resource_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      calendar_resources: {
        Row: {
          capacity: number
          capacity_mode: string
          created_at: string
          household_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          resource_kind: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          capacity_mode?: string
          created_at?: string
          household_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          resource_kind?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          capacity_mode?: string
          created_at?: string
          household_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          resource_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_resources_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_failures: {
        Row: {
          connection_id: string
          created_at: string
          failure_code: string
          failure_message: string
          id: string
          is_retryable: boolean
          provider_event_id: string | null
          sync_run_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          failure_code: string
          failure_message: string
          id?: string
          is_retryable?: boolean
          provider_event_id?: string | null
          sync_run_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          failure_code?: string
          failure_message?: string
          id?: string
          is_retryable?: boolean
          provider_event_id?: string | null
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_failures_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sync_failures_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "calendar_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_runs: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          connection_id: string
          created_at: string
          error_summary: string | null
          events_conflicted: number
          events_exported: number
          events_imported: number
          finished_at: string | null
          household_id: string
          id: string
          next_attempt_at: string | null
          started_at: string | null
          status: string
          trigger_kind: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          connection_id: string
          created_at?: string
          error_summary?: string | null
          events_conflicted?: number
          events_exported?: number
          events_imported?: number
          finished_at?: string | null
          household_id: string
          id?: string
          next_attempt_at?: string | null
          started_at?: string | null
          status?: string
          trigger_kind: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          connection_id?: string
          created_at?: string
          error_summary?: string | null
          events_conflicted?: number
          events_exported?: number
          events_imported?: number
          finished_at?: string | null
          household_id?: string
          id?: string
          next_attempt_at?: string | null
          started_at?: string | null
          status?: string
          trigger_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sync_runs_household_id_fkey"
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
      chore_coverage_offers: {
        Row: {
          created_at: string
          household_id: string
          id: string
          kind: string
          note: string | null
          occurrence_id: string
          offered_by_membership_id: string
          offered_to_membership_id: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          kind: string
          note?: string | null
          occurrence_id: string
          offered_by_membership_id: string
          offered_to_membership_id?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          note?: string | null
          occurrence_id?: string
          offered_by_membership_id?: string
          offered_to_membership_id?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_coverage_offers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_coverage_offers_occurrence_id_household_id_fkey"
            columns: ["occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "chore_coverage_offers_offered_by_membership_id_fkey"
            columns: ["offered_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_coverage_offers_offered_to_membership_id_fkey"
            columns: ["offered_to_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_coverage_offers_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id"]
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
      expense_receipt_aliases: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          household_id: string
          id: string
          kind: string
          merchant_scope: string
          normalized_source: string
          source_text: string
          target_text: string
          updated_at: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          household_id: string
          id?: string
          kind: string
          merchant_scope?: string
          normalized_source: string
          source_text: string
          target_text: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          household_id?: string
          id?: string
          kind?: string
          merchant_scope?: string
          normalized_source?: string
          source_text?: string
          target_text?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipt_aliases_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipt_aliases_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_receipt_duplicates: {
        Row: {
          created_at: string
          household_id: string
          id: string
          match_expense_id: string | null
          match_receipt_id: string | null
          outcome: string
          receipt_id: string
          signals: Json
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          match_expense_id?: string | null
          match_receipt_id?: string | null
          outcome: string
          receipt_id: string
          signals?: Json
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          match_expense_id?: string | null
          match_receipt_id?: string | null
          outcome?: string
          receipt_id?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipt_duplicates_receipt_id_household_id_fkey"
            columns: ["receipt_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expense_receipts"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      expense_receipt_extractions: {
        Row: {
          adapter_name: string
          confidence: number | null
          content_hash: string | null
          created_at: string
          household_id: string
          id: string
          ocr_full_text: string | null
          ocr_lines_json: Json | null
          processing_meta: Json | null
          proposed: Json
          raw_response_redacted: Json | null
          receipt_id: string
          retain_until: string | null
        }
        Insert: {
          adapter_name: string
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          household_id: string
          id?: string
          ocr_full_text?: string | null
          ocr_lines_json?: Json | null
          processing_meta?: Json | null
          proposed?: Json
          raw_response_redacted?: Json | null
          receipt_id: string
          retain_until?: string | null
        }
        Update: {
          adapter_name?: string
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          household_id?: string
          id?: string
          ocr_full_text?: string | null
          ocr_lines_json?: Json | null
          processing_meta?: Json | null
          proposed?: Json
          raw_response_redacted?: Json | null
          receipt_id?: string
          retain_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipt_extractions_receipt_id_household_id_fkey"
            columns: ["receipt_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expense_receipts"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      expense_receipt_jobs: {
        Row: {
          attempts: number
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          household_id: string
          id: string
          last_error: string | null
          receipt_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          household_id: string
          id?: string
          last_error?: string | null
          receipt_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          household_id?: string
          id?: string
          last_error?: string | null
          receipt_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipt_jobs_receipt_id_household_id_fkey"
            columns: ["receipt_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expense_receipts"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      expense_receipt_line_items: {
        Row: {
          category: string | null
          classification: string
          confidence: number | null
          corrected_name: string | null
          created_at: string
          destination_applied_at: string | null
          destination_apply_error: string | null
          destination_apply_status: string
          destination_resource_id: string | null
          expense_item_id: string | null
          household_id: string
          id: string
          ocr_text: string | null
          participant_membership_ids: string[]
          quantity: number | null
          receipt_id: string
          resource_destination: string
          review_status: string
          sort_index: number
          total_price_cents: number | null
          unit_price_cents: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          classification?: string
          confidence?: number | null
          corrected_name?: string | null
          created_at?: string
          destination_applied_at?: string | null
          destination_apply_error?: string | null
          destination_apply_status?: string
          destination_resource_id?: string | null
          expense_item_id?: string | null
          household_id: string
          id?: string
          ocr_text?: string | null
          participant_membership_ids?: string[]
          quantity?: number | null
          receipt_id: string
          resource_destination?: string
          review_status?: string
          sort_index?: number
          total_price_cents?: number | null
          unit_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          classification?: string
          confidence?: number | null
          corrected_name?: string | null
          created_at?: string
          destination_applied_at?: string | null
          destination_apply_error?: string | null
          destination_apply_status?: string
          destination_resource_id?: string | null
          expense_item_id?: string | null
          household_id?: string
          id?: string
          ocr_text?: string | null
          participant_membership_ids?: string[]
          quantity?: number | null
          receipt_id?: string
          resource_destination?: string
          review_status?: string
          sort_index?: number
          total_price_cents?: number | null
          unit_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipt_line_items_receipt_id_household_id_fkey"
            columns: ["receipt_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expense_receipts"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      expense_receipts: {
        Row: {
          confirm_idempotency_key: string | null
          created_at: string
          currency: string
          declared_total_cents: number | null
          deleted_at: string | null
          expense_id: string | null
          extraction_mode: string | null
          file_hash: string | null
          file_name: string
          household_id: string
          id: string
          merchant_corrected: string | null
          mime_type: string
          notes: string | null
          perceptual_hash: string | null
          purchase_date_corrected: string | null
          size_bytes: number
          status: string
          storage_path: string
          unsynced_client_draft: boolean
          updated_at: string
          uploaded_by_membership_id: string
        }
        Insert: {
          confirm_idempotency_key?: string | null
          created_at?: string
          currency?: string
          declared_total_cents?: number | null
          deleted_at?: string | null
          expense_id?: string | null
          extraction_mode?: string | null
          file_hash?: string | null
          file_name: string
          household_id: string
          id?: string
          merchant_corrected?: string | null
          mime_type: string
          notes?: string | null
          perceptual_hash?: string | null
          purchase_date_corrected?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          unsynced_client_draft?: boolean
          updated_at?: string
          uploaded_by_membership_id: string
        }
        Update: {
          confirm_idempotency_key?: string | null
          created_at?: string
          currency?: string
          declared_total_cents?: number | null
          deleted_at?: string | null
          expense_id?: string | null
          extraction_mode?: string | null
          file_hash?: string | null
          file_name?: string
          household_id?: string
          id?: string
          merchant_corrected?: string | null
          mime_type?: string
          notes?: string | null
          perceptual_hash?: string | null
          purchase_date_corrected?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          unsynced_client_draft?: boolean
          updated_at?: string
          uploaded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_expense_id_household_id_fkey"
            columns: ["expense_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "expense_receipts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipts_uploaded_by_membership_id_fkey"
            columns: ["uploaded_by_membership_id"]
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
      governance_acknowledgments: {
        Row: {
          acknowledged_at: string | null
          comment: string | null
          created_at: string
          document_id: string
          due_at: string | null
          household_id: string
          id: string
          last_reminded_at: string | null
          membership_id: string
          reminder_cadence_hours: number | null
          status: string
          version_content_hash: string | null
          version_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          comment?: string | null
          created_at?: string
          document_id: string
          due_at?: string | null
          household_id: string
          id?: string
          last_reminded_at?: string | null
          membership_id: string
          reminder_cadence_hours?: number | null
          status?: string
          version_content_hash?: string | null
          version_id: string
        }
        Update: {
          acknowledged_at?: string | null
          comment?: string | null
          created_at?: string
          document_id?: string
          due_at?: string | null
          household_id?: string
          id?: string
          last_reminded_at?: string | null
          membership_id?: string
          reminder_cadence_hours?: number | null
          status?: string
          version_content_hash?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_acknowledgments_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_acknowledgments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_acknowledgments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_acknowledgments_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_approval_requests: {
        Row: {
          approval_mode: string
          closed_at: string | null
          coordinator_override: boolean
          created_at: string
          document_id: string
          household_id: string
          id: string
          outcome_reason: string | null
          override_by_membership_id: string | null
          override_reason: string | null
          percentage_threshold: number | null
          quorum: number
          requested_by_membership_id: string
          status: string
          version_id: string
        }
        Insert: {
          approval_mode: string
          closed_at?: string | null
          coordinator_override?: boolean
          created_at?: string
          document_id: string
          household_id: string
          id?: string
          outcome_reason?: string | null
          override_by_membership_id?: string | null
          override_reason?: string | null
          percentage_threshold?: number | null
          quorum?: number
          requested_by_membership_id: string
          status?: string
          version_id: string
        }
        Update: {
          approval_mode?: string
          closed_at?: string | null
          coordinator_override?: boolean
          created_at?: string
          document_id?: string
          household_id?: string
          id?: string
          outcome_reason?: string | null
          override_by_membership_id?: string | null
          override_reason?: string | null
          percentage_threshold?: number | null
          quorum?: number
          requested_by_membership_id?: string
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_approval_requests_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_approval_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_approval_requests_override_by_membership_id_fkey"
            columns: ["override_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_approval_requests_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_approval_requests_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_approval_responses: {
        Row: {
          comment: string | null
          created_at: string
          decision: string
          document_id: string
          household_id: string
          id: string
          request_id: string
          responder_membership_id: string
          version_content_hash: string
          version_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decision: string
          document_id: string
          household_id: string
          id?: string
          request_id: string
          responder_membership_id: string
          version_content_hash: string
          version_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decision?: string
          document_id?: string
          household_id?: string
          id?: string
          request_id?: string
          responder_membership_id?: string
          version_content_hash?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_approval_responses_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_approval_responses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_approval_responses_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_approval_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_approval_responses_responder_membership_id_fkey"
            columns: ["responder_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_approval_responses_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_attachments: {
        Row: {
          approval_response_id: string | null
          comment_id: string | null
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          document_id: string | null
          file_name: string
          household_id: string
          id: string
          mime_type: string
          permanently_deleted_at: string | null
          size_bytes: number
          storage_path: string
          transition_task_id: string | null
          uploaded_by_membership_id: string
          version_id: string | null
        }
        Insert: {
          approval_response_id?: string | null
          comment_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          document_id?: string | null
          file_name: string
          household_id: string
          id?: string
          mime_type: string
          permanently_deleted_at?: string | null
          size_bytes: number
          storage_path: string
          transition_task_id?: string | null
          uploaded_by_membership_id: string
          version_id?: string | null
        }
        Update: {
          approval_response_id?: string | null
          comment_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          document_id?: string | null
          file_name?: string
          household_id?: string
          id?: string
          mime_type?: string
          permanently_deleted_at?: string | null
          size_bytes?: number
          storage_path?: string
          transition_task_id?: string | null
          uploaded_by_membership_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_attachments_approval_response_fk"
            columns: ["approval_response_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_approval_responses"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_attachments_comment_id_household_id_fkey"
            columns: ["comment_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_comments"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_attachments_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_attachments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_attachments_transition_task_fk"
            columns: ["transition_task_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_tasks"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_attachments_uploaded_by_membership_id_fkey"
            columns: ["uploaded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_attachments_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_calendar_links: {
        Row: {
          calendar_event_id: string
          created_at: string
          document_id: string | null
          household_id: string
          id: string
          link_kind: string
          transition_workflow_id: string | null
          version_id: string | null
        }
        Insert: {
          calendar_event_id: string
          created_at?: string
          document_id?: string | null
          household_id: string
          id?: string
          link_kind: string
          transition_workflow_id?: string | null
          version_id?: string | null
        }
        Update: {
          calendar_event_id?: string
          created_at?: string
          document_id?: string | null
          household_id?: string
          id?: string
          link_kind?: string
          transition_workflow_id?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_calendar_links_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_calendar_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_calendar_links_transition_fk"
            columns: ["transition_workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_calendar_links_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_comments: {
        Row: {
          author_membership_id: string
          body: string
          created_at: string
          deleted_at: string | null
          document_id: string
          household_id: string
          id: string
          requests_changes: boolean
          version_id: string | null
        }
        Insert: {
          author_membership_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          document_id: string
          household_id: string
          id?: string
          requests_changes?: boolean
          version_id?: string | null
        }
        Update: {
          author_membership_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          document_id?: string
          household_id?: string
          id?: string
          requests_changes?: boolean
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_comments_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_comments_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_comments_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_document_versions: {
        Row: {
          acknowledgment_rules: Json
          activated_at: string | null
          activation_mode: string
          approval_rules: Json
          author_membership_id: string
          change_summary: string | null
          content_hash: string
          created_at: string
          document_id: string
          effective_at: string | null
          effective_until: string | null
          expires_at: string | null
          frozen_at: string | null
          household_id: string
          id: string
          plain_text: string
          prior_version_id: string | null
          review_at: string | null
          status: string
          summary: string | null
          superseded_by_version_id: string | null
          title: string
          version_number: number
        }
        Insert: {
          acknowledgment_rules?: Json
          activated_at?: string | null
          activation_mode?: string
          approval_rules?: Json
          author_membership_id: string
          change_summary?: string | null
          content_hash: string
          created_at?: string
          document_id: string
          effective_at?: string | null
          effective_until?: string | null
          expires_at?: string | null
          frozen_at?: string | null
          household_id: string
          id?: string
          plain_text?: string
          prior_version_id?: string | null
          review_at?: string | null
          status?: string
          summary?: string | null
          superseded_by_version_id?: string | null
          title: string
          version_number: number
        }
        Update: {
          acknowledgment_rules?: Json
          activated_at?: string | null
          activation_mode?: string
          approval_rules?: Json
          author_membership_id?: string
          change_summary?: string | null
          content_hash?: string
          created_at?: string
          document_id?: string
          effective_at?: string | null
          effective_until?: string | null
          expires_at?: string | null
          frozen_at?: string | null
          household_id?: string
          id?: string
          plain_text?: string
          prior_version_id?: string | null
          review_at?: string | null
          status?: string
          summary?: string | null
          superseded_by_version_id?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_document_versions_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_document_versions_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_document_versions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_versions_prior_fk"
            columns: ["prior_version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_versions_superseded_by_fk"
            columns: ["superseded_by_version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_documents: {
        Row: {
          active_version_id: string | null
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          current_version_id: string | null
          document_class: string
          household_id: string
          id: string
          is_financial: boolean
          status: string
          summary: string | null
          template_id: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          active_version_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          current_version_id?: string | null
          document_class: string
          household_id: string
          id?: string
          is_financial?: boolean
          status?: string
          summary?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          active_version_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          current_version_id?: string | null
          document_class?: string
          household_id?: string
          id?: string
          is_financial?: boolean
          status?: string
          summary?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_documents_active_version_fk"
            columns: ["active_version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_documents_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_documents_current_version_fk"
            columns: ["current_version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_events: {
        Row: {
          actor_membership_id: string
          body: string | null
          created_at: string
          document_id: string
          event_type: string
          household_id: string
          id: string
          payload: Json
          version_id: string | null
        }
        Insert: {
          actor_membership_id: string
          body?: string | null
          created_at?: string
          document_id: string
          event_type: string
          household_id: string
          id?: string
          payload?: Json
          version_id?: string | null
        }
        Update: {
          actor_membership_id?: string
          body?: string | null
          created_at?: string
          document_id?: string
          event_type?: string
          household_id?: string
          id?: string
          payload?: Json
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_events_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_events_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_expense_refs: {
        Row: {
          category_label: string | null
          created_at: string
          created_by_membership_id: string
          document_id: string
          expense_id: string | null
          household_id: string
          id: string
          note: string | null
          threshold_cents: number | null
          version_id: string | null
        }
        Insert: {
          category_label?: string | null
          created_at?: string
          created_by_membership_id: string
          document_id: string
          expense_id?: string | null
          household_id: string
          id?: string
          note?: string | null
          threshold_cents?: number | null
          version_id?: string | null
        }
        Update: {
          category_label?: string | null
          created_at?: string
          created_by_membership_id?: string
          document_id?: string
          expense_id?: string | null
          household_id?: string
          id?: string
          note?: string | null
          threshold_cents?: number | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_expense_refs_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_expense_refs_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_expense_refs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_expense_refs_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_participants: {
        Row: {
          created_at: string
          document_id: string
          household_id: string
          id: string
          membership_id: string
          role: string
        }
        Insert: {
          created_at?: string
          document_id: string
          household_id: string
          id?: string
          membership_id: string
          role?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          household_id?: string
          id?: string
          membership_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_participants_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_participants_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_participants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_sections: {
        Row: {
          body: string | null
          created_at: string
          document_id: string
          heading: string | null
          household_id: string
          id: string
          payload: Json
          position: number
          section_type: string
          version_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          document_id: string
          heading?: string | null
          household_id: string
          id?: string
          payload?: Json
          position: number
          section_type: string
          version_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          document_id?: string
          heading?: string | null
          household_id?: string
          id?: string
          payload?: Json
          position?: number
          section_type?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_sections_document_id_household_id_fkey"
            columns: ["document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "governance_sections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_sections_version_id_household_id_fkey"
            columns: ["version_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_document_versions"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      governance_templates: {
        Row: {
          acknowledgment_rules: Json
          active: boolean
          approval_rules: Json
          created_at: string
          document_class: string
          household_id: string | null
          id: string
          is_system: boolean
          sections: Json
          summary: string | null
          template_key: string
          title: string
        }
        Insert: {
          acknowledgment_rules?: Json
          active?: boolean
          approval_rules?: Json
          created_at?: string
          document_class: string
          household_id?: string | null
          id?: string
          is_system?: boolean
          sections?: Json
          summary?: string | null
          template_key: string
          title: string
        }
        Update: {
          acknowledgment_rules?: Json
          active?: boolean
          approval_rules?: Json
          created_at?: string
          document_class?: string
          household_id?: string | null
          id?: string
          is_system?: boolean
          sections?: Json
          summary?: string | null
          template_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_templates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_notices: {
        Row: {
          acknowledgment_requested: boolean
          calendar_event_id: string | null
          created_at: string
          ends_at: string
          guest_count: number
          host_membership_id: string
          household_id: string
          id: string
          meal_participation: boolean
          note: string | null
          overnight: boolean
          parking_needed: boolean
          quiet_hours_exception: boolean
          shared_spaces: string | null
          starts_at: string
          status: string
          updated_at: string
          visit_date: string
        }
        Insert: {
          acknowledgment_requested?: boolean
          calendar_event_id?: string | null
          created_at?: string
          ends_at: string
          guest_count?: number
          host_membership_id: string
          household_id: string
          id?: string
          meal_participation?: boolean
          note?: string | null
          overnight?: boolean
          parking_needed?: boolean
          quiet_hours_exception?: boolean
          shared_spaces?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          visit_date: string
        }
        Update: {
          acknowledgment_requested?: boolean
          calendar_event_id?: string | null
          created_at?: string
          ends_at?: string
          guest_count?: number
          host_membership_id?: string
          household_id?: string
          id?: string
          meal_participation?: boolean
          note?: string | null
          overnight?: boolean
          parking_needed?: boolean
          quiet_hours_exception?: boolean
          shared_spaces?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_notices_host_membership_id_fkey"
            columns: ["host_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_calendar_memberships: {
        Row: {
          access_role: string
          calendar_id: string
          created_at: string
          household_id: string
          id: string
          membership_id: string
        }
        Insert: {
          access_role?: string
          calendar_id: string
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
        }
        Update: {
          access_role?: string
          calendar_id?: string
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_calendar_memberships_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "household_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_calendar_memberships_calendar_id_household_id_fkey"
            columns: ["calendar_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_calendars"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_calendar_memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_calendar_memberships_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_calendars: {
        Row: {
          calendar_type: string
          color_token: string | null
          created_at: string
          domain_source: string | null
          household_id: string
          id: string
          is_archived: boolean
          name: string
          owner_membership_id: string | null
          updated_at: string
          visibility_default: string
        }
        Insert: {
          calendar_type: string
          color_token?: string | null
          created_at?: string
          domain_source?: string | null
          household_id: string
          id?: string
          is_archived?: boolean
          name: string
          owner_membership_id?: string | null
          updated_at?: string
          visibility_default?: string
        }
        Update: {
          calendar_type?: string
          color_token?: string | null
          created_at?: string
          domain_source?: string | null
          household_id?: string
          id?: string
          is_archived?: boolean
          name?: string
          owner_membership_id?: string | null
          updated_at?: string
          visibility_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_calendars_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_calendars_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_directory_contacts: {
        Row: {
          created_at: string
          created_by_membership_id: string
          email: string | null
          household_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          role_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          email?: string | null
          household_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          email?: string | null
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_directory_contacts_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_directory_contacts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_emergency_cards: {
        Row: {
          breaker_panel_location: string | null
          created_at: string
          emergency_maintenance_number: string | null
          emergency_meeting_point: string | null
          fire_extinguisher_locations: string | null
          household_id: string
          id: string
          landlord_contact: string | null
          other_notes: string | null
          pet_instructions: string | null
          property_address: string | null
          updated_at: string
          updated_by_membership_id: string | null
          utility_emergency_contacts: string | null
          visibility: string
          water_shutoff_location: string | null
          wifi_details_protected: string | null
        }
        Insert: {
          breaker_panel_location?: string | null
          created_at?: string
          emergency_maintenance_number?: string | null
          emergency_meeting_point?: string | null
          fire_extinguisher_locations?: string | null
          household_id: string
          id?: string
          landlord_contact?: string | null
          other_notes?: string | null
          pet_instructions?: string | null
          property_address?: string | null
          updated_at?: string
          updated_by_membership_id?: string | null
          utility_emergency_contacts?: string | null
          visibility?: string
          water_shutoff_location?: string | null
          wifi_details_protected?: string | null
        }
        Update: {
          breaker_panel_location?: string | null
          created_at?: string
          emergency_maintenance_number?: string | null
          emergency_meeting_point?: string | null
          fire_extinguisher_locations?: string | null
          household_id?: string
          id?: string
          landlord_contact?: string | null
          other_notes?: string | null
          pet_instructions?: string | null
          property_address?: string | null
          updated_at?: string
          updated_by_membership_id?: string | null
          utility_emergency_contacts?: string | null
          visibility?: string
          water_shutoff_location?: string | null
          wifi_details_protected?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_emergency_cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_emergency_cards_updated_by_membership_id_fkey"
            columns: ["updated_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_text: string | null
          expires_at: string | null
          household_id: string
          id: string
          requested_by_membership_id: string
          result_meta: Json | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_text?: string | null
          expires_at?: string | null
          household_id: string
          id?: string
          requested_by_membership_id: string
          result_meta?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_text?: string | null
          expires_at?: string | null
          household_id?: string
          id?: string
          requested_by_membership_id?: string
          result_meta?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_export_jobs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_export_jobs_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_import_batches: {
        Row: {
          column_map: Json
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          domain: string
          error_summary: string | null
          file_name: string
          household_id: string
          id: string
          idempotency_key: string | null
          result_summary: Json | null
          row_count: number
          status: string
          updated_at: string
        }
        Insert: {
          column_map?: Json
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          domain: string
          error_summary?: string | null
          file_name: string
          household_id: string
          id?: string
          idempotency_key?: string | null
          result_summary?: Json | null
          row_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          column_map?: Json
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          domain?: string
          error_summary?: string | null
          file_name?: string
          household_id?: string
          id?: string
          idempotency_key?: string | null
          result_summary?: Json | null
          row_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_import_batches_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_import_batches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_import_rows: {
        Row: {
          batch_id: string
          created_at: string
          created_entity_id: string | null
          household_id: string
          id: string
          mapped: Json
          messages: string[]
          raw: Json
          row_number: number
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_entity_id?: string | null
          household_id: string
          id?: string
          mapped?: Json
          messages?: string[]
          raw?: Json
          row_number: number
          status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_entity_id?: string | null
          household_id?: string
          id?: string
          mapped?: Json
          messages?: string[]
          raw?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_import_rows_batch_id_household_id_fkey"
            columns: ["batch_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_import_batches"
            referencedColumns: ["id", "household_id"]
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
      household_meal_settings: {
        Row: {
          assume_staples_available: boolean
          created_at: string
          household_id: string
          shopping_prep_policy: string
          updated_at: string
        }
        Insert: {
          assume_staples_available?: boolean
          created_at?: string
          household_id: string
          shopping_prep_policy?: string
          updated_at?: string
        }
        Update: {
          assume_staples_available?: boolean
          created_at?: string
          household_id?: string
          shopping_prep_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meal_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_action_items: {
        Row: {
          blocking_note: string | null
          client_idempotency_key: string | null
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          decision_id: string | null
          due_date: string | null
          household_id: string
          id: string
          meeting_id: string
          owner_membership_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocking_note?: string | null
          client_idempotency_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          decision_id?: string | null
          due_date?: string | null
          household_id: string
          id?: string
          meeting_id: string
          owner_membership_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocking_note?: string | null
          client_idempotency_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          decision_id?: string | null
          due_date?: string | null
          household_id?: string
          id?: string
          meeting_id?: string
          owner_membership_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_action_items_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_action_items_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_action_items_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_meeting_action_items_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_agenda_items: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          deadline: string | null
          household_id: string
          id: string
          may_decide_in_meeting: boolean
          meeting_id: string
          required_participants: Json
          section_key: string
          sort_order: number
          source: string
          source_entity_id: string | null
          source_entity_type: string | null
          status: string
          title: string
          updated_at: string
          why_included: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          deadline?: string | null
          household_id: string
          id?: string
          may_decide_in_meeting?: boolean
          meeting_id: string
          required_participants?: Json
          section_key: string
          sort_order?: number
          source?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          title: string
          updated_at?: string
          why_included?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          deadline?: string | null
          household_id?: string
          id?: string
          may_decide_in_meeting?: boolean
          meeting_id?: string
          required_participants?: Json
          section_key?: string
          sort_order?: number
          source?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          why_included?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_agenda_items_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_agenda_items_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_meeting_decisions: {
        Row: {
          agenda_item_id: string | null
          client_idempotency_key: string | null
          created_at: string
          created_by_membership_id: string
          decision_text: string
          household_id: string
          id: string
          meeting_id: string
          owner_membership_id: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id: string
          decision_text: string
          household_id: string
          id?: string
          meeting_id: string
          owner_membership_id?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id?: string
          decision_text?: string
          household_id?: string
          id?: string
          meeting_id?: string
          owner_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_decisions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_decisions_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_decisions_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_meeting_decisions_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_notes: {
        Row: {
          action_items: Json
          agenda: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          meeting_at: string
          outcomes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_items?: Json
          agenda?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          meeting_at: string
          outcomes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_items?: Json
          agenda?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          meeting_at?: string
          outcomes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_notes_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_packet_versions: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          household_id: string
          id: string
          kind: string
          meeting_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          household_id: string
          id?: string
          kind: string
          meeting_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          household_id?: string
          id?: string
          kind?: string
          meeting_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_packet_versions_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_packet_versions_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_meeting_participants: {
        Row: {
          acknowledged_packet_at: string | null
          attended: boolean | null
          created_at: string
          household_id: string
          id: string
          meeting_id: string
          membership_id: string
          role: string
        }
        Insert: {
          acknowledged_packet_at?: string | null
          attended?: boolean | null
          created_at?: string
          household_id: string
          id?: string
          meeting_id: string
          membership_id: string
          role?: string
        }
        Update: {
          acknowledged_packet_at?: string | null
          attended?: boolean | null
          created_at?: string
          household_id?: string
          id?: string
          meeting_id?: string
          membership_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_participants_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_meeting_participants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_preferences: {
        Row: {
          agenda_rules_version: string
          auto_create_calendar: boolean
          created_at: string
          household_id: string
          maintenance_wait_days: number
          preferred_time_local: string | null
          purchase_deadline_days: number
          recurrence_rule: string | null
          reminder_packet_hours: number
          reminder_prep_hours: number
          share_pairwise_balances: boolean
          timezone: string
          updated_at: string
          updated_by_membership_id: string | null
          utility_variance_pct: number
        }
        Insert: {
          agenda_rules_version?: string
          auto_create_calendar?: boolean
          created_at?: string
          household_id: string
          maintenance_wait_days?: number
          preferred_time_local?: string | null
          purchase_deadline_days?: number
          recurrence_rule?: string | null
          reminder_packet_hours?: number
          reminder_prep_hours?: number
          share_pairwise_balances?: boolean
          timezone?: string
          updated_at?: string
          updated_by_membership_id?: string | null
          utility_variance_pct?: number
        }
        Update: {
          agenda_rules_version?: string
          auto_create_calendar?: boolean
          created_at?: string
          household_id?: string
          maintenance_wait_days?: number
          preferred_time_local?: string | null
          purchase_deadline_days?: number
          recurrence_rule?: string | null
          reminder_packet_hours?: number
          reminder_prep_hours?: number
          share_pairwise_balances?: boolean
          timezone?: string
          updated_at?: string
          updated_by_membership_id?: string | null
          utility_variance_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_preferences_updated_by_membership_id_fkey"
            columns: ["updated_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_record_links: {
        Row: {
          action_item_id: string | null
          client_idempotency_key: string | null
          created_at: string
          created_by_membership_id: string
          decision_id: string | null
          entity_id: string
          entity_type: string
          household_id: string
          id: string
          meeting_id: string
        }
        Insert: {
          action_item_id?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id: string
          decision_id?: string | null
          entity_id: string
          entity_type: string
          household_id: string
          id?: string
          meeting_id: string
        }
        Update: {
          action_item_id?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id?: string
          decision_id?: string | null
          entity_id?: string
          entity_type?: string
          household_id?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_record_links_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_record_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_record_links_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_record_links_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_meeting_sections: {
        Row: {
          created_at: string
          discussed_at: string | null
          household_id: string
          id: string
          included: boolean
          informational_only: boolean
          meeting_id: string
          organizer_note: string | null
          section_key: string
          skipped_at: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discussed_at?: string | null
          household_id: string
          id?: string
          included?: boolean
          informational_only?: boolean
          meeting_id: string
          organizer_note?: string | null
          section_key: string
          skipped_at?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discussed_at?: string | null
          household_id?: string
          id?: string
          included?: boolean
          informational_only?: boolean
          meeting_id?: string
          organizer_note?: string | null
          section_key?: string
          skipped_at?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_sections_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_meeting_session_notes: {
        Row: {
          agenda_item_id: string | null
          body: string
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          meeting_id: string
          parking_lot: boolean
          section_key: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          body: string
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          meeting_id: string
          parking_lot?: boolean
          section_key?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          body?: string
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          meeting_id?: string
          parking_lot?: boolean
          section_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_session_notes_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_session_notes_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_session_notes_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_meeting_snapshot_values: {
        Row: {
          created_at: string
          household_id: string
          id: string
          snapshot_id: string
          source_entity_id: string | null
          source_entity_type: string | null
          source_updated_at: string | null
          value_json: Json
          value_key: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          snapshot_id: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_updated_at?: string | null
          value_json: Json
          value_key: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          snapshot_id?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_updated_at?: string | null
          value_json?: Json
          value_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_snapshot_values_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meeting_snapshots: {
        Row: {
          created_at: string
          household_id: string
          id: string
          meeting_id: string
          membership_id: string | null
          packet_version_id: string
          payload: Json
          projection: string
          source_freshness: Json
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          meeting_id: string
          membership_id?: string | null
          packet_version_id: string
          payload?: Json
          projection: string
          source_freshness?: Json
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          meeting_id?: string
          membership_id?: string | null
          packet_version_id?: string
          payload?: Json
          projection?: string
          source_freshness?: Json
        }
        Relationships: [
          {
            foreignKeyName: "household_meeting_snapshots_meeting_id_household_id_fkey"
            columns: ["meeting_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_meetings"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_meeting_snapshots_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meeting_snapshots_packet_version_id_fkey"
            columns: ["packet_version_id"]
            isOneToOne: false
            referencedRelation: "household_meeting_packet_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meetings: {
        Row: {
          archived_at: string | null
          calendar_event_id: string | null
          cancelled_at: string | null
          client_idempotency_key: string | null
          comparison_period_end: string | null
          comparison_period_start: string | null
          completed_at: string | null
          created_at: string
          data_snapshot_at: string | null
          household_id: string
          id: string
          locked_at: string | null
          meeting_at: string | null
          organizer_membership_id: string
          packet_version: number
          period_end: string
          period_start: string
          published_at: string | null
          source_version: string
          started_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          calendar_event_id?: string | null
          cancelled_at?: string | null
          client_idempotency_key?: string | null
          comparison_period_end?: string | null
          comparison_period_start?: string | null
          completed_at?: string | null
          created_at?: string
          data_snapshot_at?: string | null
          household_id: string
          id?: string
          locked_at?: string | null
          meeting_at?: string | null
          organizer_membership_id: string
          packet_version?: number
          period_end: string
          period_start: string
          published_at?: string | null
          source_version?: string
          started_at?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          calendar_event_id?: string | null
          cancelled_at?: string | null
          client_idempotency_key?: string | null
          comparison_period_end?: string | null
          comparison_period_start?: string | null
          completed_at?: string | null
          created_at?: string
          data_snapshot_at?: string | null
          household_id?: string
          id?: string
          locked_at?: string | null
          meeting_at?: string | null
          organizer_membership_id?: string
          packet_version?: number
          period_end?: string
          period_start?: string
          published_at?: string | null
          source_version?: string
          started_at?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_meetings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meetings_organizer_membership_id_fkey"
            columns: ["organizer_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
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
      household_packages: {
        Row: {
          carrier: string | null
          claimed_at: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          location_note: string | null
          photo_storage_path: string | null
          recipient_membership_id: string | null
          status: string
          tracking_private: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          location_note?: string | null
          photo_storage_path?: string | null
          recipient_membership_id?: string | null
          status?: string
          tracking_private?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          location_note?: string | null
          photo_storage_path?: string | null
          recipient_membership_id?: string | null
          status?: string
          tracking_private?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_packages_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_packages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_packages_recipient_membership_id_fkey"
            columns: ["recipient_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_parking_assignments: {
        Row: {
          created_at: string
          ends_on: string | null
          household_id: string
          id: string
          membership_id: string
          spot_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          household_id: string
          id?: string
          membership_id: string
          spot_id: string
          starts_on?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          household_id?: string
          id?: string
          membership_id?: string
          spot_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_parking_assignments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_parking_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_parking_assignments_spot_id_household_id_fkey"
            columns: ["spot_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_parking_spots"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_parking_spots: {
        Row: {
          active: boolean
          created_at: string
          household_id: string
          id: string
          label: string
          notes: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          household_id: string
          id?: string
          label: string
          notes?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_parking_spots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_poll_options: {
        Row: {
          household_id: string
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          household_id: string
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          household_id?: string
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_poll_options_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_poll_options_poll_id_household_id_fkey"
            columns: ["poll_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_polls"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_poll_votes: {
        Row: {
          created_at: string
          household_id: string
          id: string
          membership_id: string
          option_id: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
          option_id: string
          poll_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          option_id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_poll_votes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_poll_votes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_poll_votes_option_id_household_id_fkey"
            columns: ["option_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_poll_options"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_poll_votes_poll_id_household_id_fkey"
            columns: ["poll_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_polls"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_polls: {
        Row: {
          allow_multiple: boolean
          anonymous: boolean
          created_at: string
          created_by_membership_id: string
          deadline_at: string | null
          household_id: string
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          anonymous?: boolean
          created_at?: string
          created_by_membership_id: string
          deadline_at?: string | null
          household_id: string
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          anonymous?: boolean
          created_at?: string
          created_by_membership_id?: string
          deadline_at?: string | null
          household_id?: string
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_polls_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_polls_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_retention_policies: {
        Row: {
          household_id: string
          receipt_image_retention_days: number | null
          soft_delete_preview_required: boolean
          updated_at: string
        }
        Insert: {
          household_id: string
          receipt_image_retention_days?: number | null
          soft_delete_preview_required?: boolean
          updated_at?: string
        }
        Update: {
          household_id?: string
          receipt_image_retention_days?: number | null
          soft_delete_preview_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_retention_policies_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
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
      household_setup_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          dismissed_at?: string | null
          household_id: string
          id?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          dismissed_at?: string | null
          household_id?: string
          id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_setup_progress_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_transition_events: {
        Row: {
          actor_membership_id: string
          body: string | null
          created_at: string
          event_type: string
          household_id: string
          id: string
          payload: Json
          workflow_id: string
        }
        Insert: {
          actor_membership_id: string
          body?: string | null
          created_at?: string
          event_type: string
          household_id: string
          id?: string
          payload?: Json
          workflow_id: string
        }
        Update: {
          actor_membership_id?: string
          body?: string | null
          created_at?: string
          event_type?: string
          household_id?: string
          id?: string
          payload?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_events_workflow_id_household_id_fkey"
            columns: ["workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_transition_inventory_links: {
        Row: {
          confirmed: boolean
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          inventory_item_id: string
          link_kind: string
          note: string | null
          workflow_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          inventory_item_id: string
          link_kind: string
          note?: string | null
          workflow_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          inventory_item_id?: string
          link_kind?: string
          note?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_inventor_inventory_item_id_household__fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_inventory_li_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_inventory_li_workflow_id_household_id_fkey"
            columns: ["workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_inventory_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_transition_maintenance_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          maintenance_request_id: string
          note: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          maintenance_request_id: string
          note?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          maintenance_request_id?: string
          note?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_maintena_maintenance_request_id_house_fkey"
            columns: ["maintenance_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_maintenance__created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_maintenance__workflow_id_household_id_fkey"
            columns: ["workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_maintenance_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_transition_private_fields: {
        Row: {
          created_at: string
          field_kind: string
          household_id: string
          id: string
          label: string | null
          owner_membership_id: string
          updated_at: string
          value_text: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          field_kind: string
          household_id: string
          id?: string
          label?: string | null
          owner_membership_id: string
          updated_at?: string
          value_text: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          field_kind?: string
          household_id?: string
          id?: string
          label?: string | null
          owner_membership_id?: string
          updated_at?: string
          value_text?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_private_fiel_workflow_id_household_id_fkey"
            columns: ["workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_private_fields_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_private_fields_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_transition_private_grants: {
        Row: {
          created_at: string
          granted_by_membership_id: string
          grantee_membership_id: string
          household_id: string
          id: string
          private_field_id: string
        }
        Insert: {
          created_at?: string
          granted_by_membership_id: string
          grantee_membership_id: string
          household_id: string
          id?: string
          private_field_id: string
        }
        Update: {
          created_at?: string
          granted_by_membership_id?: string
          grantee_membership_id?: string
          household_id?: string
          id?: string
          private_field_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_private__private_field_id_household_i_fkey"
            columns: ["private_field_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_private_fields"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_private_gran_granted_by_membership_id_fkey"
            columns: ["granted_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_private_grants_grantee_membership_id_fkey"
            columns: ["grantee_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_private_grants_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_transition_tasks: {
        Row: {
          assignee_membership_id: string | null
          completed_at: string | null
          completed_by_membership_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          household_id: string
          id: string
          linked_chore_occurrence_id: string | null
          linked_expense_id: string | null
          linked_inventory_item_id: string | null
          linked_maintenance_request_id: string | null
          position: number
          requires_explicit_confirmation: boolean
          status: string
          task_key: string
          title: string
          workflow_id: string
        }
        Insert: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          completed_by_membership_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          household_id: string
          id?: string
          linked_chore_occurrence_id?: string | null
          linked_expense_id?: string | null
          linked_inventory_item_id?: string | null
          linked_maintenance_request_id?: string | null
          position?: number
          requires_explicit_confirmation?: boolean
          status?: string
          task_key: string
          title: string
          workflow_id: string
        }
        Update: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          completed_by_membership_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          household_id?: string
          id?: string
          linked_chore_occurrence_id?: string | null
          linked_expense_id?: string | null
          linked_inventory_item_id?: string | null
          linked_maintenance_request_id?: string | null
          position?: number
          requires_explicit_confirmation?: boolean
          status?: string
          task_key?: string
          title?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_tasks_assignee_membership_id_fkey"
            columns: ["assignee_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_tasks_completed_by_membership_id_fkey"
            columns: ["completed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_tasks_workflow_id_household_id_fkey"
            columns: ["workflow_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_transition_workflows"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_transition_workflows: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          completion_notes: string | null
          coordinator_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          linked_document_id: string | null
          membership_removal_scheduled_at: string | null
          membership_removed_at: string | null
          notice_date: string | null
          planned_date: string | null
          room_assignment: string | null
          status: string
          subject_membership_id: string
          updated_at: string
          visibility: string
          workflow_type: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          coordinator_membership_id?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          linked_document_id?: string | null
          membership_removal_scheduled_at?: string | null
          membership_removed_at?: string | null
          notice_date?: string | null
          planned_date?: string | null
          room_assignment?: string | null
          status?: string
          subject_membership_id: string
          updated_at?: string
          visibility?: string
          workflow_type: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          coordinator_membership_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          linked_document_id?: string | null
          membership_removal_scheduled_at?: string | null
          membership_removed_at?: string | null
          notice_date?: string | null
          planned_date?: string | null
          room_assignment?: string | null
          status?: string
          subject_membership_id?: string
          updated_at?: string
          visibility?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_transition_workflow_linked_document_id_household_fkey"
            columns: ["linked_document_id", "household_id"]
            isOneToOne: false
            referencedRelation: "governance_documents"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "household_transition_workflows_coordinator_membership_id_fkey"
            columns: ["coordinator_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_workflows_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_workflows_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_transition_workflows_subject_membership_id_fkey"
            columns: ["subject_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      household_utilities: {
        Row: {
          account_owner_membership_id: string | null
          actual_amount_cents: number | null
          calendar_event_id: string | null
          category: string
          created_at: string
          due_day_of_month: number | null
          estimated_amount_cents: number | null
          expense_id: string | null
          household_id: string
          id: string
          name: string
          notes: string | null
          payment_status: string
          recurrence: string
          reminder_enabled: boolean
          split_policy: string
          updated_at: string
        }
        Insert: {
          account_owner_membership_id?: string | null
          actual_amount_cents?: number | null
          calendar_event_id?: string | null
          category?: string
          created_at?: string
          due_day_of_month?: number | null
          estimated_amount_cents?: number | null
          expense_id?: string | null
          household_id: string
          id?: string
          name: string
          notes?: string | null
          payment_status?: string
          recurrence?: string
          reminder_enabled?: boolean
          split_policy?: string
          updated_at?: string
        }
        Update: {
          account_owner_membership_id?: string | null
          actual_amount_cents?: number | null
          calendar_event_id?: string | null
          category?: string
          created_at?: string
          due_day_of_month?: number | null
          estimated_amount_cents?: number | null
          expense_id?: string | null
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          payment_status?: string
          recurrence?: string
          reminder_enabled?: boolean
          split_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_utilities_account_owner_membership_id_fkey"
            columns: ["account_owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_utilities_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_weekly_reviews: {
        Row: {
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          payload: Json
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          payload?: Json
          week_start: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          payload?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_weekly_reviews_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_weekly_reviews_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
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
          parking_module_enabled: boolean
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
          parking_module_enabled?: boolean
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
          parking_module_enabled?: boolean
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
      maintenance_actions: {
        Row: {
          assignee_membership_id: string | null
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          description: string | null
          household_id: string
          id: string
          request_id: string
          status: string
          title: string
        }
        Insert: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          household_id: string
          id?: string
          request_id: string
          status?: string
          title: string
        }
        Update: {
          assignee_membership_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          household_id?: string
          id?: string
          request_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_actions_assignee_membership_id_fkey"
            columns: ["assignee_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_actions_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_actions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_actions_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_assignments: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          household_id: string
          id: string
          is_primary: boolean
          membership_id: string
          request_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          household_id: string
          id?: string
          is_primary?: boolean
          membership_id: string
          request_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          household_id?: string
          id?: string
          is_primary?: boolean
          membership_id?: string
          request_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_assignments_assigned_by_membership_id_fkey"
            columns: ["assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_assignments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_assignments_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_name: string
          household_id: string
          id: string
          mime_type: string
          request_id: string
          size_bytes: number
          storage_path: string
          uploaded_by_membership_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_name: string
          household_id: string
          id?: string
          mime_type: string
          request_id: string
          size_bytes: number
          storage_path: string
          uploaded_by_membership_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          household_id?: string
          id?: string
          mime_type?: string
          request_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_attachments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_attachments_uploaded_by_membership_id_fkey"
            columns: ["uploaded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_calendar_links: {
        Row: {
          appointment_kind: string
          calendar_event_id: string
          cancelled_at: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          request_id: string
        }
        Insert: {
          appointment_kind?: string
          calendar_event_id: string
          cancelled_at?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          request_id: string
        }
        Update: {
          appointment_kind?: string
          calendar_event_id?: string
          cancelled_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_calendar_links_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_calendar_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_calendar_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_calendar_links_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_chore_links: {
        Row: {
          chore_definition_id: string | null
          chore_occurrence_id: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          request_id: string
          unlinked_at: string | null
        }
        Insert: {
          chore_definition_id?: string | null
          chore_occurrence_id?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          request_id: string
          unlinked_at?: string | null
        }
        Update: {
          chore_definition_id?: string | null
          chore_occurrence_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          request_id?: string
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_chore_links_chore_definition_id_household_id_fkey"
            columns: ["chore_definition_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_definitions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_chore_links_chore_occurrence_id_household_id_fkey"
            columns: ["chore_occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_chore_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_chore_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_chore_links_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_contact_events: {
        Row: {
          contact_id: string
          created_at: string
          event_kind: string
          follow_up_at: string | null
          household_id: string
          id: string
          notes: string | null
          recorded_by_membership_id: string
          reference_number: string | null
          request_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_kind: string
          follow_up_at?: string | null
          household_id: string
          id?: string
          notes?: string | null
          recorded_by_membership_id: string
          reference_number?: string | null
          request_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_kind?: string
          follow_up_at?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          recorded_by_membership_id?: string
          reference_number?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_contact_events_contact_id_household_id_fkey"
            columns: ["contact_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_external_contacts"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_contact_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contact_events_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_contact_events_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_events: {
        Row: {
          actor_membership_id: string
          body: string | null
          created_at: string
          event_type: string
          household_id: string
          id: string
          payload: Json
          request_id: string
        }
        Insert: {
          actor_membership_id: string
          body?: string | null
          created_at?: string
          event_type: string
          household_id: string
          id?: string
          payload?: Json
          request_id: string
        }
        Update: {
          actor_membership_id?: string
          body?: string | null
          created_at?: string
          event_type?: string
          household_id?: string
          id?: string
          payload?: Json
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_events_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_expense_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          expense_id: string
          expense_item_id: string | null
          household_id: string
          id: string
          link_kind: string
          request_id: string
          unlinked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          expense_id: string
          expense_item_id?: string | null
          household_id: string
          id?: string
          link_kind?: string
          request_id: string
          unlinked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          expense_id?: string
          expense_item_id?: string | null
          household_id?: string
          id?: string
          link_kind?: string
          request_id?: string
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_expense_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_expense_links_expense_id_household_id_fkey"
            columns: ["expense_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_expense_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_expense_links_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_external_contacts: {
        Row: {
          active: boolean
          contact_type: string
          created_at: string
          created_by_membership_id: string
          display_name: string
          email: string | null
          household_id: string
          id: string
          last_contacted_at: string | null
          notes: string | null
          organization: string | null
          phone: string | null
          preferred: boolean
          service_categories: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          contact_type: string
          created_at?: string
          created_by_membership_id: string
          display_name: string
          email?: string | null
          household_id: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          organization?: string | null
          phone?: string | null
          preferred?: boolean
          service_categories?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          contact_type?: string
          created_at?: string
          created_by_membership_id?: string
          display_name?: string
          email?: string | null
          household_id?: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          organization?: string | null
          phone?: string | null
          preferred?: boolean
          service_categories?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_external_contacts_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_external_contacts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_inventory_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          inventory_item_id: string
          request_id: string
          unlinked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          inventory_item_id: string
          request_id: string
          unlinked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          inventory_item_id?: string
          request_id?: string
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_inventory_links_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inventory_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inventory_links_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_inventory_links_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_quotes: {
        Row: {
          amount_cents: number
          contact_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          household_id: string
          id: string
          notes: string | null
          recorded_by_membership_id: string
          request_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          household_id: string
          id?: string
          notes?: string | null
          recorded_by_membership_id: string
          request_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          recorded_by_membership_id?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_quotes_contact_id_household_id_fkey"
            columns: ["contact_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_external_contacts"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_quotes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_quotes_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_quotes_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_request_participants: {
        Row: {
          created_at: string
          household_id: string
          id: string
          membership_id: string
          request_id: string
          role: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
          request_id: string
          role?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          request_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_request_participants_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_request_participants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_request_participants_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          cancelled_at: string | null
          category: string
          closed_at: string | null
          created_at: string
          currently_active: boolean
          decision_outcome: string | null
          description: string | null
          estimated_cost_cents: number | null
          first_noticed_at: string | null
          hazard_flags: string[]
          household_id: string
          id: string
          immediate_mitigation: string | null
          inventory_item_id: string | null
          landlord_involvement: boolean
          landlord_workflow_status: string | null
          linked_as_recurrence_of: string | null
          location_id: string | null
          primary_coordinator_membership_id: string | null
          quoted_cost_cents: number | null
          reporter_membership_id: string
          resolution_notes: string | null
          resolved_at: string | null
          responsibility_area_id: string | null
          severity: string
          status: string
          stop_use: boolean
          suggested_coordinator_membership_id: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          cancelled_at?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          currently_active?: boolean
          decision_outcome?: string | null
          description?: string | null
          estimated_cost_cents?: number | null
          first_noticed_at?: string | null
          hazard_flags?: string[]
          household_id: string
          id?: string
          immediate_mitigation?: string | null
          inventory_item_id?: string | null
          landlord_involvement?: boolean
          landlord_workflow_status?: string | null
          linked_as_recurrence_of?: string | null
          location_id?: string | null
          primary_coordinator_membership_id?: string | null
          quoted_cost_cents?: number | null
          reporter_membership_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsibility_area_id?: string | null
          severity?: string
          status?: string
          stop_use?: boolean
          suggested_coordinator_membership_id?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          cancelled_at?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          currently_active?: boolean
          decision_outcome?: string | null
          description?: string | null
          estimated_cost_cents?: number | null
          first_noticed_at?: string | null
          hazard_flags?: string[]
          household_id?: string
          id?: string
          immediate_mitigation?: string | null
          inventory_item_id?: string | null
          landlord_involvement?: boolean
          landlord_workflow_status?: string | null
          linked_as_recurrence_of?: string | null
          location_id?: string | null
          primary_coordinator_membership_id?: string | null
          quoted_cost_cents?: number | null
          reporter_membership_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          responsibility_area_id?: string | null
          severity?: string
          status?: string
          stop_use?: boolean
          suggested_coordinator_membership_id?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_requests_linked_as_recurrence_of_household_id_fkey"
            columns: ["linked_as_recurrence_of", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_requests_location_id_household_id_fkey"
            columns: ["location_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_requests_primary_coordinator_membership_id_fkey"
            columns: ["primary_coordinator_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_reporter_membership_id_fkey"
            columns: ["reporter_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_responsibility_area_id_household_id_fkey"
            columns: ["responsibility_area_id", "household_id"]
            isOneToOne: false
            referencedRelation: "responsibility_areas"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_requests_suggested_coordinator_membership_id_fkey"
            columns: ["suggested_coordinator_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_warranty_claims: {
        Row: {
          claim_reference: string | null
          created_at: string
          follow_up_at: string | null
          household_id: string
          id: string
          inventory_item_id: string | null
          notes: string | null
          recorded_by_membership_id: string
          request_id: string
          status: string
        }
        Insert: {
          claim_reference?: string | null
          created_at?: string
          follow_up_at?: string | null
          household_id: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          recorded_by_membership_id: string
          request_id: string
          status?: string
        }
        Update: {
          claim_reference?: string | null
          created_at?: string
          follow_up_at?: string | null
          household_id?: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          recorded_by_membership_id?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_warranty_claims_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_warranty_claims_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "maintenance_warranty_claims_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_warranty_claims_request_id_household_id_fkey"
            columns: ["request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_attendees: {
        Row: {
          attendance_status: string
          created_at: string
          guest_count: number
          household_id: string
          id: string
          meal_plan_id: string
          membership_id: string
          updated_at: string
        }
        Insert: {
          attendance_status?: string
          created_at?: string
          guest_count?: number
          household_id: string
          id?: string
          meal_plan_id: string
          membership_id: string
          updated_at?: string
        }
        Update: {
          attendance_status?: string
          created_at?: string
          guest_count?: number
          household_id?: string
          id?: string
          meal_plan_id?: string
          membership_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_attendees_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_attendees_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_attendees_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_batch_stock_events: {
        Row: {
          batch_id: string
          created_at: string
          event_type: string
          household_id: string
          id: string
          new_remaining_state: string | null
          note: string | null
          previous_remaining_state: string | null
          recorded_by_membership_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          event_type: string
          household_id: string
          id?: string
          new_remaining_state?: string | null
          note?: string | null
          previous_remaining_state?: string | null
          recorded_by_membership_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          event_type?: string
          household_id?: string
          id?: string
          new_remaining_state?: string | null
          note?: string | null
          previous_remaining_state?: string | null
          recorded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_batch_stock_events_batch_id_household_id_fkey"
            columns: ["batch_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_prep_batches"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_batch_stock_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_batch_stock_events_recorded_by_membership_id_fkey"
            columns: ["recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          household_id: string
          id: string
          meal_plan_id: string
          membership_id: string
        }
        Insert: {
          assignment_type: string
          created_at?: string
          household_id: string
          id?: string
          meal_plan_id: string
          membership_id: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          household_id?: string
          id?: string
          meal_plan_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_assignments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_assignments_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plan_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_chore_links: {
        Row: {
          chore_occurrence_id: string | null
          created_at: string
          household_id: string
          id: string
          link_kind: string
          meal_plan_id: string
        }
        Insert: {
          chore_occurrence_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          link_kind: string
          meal_plan_id: string
        }
        Update: {
          chore_occurrence_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          link_kind?: string
          meal_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_chore_links_chore_occurrence_id_household_id_fkey"
            columns: ["chore_occurrence_id", "household_id"]
            isOneToOne: false
            referencedRelation: "chore_occurrences"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plan_chore_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_chore_links_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_plan_expense_links: {
        Row: {
          created_at: string
          expense_id: string
          household_id: string
          id: string
          meal_plan_id: string
          suggestion: Json | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          household_id: string
          id?: string
          meal_plan_id: string
          suggestion?: Json | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          household_id?: string
          id?: string
          meal_plan_id?: string
          suggestion?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_expense_links_expense_id_household_id_fkey"
            columns: ["expense_id", "household_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plan_expense_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_expense_links_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_plan_ingredients: {
        Row: {
          checklist_status: string
          created_at: string
          display_name: string
          household_id: string
          id: string
          meal_plan_id: string
          normalized_name: string
          pantry_item_id: string | null
          pantry_match_status: string | null
          pantry_shortfall_quantity: number | null
          quantity_mode: string
          quantity_unit: string
          recipe_ingredient_id: string | null
          required: boolean
          required_quantity: number | null
          scaled_quantity: number | null
          shopping_list_item_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          checklist_status?: string
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          meal_plan_id: string
          normalized_name: string
          pantry_item_id?: string | null
          pantry_match_status?: string | null
          pantry_shortfall_quantity?: number | null
          quantity_mode?: string
          quantity_unit?: string
          recipe_ingredient_id?: string | null
          required?: boolean
          required_quantity?: number | null
          scaled_quantity?: number | null
          shopping_list_item_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checklist_status?: string
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          meal_plan_id?: string
          normalized_name?: string
          pantry_item_id?: string | null
          pantry_match_status?: string | null
          pantry_shortfall_quantity?: number | null
          quantity_mode?: string
          quantity_unit?: string
          recipe_ingredient_id?: string | null
          required?: boolean
          required_quantity?: number | null
          scaled_quantity?: number | null
          shopping_list_item_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_ingredients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_ingredients_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plan_ingredients_pantry_item_id_household_id_fkey"
            columns: ["pantry_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plan_ingredients_recipe_ingredient_id_household_id_fkey"
            columns: ["recipe_ingredient_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          buffer_servings: number
          calendar_event_id: string | null
          cancelled_at: string | null
          cleanup_membership_id: string | null
          cooking_membership_id: string | null
          created_at: string
          created_by_membership_id: string
          custom_meal_name: string | null
          desired_leftover_servings: number
          ends_at: string | null
          guest_cost_policy: string
          guest_count: number
          guest_dietary_note: string | null
          guest_label: string | null
          host_membership_id: string | null
          household_id: string
          id: string
          meal_date: string
          meal_request_id: string | null
          meal_type: string
          notes: string | null
          organizer_membership_id: string
          possible_guest_count: number
          prepared_at: string | null
          recipe_id: string | null
          starts_at: string | null
          status: string
          target_servings: number
          time_zone: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          buffer_servings?: number
          calendar_event_id?: string | null
          cancelled_at?: string | null
          cleanup_membership_id?: string | null
          cooking_membership_id?: string | null
          created_at?: string
          created_by_membership_id: string
          custom_meal_name?: string | null
          desired_leftover_servings?: number
          ends_at?: string | null
          guest_cost_policy?: string
          guest_count?: number
          guest_dietary_note?: string | null
          guest_label?: string | null
          host_membership_id?: string | null
          household_id: string
          id?: string
          meal_date: string
          meal_request_id?: string | null
          meal_type: string
          notes?: string | null
          organizer_membership_id: string
          possible_guest_count?: number
          prepared_at?: string | null
          recipe_id?: string | null
          starts_at?: string | null
          status?: string
          target_servings?: number
          time_zone?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          buffer_servings?: number
          calendar_event_id?: string | null
          cancelled_at?: string | null
          cleanup_membership_id?: string | null
          cooking_membership_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          custom_meal_name?: string | null
          desired_leftover_servings?: number
          ends_at?: string | null
          guest_cost_policy?: string
          guest_count?: number
          guest_dietary_note?: string | null
          guest_label?: string | null
          host_membership_id?: string | null
          household_id?: string
          id?: string
          meal_date?: string
          meal_request_id?: string | null
          meal_type?: string
          notes?: string | null
          organizer_membership_id?: string
          possible_guest_count?: number
          prepared_at?: string | null
          recipe_id?: string | null
          starts_at?: string | null
          status?: string
          target_servings?: number
          time_zone?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_cleanup_membership_id_fkey"
            columns: ["cleanup_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_cooking_membership_id_fkey"
            columns: ["cooking_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_host_membership_id_fkey"
            columns: ["host_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_plans_organizer_membership_id_fkey"
            columns: ["organizer_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_prep_batches: {
        Row: {
          approximate_starting_quantity: number | null
          availability: string
          created_at: string
          discarded_at: string | null
          finished_at: string | null
          household_id: string
          id: string
          location_id: string | null
          meal_plan_id: string | null
          name: string
          notes: string | null
          owner_membership_id: string | null
          prepared_at: string
          prepared_by_membership_id: string
          quantity_unit: string
          recipe_id: string | null
          related_pantry_item_id: string | null
          remaining_state: string
          review_by: string | null
          updated_at: string
          use_by: string | null
        }
        Insert: {
          approximate_starting_quantity?: number | null
          availability?: string
          created_at?: string
          discarded_at?: string | null
          finished_at?: string | null
          household_id: string
          id?: string
          location_id?: string | null
          meal_plan_id?: string | null
          name: string
          notes?: string | null
          owner_membership_id?: string | null
          prepared_at?: string
          prepared_by_membership_id: string
          quantity_unit?: string
          recipe_id?: string | null
          related_pantry_item_id?: string | null
          remaining_state?: string
          review_by?: string | null
          updated_at?: string
          use_by?: string | null
        }
        Update: {
          approximate_starting_quantity?: number | null
          availability?: string
          created_at?: string
          discarded_at?: string | null
          finished_at?: string | null
          household_id?: string
          id?: string
          location_id?: string | null
          meal_plan_id?: string | null
          name?: string
          notes?: string | null
          owner_membership_id?: string | null
          prepared_at?: string
          prepared_by_membership_id?: string
          quantity_unit?: string
          recipe_id?: string | null
          related_pantry_item_id?: string | null
          remaining_state?: string
          review_by?: string | null
          updated_at?: string
          use_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_prep_batches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_prep_batches_location_id_household_id_fkey"
            columns: ["location_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_locations"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_prep_batches_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_prep_batches_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_prep_batches_prepared_by_membership_id_fkey"
            columns: ["prepared_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_prep_batches_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_prep_batches_related_pantry_item_id_household_id_fkey"
            columns: ["related_pantry_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_request_attendees: {
        Row: {
          created_at: string
          household_id: string
          id: string
          meal_request_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          meal_request_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          meal_request_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_request_attendees_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_request_attendees_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_request_attendees_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_request_constraints: {
        Row: {
          constraint_type: string
          created_at: string
          household_id: string
          id: string
          meal_request_id: string
          value: string
        }
        Insert: {
          constraint_type: string
          created_at?: string
          household_id: string
          id?: string
          meal_request_id: string
          value: string
        }
        Update: {
          constraint_type?: string
          created_at?: string
          household_id?: string
          id?: string
          meal_request_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_request_constraints_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_request_constraints_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_request_guest_constraints: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          meal_request_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label: string
          meal_request_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          meal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_request_guest_constraint_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_request_guest_constraints_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_request_results: {
        Row: {
          created_at: string
          explanation: Json
          household_id: string
          id: string
          meal_request_id: string
          missing_required: number
          pantry_coverage_ratio: number | null
          preference_fit_summary: string
          rank_position: number
          recipe_id: string
          recommendation_run_id: string | null
          score: number
          warnings: Json
        }
        Insert: {
          created_at?: string
          explanation?: Json
          household_id: string
          id?: string
          meal_request_id: string
          missing_required?: number
          pantry_coverage_ratio?: number | null
          preference_fit_summary?: string
          rank_position: number
          recipe_id: string
          recommendation_run_id?: string | null
          score?: number
          warnings?: Json
        }
        Update: {
          created_at?: string
          explanation?: Json
          household_id?: string
          id?: string
          meal_request_id?: string
          missing_required?: number
          pantry_coverage_ratio?: number | null
          preference_fit_summary?: string
          rank_position?: number
          recipe_id?: string
          recommendation_run_id?: string | null
          score?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meal_request_results_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_request_results_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_request_results_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_requests: {
        Row: {
          accepted_meal_plan_id: string | null
          created_at: string
          created_by_membership_id: string
          date_range_end: string | null
          desired_servings: number | null
          expected_household_attendees: number | null
          guest_count: number
          household_id: string
          id: string
          inputs_changed_at: string | null
          last_recommendation_run_id: string | null
          max_missing_ingredients: number | null
          max_prep_minutes: number | null
          max_total_minutes: number | null
          meal_type: string
          note: string | null
          pantry_only: boolean
          preference_scope: string
          ranking_mode: string
          status: string
          strict_time_limit: boolean
          target_date: string | null
          updated_at: string
        }
        Insert: {
          accepted_meal_plan_id?: string | null
          created_at?: string
          created_by_membership_id: string
          date_range_end?: string | null
          desired_servings?: number | null
          expected_household_attendees?: number | null
          guest_count?: number
          household_id: string
          id?: string
          inputs_changed_at?: string | null
          last_recommendation_run_id?: string | null
          max_missing_ingredients?: number | null
          max_prep_minutes?: number | null
          max_total_minutes?: number | null
          meal_type?: string
          note?: string | null
          pantry_only?: boolean
          preference_scope?: string
          ranking_mode?: string
          status?: string
          strict_time_limit?: boolean
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          accepted_meal_plan_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          date_range_end?: string | null
          desired_servings?: number | null
          expected_household_attendees?: number | null
          guest_count?: number
          household_id?: string
          id?: string
          inputs_changed_at?: string | null
          last_recommendation_run_id?: string | null
          max_missing_ingredients?: number | null
          max_prep_minutes?: number | null
          max_total_minutes?: number | null
          meal_type?: string
          note?: string | null
          pantry_only?: boolean
          preference_scope?: string
          ranking_mode?: string
          status?: string
          strict_time_limit?: boolean
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_requests_accepted_plan_fk"
            columns: ["accepted_meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_requests_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_requests_last_recommendation_run_id_fkey"
            columns: ["last_recommendation_run_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipe_recommendation_runs"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_shopping_proposal_lines: {
        Row: {
          created_at: string
          display_name: string
          excluded: boolean
          household_id: string
          id: string
          line_status: string
          proposal_id: string
          quantity_unit: string
          recipe_ingredient_id: string | null
          required_quantity: number | null
          shopping_list_item_id: string | null
          shortfall_quantity: number | null
          sort_order: number
          substitute_name: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          excluded?: boolean
          household_id: string
          id?: string
          line_status: string
          proposal_id: string
          quantity_unit?: string
          recipe_ingredient_id?: string | null
          required_quantity?: number | null
          shopping_list_item_id?: string | null
          shortfall_quantity?: number | null
          sort_order?: number
          substitute_name?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          excluded?: boolean
          household_id?: string
          id?: string
          line_status?: string
          proposal_id?: string
          quantity_unit?: string
          recipe_ingredient_id?: string | null
          required_quantity?: number | null
          shopping_list_item_id?: string | null
          shortfall_quantity?: number | null
          sort_order?: number
          substitute_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_shopping_proposal_lines_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_shopping_proposal_lines_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_shopping_proposals"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      meal_shopping_proposals: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by_membership_id: string
          household_id: string
          id: string
          meal_plan_id: string
          meal_request_id: string | null
          policy_snapshot: string
          shopping_list_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          household_id: string
          id?: string
          meal_plan_id: string
          meal_request_id?: string | null
          policy_snapshot?: string
          shopping_list_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          household_id?: string
          id?: string
          meal_plan_id?: string
          meal_request_id?: string | null
          policy_snapshot?: string
          shopping_list_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_shopping_proposals_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_shopping_proposals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_shopping_proposals_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_shopping_proposals_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "meal_shopping_proposals_shopping_list_id_household_id_fkey"
            columns: ["shopping_list_id", "household_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      member_dietary_preferences: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          membership_id: string
          share_identity_with_organizer: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label: string
          membership_id: string
          share_identity_with_organizer?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          membership_id?: string
          share_identity_with_organizer?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_dietary_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dietary_preferences_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_away_status: {
        Row: {
          created_at: string
          ends_at: string
          exclude_from_meal_headcounts: boolean
          household_id: string
          id: string
          membership_id: string
          note: string | null
          reduce_nonurgent_notifications: boolean
          starts_at: string
          still_participates_in_expenses: boolean
          unavailable_for_chores: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          exclude_from_meal_headcounts?: boolean
          household_id: string
          id?: string
          membership_id: string
          note?: string | null
          reduce_nonurgent_notifications?: boolean
          starts_at: string
          still_participates_in_expenses?: boolean
          unavailable_for_chores?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          exclude_from_meal_headcounts?: boolean
          household_id?: string
          id?: string
          membership_id?: string
          note?: string | null
          reduce_nonurgent_notifications?: boolean
          starts_at?: string
          still_participates_in_expenses?: boolean
          unavailable_for_chores?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_away_status_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_away_status_membership_id_fkey"
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
      opening_balance_approvals: {
        Row: {
          created_at: string
          decision: string
          entry_id: string
          household_id: string
          id: string
          membership_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          entry_id: string
          household_id: string
          id?: string
          membership_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          entry_id?: string
          household_id?: string
          id?: string
          membership_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_approvals_entry_id_household_id_fkey"
            columns: ["entry_id", "household_id"]
            isOneToOne: false
            referencedRelation: "opening_balance_entries"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "opening_balance_approvals_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balance_entries: {
        Row: {
          amount_cents: number
          attachment_storage_path: string | null
          client_idempotency_key: string | null
          created_at: string
          created_by_membership_id: string
          creditor_membership_id: string
          currency: string
          debtor_membership_id: string
          effective_date: string
          explanation: string
          household_id: string
          id: string
          obligation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attachment_storage_path?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id: string
          creditor_membership_id: string
          currency: string
          debtor_membership_id: string
          effective_date: string
          explanation: string
          household_id: string
          id?: string
          obligation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attachment_storage_path?: string | null
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id?: string
          creditor_membership_id?: string
          currency?: string
          debtor_membership_id?: string
          effective_date?: string
          explanation?: string
          household_id?: string
          id?: string
          obligation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_entries_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_entries_creditor_membership_id_fkey"
            columns: ["creditor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_entries_debtor_membership_id_fkey"
            columns: ["debtor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_entries_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "opening_balance_entries_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balance_events: {
        Row: {
          actor_membership_id: string | null
          created_at: string
          detail: Json
          entry_id: string
          event_type: string
          household_id: string
          id: string
        }
        Insert: {
          actor_membership_id?: string | null
          created_at?: string
          detail?: Json
          entry_id: string
          event_type: string
          household_id: string
          id?: string
        }
        Update: {
          actor_membership_id?: string | null
          created_at?: string
          detail?: Json
          entry_id?: string
          event_type?: string
          household_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_events_entry_id_household_id_fkey"
            columns: ["entry_id", "household_id"]
            isOneToOne: false
            referencedRelation: "opening_balance_entries"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      opening_balance_import_links: {
        Row: {
          created_at: string
          entry_id: string
          household_id: string
          id: string
          import_batch_id: string | null
          import_row_id: string | null
        }
        Insert: {
          created_at?: string
          entry_id: string
          household_id: string
          id?: string
          import_batch_id?: string | null
          import_row_id?: string | null
        }
        Update: {
          created_at?: string
          entry_id?: string
          household_id?: string
          id?: string
          import_batch_id?: string | null
          import_row_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_import_links_entry_id_household_id_fkey"
            columns: ["entry_id", "household_id"]
            isOneToOne: false
            referencedRelation: "opening_balance_entries"
            referencedColumns: ["id", "household_id"]
          },
        ]
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
          is_staple: boolean
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
          is_staple?: boolean
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
          is_staple?: boolean
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
      recipe_equipment: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          inventory_item_id: string | null
          recipe_id: string
          required: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          inventory_item_id?: string | null
          recipe_id: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          inventory_item_id?: string | null
          recipe_id?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_equipment_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_equipment_inventory_item_id_household_id_fkey"
            columns: ["inventory_item_id", "household_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "recipe_equipment_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_feedback_requests: {
        Row: {
          dismissed_at: string | null
          household_id: string
          id: string
          meal_plan_id: string
          membership_id: string
          recipe_id: string
          requested_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          dismissed_at?: string | null
          household_id: string
          id?: string
          meal_plan_id: string
          membership_id: string
          recipe_id: string
          requested_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          dismissed_at?: string | null
          household_id?: string
          id?: string
          meal_plan_id?: string
          membership_id?: string
          recipe_id?: string
          requested_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_feedback_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_feedback_requests_meal_plan_id_household_id_fkey"
            columns: ["meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "recipe_feedback_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_feedback_requests_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_feedback_responses: {
        Row: {
          cost: number | null
          created_at: string
          ease: number | null
          feedback_request_id: string
          guest_friendliness: number | null
          household_id: string
          id: string
          is_favorite: boolean
          meal_prep_usefulness: number | null
          membership_id: string
          preference_signal: string
          private_note: string | null
          share_identity_with_organizer: boolean
          taste: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          ease?: number | null
          feedback_request_id: string
          guest_friendliness?: number | null
          household_id: string
          id?: string
          is_favorite?: boolean
          meal_prep_usefulness?: number | null
          membership_id: string
          preference_signal: string
          private_note?: string | null
          share_identity_with_organizer?: boolean
          taste?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          ease?: number | null
          feedback_request_id?: string
          guest_friendliness?: number | null
          household_id?: string
          id?: string
          is_favorite?: boolean
          meal_prep_usefulness?: number | null
          membership_id?: string
          preference_signal?: string
          private_note?: string | null
          share_identity_with_organizer?: boolean
          taste?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_feedback_responses_feedback_request_id_fkey"
            columns: ["feedback_request_id"]
            isOneToOne: true
            referencedRelation: "recipe_feedback_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_feedback_responses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_feedback_responses_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_import_drafts: {
        Row: {
          candidate_payloads: Json
          canonical_url: string | null
          completed_at: string | null
          confidence_summary: Json
          content_hash: string | null
          created_at: string
          expires_at: string
          extracted_payload: Json | null
          extraction_strategy: string | null
          failure_category: string | null
          household_id: string
          id: string
          parser_version: string
          refresh_recipe_id: string | null
          requested_by_membership_id: string
          saved_recipe_id: string | null
          source_author: string | null
          source_hostname: string
          source_image_url: string | null
          source_title: string | null
          source_url: string
          status: string
          updated_at: string
          validation_warnings: Json
        }
        Insert: {
          candidate_payloads?: Json
          canonical_url?: string | null
          completed_at?: string | null
          confidence_summary?: Json
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          extracted_payload?: Json | null
          extraction_strategy?: string | null
          failure_category?: string | null
          household_id: string
          id?: string
          parser_version: string
          refresh_recipe_id?: string | null
          requested_by_membership_id: string
          saved_recipe_id?: string | null
          source_author?: string | null
          source_hostname: string
          source_image_url?: string | null
          source_title?: string | null
          source_url: string
          status?: string
          updated_at?: string
          validation_warnings?: Json
        }
        Update: {
          candidate_payloads?: Json
          canonical_url?: string | null
          completed_at?: string | null
          confidence_summary?: Json
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          extracted_payload?: Json | null
          extraction_strategy?: string | null
          failure_category?: string | null
          household_id?: string
          id?: string
          parser_version?: string
          refresh_recipe_id?: string | null
          requested_by_membership_id?: string
          saved_recipe_id?: string | null
          source_author?: string | null
          source_hostname?: string
          source_image_url?: string | null
          source_title?: string | null
          source_url?: string
          status?: string
          updated_at?: string
          validation_warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recipe_import_drafts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_import_drafts_refresh_recipe_id_fkey"
            columns: ["refresh_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_import_drafts_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_import_drafts_saved_recipe_id_fkey"
            columns: ["saved_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredient_aliases: {
        Row: {
          alias_name: string
          canonical_name: string
          created_at: string
          household_id: string | null
          id: string
        }
        Insert: {
          alias_name: string
          canonical_name: string
          created_at?: string
          household_id?: string | null
          id?: string
        }
        Update: {
          alias_name?: string
          canonical_name?: string
          created_at?: string
          household_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredient_aliases_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          ingredient_group: string | null
          normalized_name: string
          original_imported_text: string | null
          pantry_match_behavior: string
          parser_confidence: number | null
          preparation_note: string | null
          quantity: number | null
          quantity_mode: string
          quantity_unit: string
          recipe_id: string
          required: boolean
          sort_order: number
          substitution_notes: string | null
          user_confirmed: boolean
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          ingredient_group?: string | null
          normalized_name: string
          original_imported_text?: string | null
          pantry_match_behavior?: string
          parser_confidence?: number | null
          preparation_note?: string | null
          quantity?: number | null
          quantity_mode?: string
          quantity_unit?: string
          recipe_id: string
          required?: boolean
          sort_order?: number
          substitution_notes?: string | null
          user_confirmed?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          ingredient_group?: string | null
          normalized_name?: string
          original_imported_text?: string | null
          pantry_match_behavior?: string
          parser_confidence?: number | null
          preparation_note?: string | null
          quantity?: number | null
          quantity_mode?: string
          quantity_unit?: string
          recipe_id?: string
          required?: boolean
          sort_order?: number
          substitution_notes?: string | null
          user_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_prep_history: {
        Row: {
          created_at: string
          household_id: string
          id: string
          last_consumed_use_soon: boolean
          last_leftover_approximate: boolean
          last_meal_type: string | null
          last_preparation_cancelled: boolean
          last_prepared_at: string | null
          last_shopping_requirement_high: boolean
          last_successful_for_guests: boolean | null
          last_used_for_meal_prep: boolean
          recent_category_count: number
          recipe_id: string
          times_prepared: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          last_consumed_use_soon?: boolean
          last_leftover_approximate?: boolean
          last_meal_type?: string | null
          last_preparation_cancelled?: boolean
          last_prepared_at?: string | null
          last_shopping_requirement_high?: boolean
          last_successful_for_guests?: boolean | null
          last_used_for_meal_prep?: boolean
          recent_category_count?: number
          recipe_id: string
          times_prepared?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          last_consumed_use_soon?: boolean
          last_leftover_approximate?: boolean
          last_meal_type?: string | null
          last_preparation_cancelled?: boolean
          last_prepared_at?: string | null
          last_shopping_requirement_high?: boolean
          last_successful_for_guests?: boolean | null
          last_used_for_meal_prep?: boolean
          recent_category_count?: number
          recipe_id?: string
          times_prepared?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_prep_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_prep_history_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_recommendation_results: {
        Row: {
          created_at: string
          excluded: boolean
          explanation: Json
          hard_exclusion_reason: string | null
          household_id: string
          id: string
          missing_required: number
          pantry_coverage_summary: Json
          preference_fit_summary: string
          rank_position: number | null
          recipe_id: string
          run_id: string
          total_score: number
          warnings: Json
        }
        Insert: {
          created_at?: string
          excluded?: boolean
          explanation?: Json
          hard_exclusion_reason?: string | null
          household_id: string
          id?: string
          missing_required?: number
          pantry_coverage_summary?: Json
          preference_fit_summary?: string
          rank_position?: number | null
          recipe_id: string
          run_id: string
          total_score?: number
          warnings?: Json
        }
        Update: {
          created_at?: string
          excluded?: boolean
          explanation?: Json
          hard_exclusion_reason?: string | null
          household_id?: string
          id?: string
          missing_required?: number
          pantry_coverage_summary?: Json
          preference_fit_summary?: string
          rank_position?: number | null
          recipe_id?: string
          run_id?: string
          total_score?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recipe_recommendation_results_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_recommendation_results_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "recipe_recommendation_results_run_id_household_id_fkey"
            columns: ["run_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipe_recommendation_runs"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_recommendation_runs: {
        Row: {
          candidate_count: number
          created_at: string
          household_id: string
          id: string
          input_snapshot_hash: string
          meal_request_id: string
          preference_scope: string
          ranking_mode: string
          requested_by_membership_id: string
          scoring_version: string
          status: string
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          household_id: string
          id?: string
          input_snapshot_hash?: string
          meal_request_id: string
          preference_scope?: string
          ranking_mode: string
          requested_by_membership_id: string
          scoring_version?: string
          status?: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          household_id?: string
          id?: string
          input_snapshot_hash?: string
          meal_request_id?: string
          preference_scope?: string
          ranking_mode?: string
          requested_by_membership_id?: string
          scoring_version?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_recommendation_runs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_recommendation_runs_meal_request_id_household_id_fkey"
            columns: ["meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "recipe_recommendation_runs_requested_by_membership_id_fkey"
            columns: ["requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_recommendation_score_components: {
        Row: {
          component_key: string
          contribution: number
          created_at: string
          household_id: string
          id: string
          result_id: string
          value: number
          weight: number
        }
        Insert: {
          component_key: string
          contribution?: number
          created_at?: string
          household_id: string
          id?: string
          result_id: string
          value?: number
          weight?: number
        }
        Update: {
          component_key?: string
          contribution?: number
          created_at?: string
          household_id?: string
          id?: string
          result_id?: string
          value?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_recommendation_score_components_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_recommendation_score_components_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "recipe_recommendation_results"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          duration_minutes: number | null
          equipment_note: string | null
          household_id: string
          id: string
          instruction: string
          phase: string
          recipe_id: string
          step_number: number
          timer_label: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          equipment_note?: string | null
          household_id: string
          id?: string
          instruction: string
          phase?: string
          recipe_id: string
          step_number: number
          timer_label?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          equipment_note?: string | null
          household_id?: string
          id?: string
          instruction?: string
          phase?: string
          recipe_id?: string
          step_number?: number
          timer_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_steps_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_user_preferences: {
        Row: {
          cost: number | null
          created_at: string
          ease: number | null
          guest_friendliness: number | null
          household_id: string
          household_rating: number | null
          id: string
          is_favorite: boolean
          last_prepared_at: string | null
          meal_prep_usefulness: number | null
          membership_id: string
          personal_rating: number | null
          preference_signal: string
          private_note: string | null
          recipe_id: string
          share_identity_with_organizer: boolean
          taste: number | null
          times_prepared: number
          updated_at: string
          would_make_again: boolean | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          ease?: number | null
          guest_friendliness?: number | null
          household_id: string
          household_rating?: number | null
          id?: string
          is_favorite?: boolean
          last_prepared_at?: string | null
          meal_prep_usefulness?: number | null
          membership_id: string
          personal_rating?: number | null
          preference_signal?: string
          private_note?: string | null
          recipe_id: string
          share_identity_with_organizer?: boolean
          taste?: number | null
          times_prepared?: number
          updated_at?: string
          would_make_again?: boolean | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          ease?: number | null
          guest_friendliness?: number | null
          household_id?: string
          household_rating?: number | null
          id?: string
          is_favorite?: boolean
          last_prepared_at?: string | null
          meal_prep_usefulness?: number | null
          membership_id?: string
          personal_rating?: number | null
          preference_signal?: string
          private_note?: string | null
          recipe_id?: string
          share_identity_with_organizer?: boolean
          taste?: number | null
          times_prepared?: number
          updated_at?: string
          would_make_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_user_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_user_preferences_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_user_preferences_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipe_visibility_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          membership_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          membership_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          membership_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_visibility_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_visibility_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_visibility_members_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      recipes: {
        Row: {
          archived_at: string | null
          base_servings: number
          category: string
          cook_minutes: number | null
          created_at: string
          created_by_membership_id: string
          cuisine_label: string | null
          description: string | null
          difficulty: string
          household_id: string
          id: string
          import_parser_version: string | null
          imported_at: string | null
          imported_content_hash: string | null
          last_source_refresh_at: string | null
          name: string
          normalized_name: string
          prep_minutes: number | null
          source_author: string | null
          source_canonical_url: string | null
          source_hostname: string | null
          source_image_url: string | null
          source_published_at: string | null
          source_type: string
          source_url: string | null
          tags: string[]
          total_minutes: number | null
          updated_at: string
          visibility: string
          yield_text: string | null
        }
        Insert: {
          archived_at?: string | null
          base_servings?: number
          category?: string
          cook_minutes?: number | null
          created_at?: string
          created_by_membership_id: string
          cuisine_label?: string | null
          description?: string | null
          difficulty?: string
          household_id: string
          id?: string
          import_parser_version?: string | null
          imported_at?: string | null
          imported_content_hash?: string | null
          last_source_refresh_at?: string | null
          name: string
          normalized_name: string
          prep_minutes?: number | null
          source_author?: string | null
          source_canonical_url?: string | null
          source_hostname?: string | null
          source_image_url?: string | null
          source_published_at?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[]
          total_minutes?: number | null
          updated_at?: string
          visibility?: string
          yield_text?: string | null
        }
        Update: {
          archived_at?: string | null
          base_servings?: number
          category?: string
          cook_minutes?: number | null
          created_at?: string
          created_by_membership_id?: string
          cuisine_label?: string | null
          description?: string | null
          difficulty?: string
          household_id?: string
          id?: string
          import_parser_version?: string | null
          imported_at?: string | null
          imported_content_hash?: string | null
          last_source_refresh_at?: string | null
          name?: string
          normalized_name?: string
          prep_minutes?: number | null
          source_author?: string | null
          source_canonical_url?: string | null
          source_hostname?: string | null
          source_image_url?: string | null
          source_published_at?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[]
          total_minutes?: number | null
          updated_at?: string
          visibility?: string
          yield_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      record_comments: {
        Row: {
          author_membership_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edit_window_ends_at: string
          edited_at: string | null
          household_id: string
          id: string
          mentioned_membership_ids: string[]
          parent_id: string
          parent_type: string
          updated_at: string
        }
        Insert: {
          author_membership_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edit_window_ends_at: string
          edited_at?: string | null
          household_id: string
          id?: string
          mentioned_membership_ids?: string[]
          parent_id: string
          parent_type: string
          updated_at?: string
        }
        Update: {
          author_membership_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edit_window_ends_at?: string
          edited_at?: string | null
          household_id?: string
          id?: string
          mentioned_membership_ids?: string[]
          parent_id?: string
          parent_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_comments_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
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
          expense_id: string | null
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
          expense_id?: string | null
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
          expense_id?: string | null
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
      routed_settlement_approvals: {
        Row: {
          created_at: string
          decision: string
          household_id: string
          id: string
          membership_id: string
          note: string | null
          proposal_id: string
          role: string
        }
        Insert: {
          created_at?: string
          decision: string
          household_id: string
          id?: string
          membership_id: string
          note?: string | null
          proposal_id: string
          role: string
        }
        Update: {
          created_at?: string
          decision?: string
          household_id?: string
          id?: string
          membership_id?: string
          note?: string | null
          proposal_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_approvals_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_approvals_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "routed_settlement_proposals"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      routed_settlement_events: {
        Row: {
          actor_membership_id: string | null
          created_at: string
          detail: Json
          event_type: string
          household_id: string
          id: string
          proposal_id: string
        }
        Insert: {
          actor_membership_id?: string | null
          created_at?: string
          detail?: Json
          event_type: string
          household_id: string
          id?: string
          proposal_id: string
        }
        Update: {
          actor_membership_id?: string | null
          created_at?: string
          detail?: Json
          event_type?: string
          household_id?: string
          id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_events_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "routed_settlement_proposals"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      routed_settlement_legs: {
        Row: {
          amount_cents: number
          created_at: string
          household_id: string
          id: string
          leg_kind: string
          obligation_id: string | null
          proposal_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          household_id: string
          id?: string
          leg_kind: string
          obligation_id?: string | null
          proposal_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          household_id?: string
          id?: string
          leg_kind?: string
          obligation_id?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_legs_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "routed_settlement_legs_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_legs_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "routed_settlement_proposals"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      routed_settlement_payment_links: {
        Row: {
          created_at: string
          household_id: string
          id: string
          payment_id: string
          proposal_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          payment_id: string
          proposal_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          payment_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_payment_links_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "routed_settlement_proposals"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      routed_settlement_proposals: {
        Row: {
          amount_cents: number
          balance_snapshot: Json
          client_idempotency_key: string | null
          created_at: string
          created_by_membership_id: string
          currency: string
          expires_at: string | null
          household_id: string
          id: string
          intermediary_membership_id: string
          payer_membership_id: string
          payment_id: string | null
          recipient_membership_id: string
          source_obligation_ab_id: string
          source_obligation_bc_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          balance_snapshot?: Json
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id: string
          currency: string
          expires_at?: string | null
          household_id: string
          id?: string
          intermediary_membership_id: string
          payer_membership_id: string
          payment_id?: string | null
          recipient_membership_id: string
          source_obligation_ab_id: string
          source_obligation_bc_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          balance_snapshot?: Json
          client_idempotency_key?: string | null
          created_at?: string
          created_by_membership_id?: string
          currency?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          intermediary_membership_id?: string
          payer_membership_id?: string
          payment_id?: string | null
          recipient_membership_id?: string
          source_obligation_ab_id?: string
          source_obligation_bc_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_proposals_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_intermediary_membership_id_fkey"
            columns: ["intermediary_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_payer_membership_id_fkey"
            columns: ["payer_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_recipient_membership_id_fkey"
            columns: ["recipient_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_source_obligation_ab_id_fkey"
            columns: ["source_obligation_ab_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_source_obligation_ab_id_fkey"
            columns: ["source_obligation_ab_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_source_obligation_bc_id_fkey"
            columns: ["source_obligation_bc_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "routed_settlement_proposals_source_obligation_bc_id_fkey"
            columns: ["source_obligation_bc_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      routed_settlement_reservations: {
        Row: {
          amount_cents: number
          created_at: string
          household_id: string
          id: string
          obligation_id: string
          proposal_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          household_id: string
          id?: string
          obligation_id: string
          proposal_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          household_id?: string
          id?: string
          obligation_id?: string
          proposal_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routed_settlement_reservations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_balances_v"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "routed_settlement_reservations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routed_settlement_reservations_proposal_id_household_id_fkey"
            columns: ["proposal_id", "household_id"]
            isOneToOne: false
            referencedRelation: "routed_settlement_proposals"
            referencedColumns: ["id", "household_id"]
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
      shared_purchase_proposals: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          estimated_amount_cents: number | null
          expense_id: string | null
          household_id: string
          id: string
          ownership_model: string
          poll_id: string | null
          status: string
          threshold_cents: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          estimated_amount_cents?: number | null
          expense_id?: string | null
          household_id: string
          id?: string
          ownership_model?: string
          poll_id?: string | null
          status?: string
          threshold_cents?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          estimated_amount_cents?: number | null
          expense_id?: string | null
          household_id?: string
          id?: string
          ownership_model?: string
          poll_id?: string | null
          status?: string
          threshold_cents?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_purchase_proposals_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "household_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_purchase_proposals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
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
          pantry_shortfall_quantity: number | null
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
          related_meal_plan_id: string | null
          related_meal_request_id: string | null
          related_pantry_id: string | null
          related_recipe_id: string | null
          related_recipe_ingredient_id: string | null
          related_supply_id: string | null
          requested_by_membership_id: string
          required_quantity: number | null
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
          pantry_shortfall_quantity?: number | null
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
          related_meal_plan_id?: string | null
          related_meal_request_id?: string | null
          related_pantry_id?: string | null
          related_recipe_id?: string | null
          related_recipe_ingredient_id?: string | null
          related_supply_id?: string | null
          requested_by_membership_id: string
          required_quantity?: number | null
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
          pantry_shortfall_quantity?: number | null
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
          related_meal_plan_id?: string | null
          related_meal_request_id?: string | null
          related_pantry_id?: string | null
          related_recipe_id?: string | null
          related_recipe_ingredient_id?: string | null
          related_supply_id?: string | null
          requested_by_membership_id?: string
          required_quantity?: number | null
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
            foreignKeyName: "shopping_list_items_meal_plan_fk"
            columns: ["related_meal_plan_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_meal_request_fk"
            columns: ["related_meal_request_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_requests"
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
            foreignKeyName: "shopping_list_items_recipe_fk"
            columns: ["related_recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_list_items_recipe_ingredient_fk"
            columns: ["related_recipe_ingredient_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id", "household_id"]
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
      _calendar_connection_secrets: {
        Args: { p_connection_id: string }
        Returns: {
          connection_id: string
          household_id: string
          owner_user_id: string
          provider: string
          refresh_token_ciphertext: string
          refresh_token_nonce: string
          sync_mode: string
        }[]
      }
      _calendar_default_household_calendar_id: {
        Args: { p_household_id: string }
        Returns: string
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
      _calendar_material_fields_changed: {
        Args: {
          p_all_day: boolean
          p_before: Database["public"]["Tables"]["calendar_events"]["Row"]
          p_end_date_exclusive: string
          p_ends_at: string
          p_location: string
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
      _ensure_meal_settings: {
        Args: { p_household_id: string }
        Returns: {
          assume_staples_available: boolean
          created_at: string
          household_id: string
          shopping_prep_policy: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_meal_settings"
          isOneToOne: true
          isSetofReturn: false
        }
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
      _governance_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _governance_append_event: {
        Args: {
          p_actor: string
          p_body?: string
          p_document_id: string
          p_event_type: string
          p_household_id: string
          p_payload?: Json
          p_version_id?: string
        }
        Returns: undefined
      }
      _governance_assert_lifecycle: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      _governance_audit: {
        Args: {
          p_after?: Json
          p_before?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
        }
        Returns: undefined
      }
      _governance_hash_content: {
        Args: {
          p_plain_text: string
          p_sections: Json
          p_summary: string
          p_title: string
        }
        Returns: string
      }
      _governance_insert_sections: {
        Args: {
          p_document_id: string
          p_household_id: string
          p_sections: Json
          p_version_id: string
        }
        Returns: undefined
      }
      _governance_notify: {
        Args: {
          p_actor_membership_id: string
          p_body: string
          p_deep_link: string
          p_entity_id: string
          p_event_type: string
          p_household_id: string
          p_memberships: string[]
          p_title: string
        }
        Returns: undefined
      }
      _governance_quorum_satisfied: {
        Args: {
          p_abstain_count: number
          p_approve_count: number
          p_changes_count: number
          p_mode: string
          p_pending_count: number
          p_percentage: number
          p_quorum: number
          p_reject_count: number
          p_required_count: number
          p_total_voters: number
        }
        Returns: Json
      }
      _governance_sections_to_plain: {
        Args: { p_sections: Json }
        Returns: string
      }
      _is_financial_coordinator: {
        Args: { p_household_id: string }
        Returns: boolean
      }
      _link_chore_occurrence_calendar: {
        Args: { p_occurrence_id: string }
        Returns: string
      }
      _maintenance_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _maintenance_append_event: {
        Args: {
          p_actor: string
          p_body?: string
          p_event_type: string
          p_household_id: string
          p_payload?: Json
          p_request_id: string
        }
        Returns: undefined
      }
      _maintenance_audit: {
        Args: {
          p_after?: Json
          p_before?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_household_id: string
        }
        Returns: undefined
      }
      _maintenance_cancel_reminders: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      _maintenance_notify: {
        Args: {
          p_actor_membership_id: string
          p_body: string
          p_entity_id: string
          p_event_type: string
          p_household_id: string
          p_memberships: string[]
          p_title: string
        }
        Returns: undefined
      }
      _mark_routed_stale_if_needed: {
        Args: { p_proposal_id: string }
        Returns: boolean
      }
      _meal_active_membership: {
        Args: { p_household_id: string }
        Returns: string
      }
      _meal_audit: {
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
      _meal_normalize_name: { Args: { p_name: string }; Returns: string }
      _meal_notify: {
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
      _meeting_default_sections: {
        Args: never
        Returns: {
          informational_only: boolean
          section_key: string
          sort_order: number
          title: string
        }[]
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
      _recommendation_base_weight: { Args: { p_key: string }; Returns: number }
      _recommendation_mode_mult: {
        Args: { p_key: string; p_mode: string }
        Returns: number
      }
      _recommendation_weight: {
        Args: { p_key: string; p_mode: string }
        Returns: number
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
      _routed_available_cents: {
        Args: { p_exclude_proposal_id?: string; p_obligation_id: string }
        Returns: number
      }
      _routed_reserved_cents: {
        Args: { p_obligation_id: string }
        Returns: number
      }
      _sanitize_delivery_error: { Args: { p_error: string }; Returns: string }
      _seed_transition_tasks: {
        Args: { p_household_id: string; p_type: string; p_workflow_id: string }
        Returns: undefined
      }
      _set_chore_definition_status: {
        Args: { p_definition_id: string; p_status: string }
        Returns: string
      }
      _sync_obligation_settlement_status: {
        Args: { p_obligation_id: string }
        Returns: undefined
      }
      _test_cleanup_governance_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      _test_cleanup_maintenance_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      _test_cleanup_meal_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      _transition_append_event: {
        Args: {
          p_actor: string
          p_body?: string
          p_event_type: string
          p_household_id: string
          p_payload?: Json
          p_workflow_id: string
        }
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
      _transition_notify: {
        Args: {
          p_actor_membership_id: string
          p_body: string
          p_event_type: string
          p_household_id: string
          p_memberships: string[]
          p_title: string
          p_workflow_id: string
        }
        Returns: undefined
      }
      _valid_chore_reminder_offsets: {
        Args: { p_offsets: number[] }
        Returns: boolean
      }
      accept_household_invitation: {
        Args: { p_token_hash: string }
        Returns: string
      }
      accept_meal_request_result: {
        Args: {
          p_attendee_membership_ids?: string[]
          p_link_calendar?: boolean
          p_meal_date?: string
          p_meal_request_id: string
          p_recipe_id: string
          p_target_servings?: number
        }
        Returns: string
      }
      accept_recipe_recommendation: {
        Args: {
          p_attendee_membership_ids?: string[]
          p_desired_servings?: number
          p_link_calendar?: boolean
          p_meal_date: string
          p_meal_request_id: string
          p_recipe_id: string
        }
        Returns: string
      }
      accept_responsibility_transfer: {
        Args: { p_transfer_id: string }
        Returns: string
      }
      accept_routed_settlement_recipient: {
        Args: { p_decision: string; p_note?: string; p_proposal_id: string }
        Returns: undefined
      }
      accept_suggested_agenda_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      acknowledge_governance_version: {
        Args: { p_comment?: string; p_version_id: string }
        Returns: string
      }
      activate_governance_version: {
        Args: {
          p_document_id: string
          p_effective_at?: string
          p_version_id?: string
        }
        Returns: string
      }
      add_governance_attachment: {
        Args: {
          p_comment_id?: string
          p_document_id?: string
          p_file_name: string
          p_household_id: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
          p_transition_task_id?: string
          p_version_id?: string
        }
        Returns: string
      }
      add_governance_comment: {
        Args: {
          p_body: string
          p_document_id: string
          p_requests_changes?: boolean
          p_version_id?: string
        }
        Returns: string
      }
      add_maintenance_attachment: {
        Args: {
          p_file_name: string
          p_mime_type: string
          p_request_id: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: string
      }
      add_maintenance_comment: {
        Args: { p_body: string; p_request_id: string }
        Returns: string
      }
      add_meeting_agenda_item: {
        Args: {
          p_meeting_id: string
          p_section_key: string
          p_source?: string
          p_source_entity_id?: string
          p_source_entity_type?: string
          p_title: string
          p_why_included?: string
        }
        Returns: string
      }
      add_record_comment: {
        Args: {
          p_body: string
          p_household_id: string
          p_mentioned_membership_ids?: string[]
          p_parent_id: string
          p_parent_type: string
        }
        Returns: string
      }
      advance_household_transition: {
        Args: { p_next_status: string; p_notes?: string; p_workflow_id: string }
        Returns: string
      }
      apply_receipt_line_destinations: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      approve_chore_reassignment: {
        Args: { p_request_id: string; p_resolution_note?: string }
        Returns: string
      }
      approve_routed_settlement_intermediary: {
        Args: { p_decision: string; p_note?: string; p_proposal_id: string }
        Returns: undefined
      }
      archive_governance_document: {
        Args: { p_document_id: string; p_reason?: string }
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
      archive_recipe: { Args: { p_recipe_id: string }; Returns: string }
      assign_chore_occurrence: {
        Args: {
          p_membership_id: string
          p_occurrence_id: string
          p_role?: string
        }
        Returns: string
      }
      assign_maintenance_request: {
        Args: {
          p_is_primary?: boolean
          p_membership_id: string
          p_request_id: string
        }
        Returns: string
      }
      assign_meal_preparation: {
        Args: {
          p_cleanup_membership_id?: string
          p_cooking_membership_id?: string
          p_meal_plan_id: string
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
      build_meal_shopping_proposal: {
        Args: { p_meal_plan_id: string; p_shopping_list_id?: string }
        Returns: string
      }
      can_comment_on_parent: {
        Args: {
          p_household_id: string
          p_parent_id: string
          p_parent_type: string
        }
        Returns: boolean
      }
      can_confirm_or_void_expense: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_edit_expense_draft: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      can_edit_expense_receipt: {
        Args: { p_receipt_id: string }
        Returns: boolean
      }
      can_manage_calendar: { Args: { p_calendar_id: string }; Returns: boolean }
      can_manage_calendar_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_manage_external_calendar_connection: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      can_manage_governance_document: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      can_manage_transition_workflow: {
        Args: { p_workflow_id: string }
        Returns: boolean
      }
      can_view_calendar: { Args: { p_calendar_id: string }; Returns: boolean }
      can_view_calendar_event: {
        Args: { p_event_id: string }
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
      can_view_comment_parent: {
        Args: {
          p_household_id: string
          p_parent_id: string
          p_parent_type: string
        }
        Returns: boolean
      }
      can_view_event_availability: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_view_event_details: { Args: { p_event_id: string }; Returns: boolean }
      can_view_expense: { Args: { p_expense_id: string }; Returns: boolean }
      can_view_expense_receipt: {
        Args: { p_receipt_id: string }
        Returns: boolean
      }
      can_view_expense_receipt_path: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      can_view_governance_document: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      can_view_inventory_item: { Args: { p_item_id: string }; Returns: boolean }
      can_view_maintenance_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      can_view_meal_batch: { Args: { p_batch_id: string }; Returns: boolean }
      can_view_meal_plan: { Args: { p_meal_plan_id: string }; Returns: boolean }
      can_view_pantry_item: { Args: { p_item_id: string }; Returns: boolean }
      can_view_recipe: { Args: { p_recipe_id: string }; Returns: boolean }
      can_view_routed_settlement: {
        Args: { p_proposal_id: string }
        Returns: boolean
      }
      can_view_supply_item: { Args: { p_item_id: string }; Returns: boolean }
      can_view_transition_private_field: {
        Args: { p_field_id: string }
        Returns: boolean
      }
      can_view_transition_workflow: {
        Args: { p_workflow_id: string }
        Returns: boolean
      }
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
      cancel_household_transition: {
        Args: { p_reason?: string; p_workflow_id: string }
        Returns: string
      }
      cancel_maintenance_appointment: {
        Args: { p_calendar_link_id: string }
        Returns: string
      }
      cancel_maintenance_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: string
      }
      cancel_meal_plan: { Args: { p_meal_plan_id: string }; Returns: string }
      cancel_meeting: { Args: { p_meeting_id: string }; Returns: undefined }
      cancel_opening_balance: {
        Args: { p_entry_id: string }
        Returns: undefined
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
      cancel_recipe_import_draft: {
        Args: { p_draft_id: string }
        Returns: string
      }
      cancel_routed_settlement: {
        Args: { p_proposal_id: string }
        Returns: undefined
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
      change_maintenance_waiting_status: {
        Args: { p_request_id: string; p_status: string }
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
      claim_calendar_sync_runs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          claimed_at: string | null
          connection_id: string
          created_at: string
          error_summary: string | null
          events_conflicted: number
          events_exported: number
          events_imported: number
          finished_at: string | null
          household_id: string
          id: string
          next_attempt_at: string | null
          started_at: string | null
          status: string
          trigger_kind: string
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_sync_runs"
          isOneToOne: false
          isSetofReturn: true
        }
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
      claim_export_jobs: {
        Args: { p_batch_size?: number; p_worker_id?: string }
        Returns: {
          completed_at: string | null
          created_at: string
          error_text: string | null
          expires_at: string | null
          household_id: string
          id: string
          requested_by_membership_id: string
          result_meta: Json | null
          status: string
          storage_path: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "household_export_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_maintenance_request: {
        Args: { p_request_id: string }
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
      claim_receipt_extraction_jobs: {
        Args: {
          p_batch_size?: number
          p_claim_ttl_seconds?: number
          p_worker_id?: string
        }
        Returns: {
          attempts: number
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          household_id: string
          id: string
          last_error: string | null
          receipt_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "expense_receipt_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_shopping_item: { Args: { p_item_id: string }; Returns: string }
      cleanup_test_household_data: {
        Args: { p_test_run_id: string }
        Returns: number
      }
      clear_recipe_preference: {
        Args: { p_recipe_id: string }
        Returns: string
      }
      close_maintenance_request: {
        Args: { p_request_id: string }
        Returns: string
      }
      complete_chore_occurrence: {
        Args: { p_completion_note?: string; p_occurrence_id: string }
        Returns: string
      }
      complete_export_job: {
        Args: {
          p_error?: string
          p_expires_at: string
          p_job_id: string
          p_result_meta?: Json
          p_storage_path: string
        }
        Returns: undefined
      }
      complete_household_setup: {
        Args: { p_household_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_setup_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_household_transition: {
        Args: {
          p_notes?: string
          p_removal_at?: string
          p_schedule_membership_removal?: boolean
          p_workflow_id: string
        }
        Returns: string
      }
      complete_household_transition_task: {
        Args: { p_note?: string; p_task_id: string }
        Returns: string
      }
      complete_meeting: { Args: { p_meeting_id: string }; Returns: undefined }
      complete_notification_delivery: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_provider_message_id?: string
          p_subscription_id?: string
        }
        Returns: boolean
      }
      complete_receipt_extraction: {
        Args: {
          p_adapter_name: string
          p_confidence: number
          p_configured?: boolean
          p_content_hash: string
          p_duplicate_outcome?: string
          p_duplicate_signals?: Json
          p_error?: string
          p_line_items: Json
          p_match_expense_id?: string
          p_match_receipt_id?: string
          p_proposed: Json
          p_receipt_id: string
        }
        Returns: undefined
      }
      complete_recipe_import_draft: {
        Args: {
          p_candidates?: Json
          p_canonical_url?: string
          p_confidence?: Json
          p_content_hash?: string
          p_draft_id: string
          p_failure_category?: string
          p_payload?: Json
          p_source_author?: string
          p_source_image_url?: string
          p_source_title?: string
          p_status: string
          p_strategy?: string
          p_warnings?: Json
        }
        Returns: string
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
      confirm_meal_pantry_usage: {
        Args: { p_meal_plan_id: string; p_usage?: Json }
        Returns: string
      }
      confirm_meal_shopping_proposal: {
        Args: {
          p_excluded_line_ids?: string[]
          p_proposal_id: string
          p_quantity_overrides?: Json
          p_shopping_list_id?: string
        }
        Returns: string
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
      confirm_receipt_as_expense: {
        Args: { p_idempotency_key: string; p_receipt_id: string }
        Returns: string
      }
      confirm_routed_settlement: {
        Args: { p_proposal_id: string }
        Returns: undefined
      }
      create_calendar_availability_override: {
        Args: {
          p_ends_at: string
          p_household_id: string
          p_note?: string
          p_override_kind: string
          p_starts_at: string
        }
        Returns: string
      }
      create_calendar_event: {
        Args: {
          p_all_day?: boolean
          p_attendee_membership_ids?: string[]
          p_calendar_id?: string
          p_category?: string
          p_client_idempotency_key?: string
          p_description?: string
          p_end_date_exclusive?: string
          p_ends_at?: string
          p_event_guest_count?: number
          p_guest_label?: string
          p_household_id: string
          p_location?: string
          p_meeting_url?: string
          p_recurrence_count?: number
          p_recurrence_until?: string
          p_reminder_offsets_minutes?: number[]
          p_resource_ids?: string[]
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
      create_calendar_resource: {
        Args: {
          p_capacity?: number
          p_capacity_mode?: string
          p_household_id: string
          p_name: string
          p_resource_kind?: string
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
      create_governance_document: {
        Args: {
          p_acknowledgment_rules?: Json
          p_approval_rules?: Json
          p_document_class: string
          p_household_id: string
          p_is_financial?: boolean
          p_participant_membership_ids?: string[]
          p_sections?: Json
          p_summary?: string
          p_template_id?: string
          p_title: string
          p_visibility?: string
        }
        Returns: string
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
      create_household_transition: {
        Args: {
          p_coordinator_membership_id?: string
          p_household_id: string
          p_linked_document_id?: string
          p_notice_date?: string
          p_planned_date?: string
          p_room_assignment?: string
          p_subject_membership_id: string
          p_visibility?: string
          p_workflow_type: string
        }
        Returns: string
      }
      create_import_batch: {
        Args: {
          p_domain: string
          p_file_name: string
          p_household_id: string
          p_idempotency_key?: string
        }
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
      create_maintenance_action: {
        Args: {
          p_assignee_membership_id?: string
          p_description?: string
          p_request_id: string
          p_title: string
        }
        Returns: string
      }
      create_maintenance_contact: {
        Args: {
          p_contact_type: string
          p_display_name: string
          p_email?: string
          p_household_id: string
          p_notes?: string
          p_organization?: string
          p_phone?: string
          p_preferred?: boolean
          p_website?: string
        }
        Returns: string
      }
      create_maintenance_request: {
        Args: {
          p_category?: string
          p_currently_active?: boolean
          p_description?: string
          p_first_noticed_at?: string
          p_hazard_flags?: string[]
          p_household_id: string
          p_immediate_mitigation?: string
          p_inventory_item_id?: string
          p_landlord_involvement?: boolean
          p_location_id?: string
          p_participant_membership_ids?: string[]
          p_severity?: string
          p_stop_use?: boolean
          p_suggested_coordinator_membership_id?: string
          p_title: string
          p_visibility?: string
        }
        Returns: string
      }
      create_meal_plan: {
        Args: {
          p_attendee_membership_ids?: string[]
          p_buffer_servings?: number
          p_custom_meal_name?: string
          p_desired_leftover_servings?: number
          p_ends_at?: string
          p_guest_cost_policy?: string
          p_guest_count?: number
          p_household_id: string
          p_link_calendar?: boolean
          p_meal_date: string
          p_meal_request_id?: string
          p_meal_type: string
          p_notes?: string
          p_recipe_id?: string
          p_starts_at?: string
          p_target_servings?: number
          p_title: string
          p_visibility?: string
        }
        Returns: string
      }
      create_meal_request: {
        Args: {
          p_attendee_membership_ids?: string[]
          p_constraints?: Json
          p_desired_servings?: number
          p_guest_constraints?: Json
          p_guest_count?: number
          p_household_id: string
          p_max_missing_ingredients?: number
          p_max_total_minutes?: number
          p_meal_type?: string
          p_note?: string
          p_pantry_only?: boolean
          p_preference_scope?: string
          p_ranking_mode?: string
          p_strict_time_limit?: boolean
          p_target_date?: string
        }
        Returns: string
      }
      create_meeting_action_item: {
        Args: {
          p_decision_id?: string
          p_due_date?: string
          p_idempotency_key?: string
          p_meeting_id: string
          p_owner_membership_id?: string
          p_title: string
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
      create_opening_balance_entry: {
        Args: {
          p_amount_cents: number
          p_attachment_storage_path?: string
          p_creditor_membership_id: string
          p_currency: string
          p_debtor_membership_id: string
          p_effective_date: string
          p_explanation: string
          p_household_id: string
          p_idempotency_key?: string
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
      create_recipe: {
        Args: {
          p_base_servings?: number
          p_category?: string
          p_cook_minutes?: number
          p_cuisine_label?: string
          p_description?: string
          p_difficulty?: string
          p_equipment?: Json
          p_household_id: string
          p_import_parser_version?: string
          p_imported_content_hash?: string
          p_ingredients?: Json
          p_name: string
          p_prep_minutes?: number
          p_source_author?: string
          p_source_canonical_url?: string
          p_source_hostname?: string
          p_source_image_url?: string
          p_source_published_at?: string
          p_source_type?: string
          p_source_url?: string
          p_steps?: Json
          p_tags?: string[]
          p_visibility?: string
          p_visibility_membership_ids?: string[]
          p_yield_text?: string
        }
        Returns: string
      }
      create_recipe_import_draft: {
        Args: {
          p_household_id: string
          p_parser_version: string
          p_refresh_recipe_id?: string
          p_source_hostname: string
          p_source_url: string
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
      create_revised_governance_version: {
        Args: {
          p_acknowledgment_rules?: Json
          p_approval_rules?: Json
          p_change_summary?: string
          p_document_id: string
          p_sections?: Json
          p_summary?: string
          p_title?: string
        }
        Returns: string
      }
      create_routed_settlement_proposal: {
        Args: {
          p_amount_cents: number
          p_household_id: string
          p_idempotency_key?: string
          p_intermediary_membership_id: string
          p_obligation_ab_id: string
          p_obligation_bc_id: string
          p_payer_membership_id: string
          p_recipient_membership_id: string
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
      delete_receipt_alias: { Args: { p_alias_id: string }; Returns: undefined }
      discard_meal_batch: { Args: { p_batch_id: string }; Returns: string }
      discard_pantry_item: {
        Args: { p_item_id: string; p_note?: string }
        Returns: string
      }
      dismiss_household_setup: {
        Args: { p_household_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_setup_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dismiss_meal_request: {
        Args: { p_meal_request_id: string }
        Returns: string
      }
      dismiss_recipe_feedback: {
        Args: { p_feedback_request_id: string }
        Returns: string
      }
      dismiss_suggested_agenda_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      dispose_inventory_item: {
        Args: { p_disposition?: string; p_item_id: string; p_status: string }
        Returns: string
      }
      edit_record_comment: {
        Args: { p_body: string; p_comment_id: string }
        Returns: undefined
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
      enqueue_calendar_sync_run: {
        Args: { p_connection_id: string; p_trigger_kind?: string }
        Returns: string
      }
      enqueue_test_notification: { Args: never; Returns: string }
      ensure_default_shopping_list: {
        Args: { p_household_id: string }
        Returns: string
      }
      ensure_household_setup_progress: {
        Args: { p_household_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_setup_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_monthly_meeting: {
        Args: {
          p_household_id: string
          p_idempotency_key?: string
          p_meeting_at?: string
          p_period_end: string
          p_period_start: string
          p_timezone?: string
        }
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
      expire_recipe_import_drafts: { Args: never; Returns: number }
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
      get_recipe_recommendation_results: {
        Args: { p_meal_request_id: string }
        Returns: Json
      }
      governance_approval_status: {
        Args: { p_request_id: string }
        Returns: Json
      }
      grant_transition_private_field: {
        Args: { p_field_id: string; p_grantee_membership_id: string }
        Returns: string
      }
      has_responsibility: {
        Args: { p_household_id: string; p_roles: string[] }
        Returns: boolean
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      instantiate_governance_template: {
        Args: {
          p_household_id: string
          p_template_id: string
          p_title?: string
          p_visibility?: string
        }
        Returns: string
      }
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
      link_governance_calendar_event: {
        Args: {
          p_calendar_event_id: string
          p_document_id?: string
          p_household_id: string
          p_link_kind: string
          p_transition_workflow_id?: string
          p_version_id?: string
        }
        Returns: string
      }
      link_maintenance_chore: {
        Args: {
          p_chore_definition_id?: string
          p_chore_occurrence_id?: string
          p_request_id: string
        }
        Returns: string
      }
      link_maintenance_expense: {
        Args: {
          p_expense_id: string
          p_link_kind?: string
          p_request_id: string
        }
        Returns: string
      }
      link_maintenance_inventory: {
        Args: { p_inventory_item_id: string; p_request_id: string }
        Returns: string
      }
      link_meeting_calendar_event: {
        Args: { p_calendar_event_id: string; p_meeting_id: string }
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
      link_transition_inventory_item: {
        Args: {
          p_inventory_item_id: string
          p_link_kind: string
          p_note?: string
          p_workflow_id: string
        }
        Returns: string
      }
      link_transition_maintenance_request: {
        Args: {
          p_maintenance_request_id: string
          p_note?: string
          p_workflow_id: string
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
      lock_meeting_packet: {
        Args: {
          p_idempotency_key?: string
          p_meeting_id: string
          p_shared_payload: Json
          p_source_freshness?: Json
        }
        Returns: string
      }
      mark_all_notifications_read: {
        Args: { p_household_id?: string }
        Returns: number
      }
      mark_chore_blocked: {
        Args: { p_note?: string; p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      mark_import_batch_status: {
        Args: {
          p_batch_id: string
          p_error_summary?: string
          p_result_summary?: Json
          p_status: string
        }
        Returns: undefined
      }
      mark_meal_batch_finished: {
        Args: { p_batch_id: string }
        Returns: string
      }
      mark_meal_prepared: {
        Args: {
          p_batch_quantity?: number
          p_create_batch?: boolean
          p_location_id?: string
          p_meal_plan_id: string
          p_remaining_state?: string
        }
        Returns: string
      }
      mark_meal_preparing: { Args: { p_meal_plan_id: string }; Returns: string }
      mark_meeting_section_discussed: {
        Args: {
          p_meeting_id: string
          p_section_key: string
          p_skipped?: boolean
        }
        Returns: undefined
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
      override_governance_approval: {
        Args: { p_activate?: boolean; p_reason: string; p_request_id: string }
        Returns: string
      }
      pause_chore_definition: {
        Args: { p_definition_id: string }
        Returns: string
      }
      process_due_scheduled_notifications: {
        Args: { p_limit?: number }
        Returns: number
      }
      propose_governance_version: {
        Args: {
          p_document_id: string
          p_participant_membership_ids?: string[]
          p_version_id?: string
        }
        Returns: string
      }
      publish_meeting_recap: {
        Args: {
          p_idempotency_key?: string
          p_meeting_id: string
          p_recap_payload: Json
        }
        Returns: string
      }
      rank_recipe_candidates: {
        Args: { p_meal_request_id: string }
        Returns: number
      }
      rate_recipe: {
        Args: {
          p_personal_rating?: number
          p_recipe_id: string
          p_would_make_again?: boolean
        }
        Returns: string
      }
      recalculate_meal_recommendation_context: {
        Args: { p_meal_request_id: string }
        Returns: string
      }
      recalculate_meal_shopping_prep: {
        Args: { p_meal_plan_id: string }
        Returns: string
      }
      recommendation_weight_table: {
        Args: never
        Returns: {
          component_key: string
          mode: string
          weight: number
        }[]
      }
      reconcile_calendar_event_occurrences: {
        Args: { p_event_id: string; p_occurrences: Json }
        Returns: number
      }
      record_calendar_event_conflict: {
        Args: {
          p_conflict_class: string
          p_conflict_kind: string
          p_conflicting_event_id: string
          p_event_id: string
          p_summary: string
        }
        Returns: string
      }
      record_maintenance_condition_change: {
        Args: {
          p_confirm?: boolean
          p_inventory_item_id: string
          p_new_condition: string
          p_request_id: string
        }
        Returns: string
      }
      record_maintenance_contact_event: {
        Args: {
          p_contact_id: string
          p_event_kind: string
          p_follow_up_at?: string
          p_notes?: string
          p_reference_number?: string
          p_request_id: string
        }
        Returns: string
      }
      record_maintenance_mitigation: {
        Args: { p_mitigation: string; p_request_id: string }
        Returns: string
      }
      record_maintenance_quote: {
        Args: {
          p_amount_cents: number
          p_contact_id?: string
          p_expires_at?: string
          p_notes?: string
          p_request_id: string
        }
        Returns: string
      }
      record_meeting_decision: {
        Args: {
          p_agenda_item_id?: string
          p_decision_text: string
          p_idempotency_key?: string
          p_meeting_id: string
          p_owner_membership_id?: string
        }
        Returns: string
      }
      record_meeting_note: {
        Args: {
          p_agenda_item_id?: string
          p_body: string
          p_meeting_id: string
          p_parking_lot?: boolean
          p_section_key?: string
        }
        Returns: string
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
      register_calendar_external_connection: {
        Args: {
          p_account_email: string
          p_household_id: string
          p_provider: string
          p_refresh_token_ciphertext: string
          p_refresh_token_nonce: string
          p_scopes: string[]
          p_sync_mode?: string
        }
        Returns: string
      }
      register_calendar_ics_import: {
        Args: {
          p_calendar_id: string
          p_event_id: string
          p_household_id: string
          p_ics_uid: string
        }
        Returns: string
      }
      register_expense_receipt: {
        Args: {
          p_file_hash?: string
          p_file_name: string
          p_household_id: string
          p_mime_type: string
          p_perceptual_hash?: string
          p_size_bytes: number
          p_storage_path: string
        }
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
      remove_governance_attachment: {
        Args: { p_attachment_id: string; p_reason?: string }
        Returns: string
      }
      remove_household_member: {
        Args: {
          p_household_id: string
          p_membership_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      remove_maintenance_attachment: {
        Args: { p_attachment_id: string }
        Returns: string
      }
      rename_household_location: {
        Args: { p_location_id: string; p_name: string }
        Returns: string
      }
      reopen_chore_occurrence: {
        Args: { p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      reopen_maintenance_request: {
        Args: { p_note?: string; p_request_id: string }
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
      request_household_export: {
        Args: { p_household_id: string }
        Returns: string
      }
      request_recipe_feedback: {
        Args: { p_meal_plan_id: string }
        Returns: number
      }
      request_responsibility_transfer: {
        Args: { p_area_id: string; p_note?: string; p_to_membership_id: string }
        Returns: string
      }
      reserve_calendar_resource: {
        Args: {
          p_confirmed?: boolean
          p_event_id: string
          p_quantity?: number
          p_resource_id: string
        }
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
      resolve_maintenance_request: {
        Args: {
          p_decision_outcome?: string
          p_request_id: string
          p_resolution_notes?: string
        }
        Returns: string
      }
      respond_opening_balance: {
        Args: { p_decision: string; p_entry_id: string; p_note?: string }
        Returns: undefined
      }
      respond_to_calendar_event: {
        Args: {
          p_event_id: string
          p_guest_count?: number
          p_guest_note?: string
          p_response_note?: string
          p_rsvp_status: string
        }
        Returns: string
      }
      respond_to_governance_approval: {
        Args: { p_comment?: string; p_decision: string; p_request_id: string }
        Returns: string
      }
      respond_to_meal_plan: {
        Args: {
          p_guest_count?: number
          p_meal_plan_id: string
          p_status: string
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
      reverse_receipt_destination_applies: {
        Args: { p_receipt_id: string }
        Returns: undefined
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
      reverse_routed_settlement: {
        Args: { p_proposal_id: string; p_reason: string }
        Returns: undefined
      }
      revoke_calendar_external_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      revoke_calendar_feed: { Args: { p_feed_id: string }; Returns: string }
      revoke_household_invitation: {
        Args: { p_household_id: string; p_invitation_id: string }
        Returns: undefined
      }
      run_recipe_recommendation: {
        Args: { p_meal_request_id: string }
        Returns: string
      }
      save_governance_draft: {
        Args: {
          p_acknowledgment_rules?: Json
          p_approval_rules?: Json
          p_change_summary?: string
          p_create_new_version?: boolean
          p_document_id: string
          p_sections?: Json
          p_summary?: string
          p_title?: string
          p_visibility?: string
        }
        Returns: string
      }
      save_import_mapping: {
        Args: { p_batch_id: string; p_column_map: Json; p_rows: Json }
        Returns: undefined
      }
      save_imported_recipe: {
        Args: {
          p_draft_id: string
          p_import_as_copy?: boolean
          p_recipe: Json
          p_visibility?: string
        }
        Returns: string
      }
      save_personal_meeting_addendum: {
        Args: {
          p_meeting_id: string
          p_packet_version_id: string
          p_payload: Json
          p_source_freshness?: Json
        }
        Returns: string
      }
      schedule_maintenance_appointment: {
        Args: {
          p_all_day?: boolean
          p_appointment_kind?: string
          p_ends_at: string
          p_location?: string
          p_request_id: string
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      set_current_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      set_meal_guest_count: {
        Args: {
          p_guest_count: number
          p_meal_plan_id: string
          p_possible_guest_count?: number
        }
        Returns: string
      }
      set_meal_target_servings: {
        Args: { p_meal_plan_id: string; p_target_servings: number }
        Returns: string
      }
      set_meeting_status_preparing: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      set_recipe_favorite: {
        Args: { p_is_favorite: boolean; p_recipe_id: string }
        Returns: string
      }
      set_recipe_preference: {
        Args: {
          p_cost?: number
          p_ease?: number
          p_guest_friendliness?: number
          p_is_favorite?: boolean
          p_meal_prep_usefulness?: number
          p_preference_signal: string
          p_private_note?: string
          p_recipe_id: string
          p_share_identity_with_organizer?: boolean
          p_taste?: number
        }
        Returns: string
      }
      set_recipe_visibility: {
        Args: {
          p_membership_ids?: string[]
          p_recipe_id: string
          p_visibility: string
        }
        Returns: string
      }
      skip_chore_occurrence: {
        Args: { p_occurrence_id: string; p_reason: string }
        Returns: string
      }
      soft_delete_record_comment: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      split_calendar_event_series: {
        Args: {
          p_client_idempotency_key: string
          p_event_id: string
          p_split_starts_at: string
        }
        Returns: string
      }
      start_chore_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: string
      }
      start_meeting: { Args: { p_meeting_id: string }; Returns: undefined }
      submit_client_receipt_extraction: {
        Args: {
          p_adapter_name: string
          p_confidence: number
          p_content_hash: string
          p_duplicate_outcome?: string
          p_duplicate_signals?: Json
          p_line_items: Json
          p_match_expense_id?: string
          p_match_receipt_id?: string
          p_ocr_full_text?: string
          p_ocr_lines_json?: Json
          p_processing_meta?: Json
          p_proposed: Json
          p_receipt_id: string
        }
        Returns: undefined
      }
      submit_opening_balance_for_confirmation: {
        Args: { p_entry_id: string }
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
      submit_recipe_feedback: {
        Args: {
          p_cost?: number
          p_ease?: number
          p_feedback_request_id: string
          p_guest_friendliness?: number
          p_is_favorite?: boolean
          p_meal_prep_usefulness?: number
          p_preference_signal: string
          p_private_note?: string
          p_share_identity_with_organizer?: boolean
          p_taste?: number
        }
        Returns: string
      }
      submit_routed_settlement_payment: {
        Args: {
          p_external_method: string
          p_idempotency_key: string
          p_proposal_id: string
          p_public_note?: string
        }
        Returns: string
      }
      touch_supply_stock_check: { Args: { p_item_id: string }; Returns: string }
      triage_maintenance_request: {
        Args: {
          p_note?: string
          p_primary_coordinator_membership_id?: string
          p_request_id: string
          p_severity?: string
        }
        Returns: string
      }
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
          p_meeting_url?: string
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
      update_household_meal_settings: {
        Args: {
          p_assume_staples_available?: boolean
          p_household_id: string
          p_shopping_prep_policy?: string
        }
        Returns: string
      }
      update_household_setup_step: {
        Args: {
          p_draft?: Json
          p_household_id: string
          p_status: string
          p_step: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          steps: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_setup_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_inventory_item: {
        Args: { p_item_id: string; p_patch: Json }
        Returns: string
      }
      update_meal_batch_remaining_state: {
        Args: { p_batch_id: string; p_remaining_state: string }
        Returns: string
      }
      update_meeting_section: {
        Args: {
          p_included?: boolean
          p_informational_only?: boolean
          p_meeting_id: string
          p_organizer_note?: string
          p_section_key: string
          p_sort_order?: number
        }
        Returns: undefined
      }
      update_receipt_review: {
        Args: {
          p_currency?: string
          p_declared_total_cents?: number
          p_line_items?: Json
          p_merchant?: string
          p_notes?: string
          p_purchase_date?: string
          p_receipt_id: string
        }
        Returns: undefined
      }
      update_recipe: {
        Args: { p_patch: Json; p_recipe_id: string }
        Returns: string
      }
      upsert_calendar_availability_rule: {
        Args: {
          p_end_minute: number
          p_household_id: string
          p_max_event_minutes?: number
          p_min_notice_minutes?: number
          p_rule_id?: string
          p_rule_kind: string
          p_start_minute: number
          p_time_zone?: string
          p_weekdays: number[]
        }
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
      upsert_receipt_alias: {
        Args: {
          p_household_id: string
          p_kind: string
          p_merchant_scope?: string
          p_source_text: string
          p_target_text: string
        }
        Returns: string
      }
      upsert_transition_private_field: {
        Args: {
          p_field_kind: string
          p_label?: string
          p_value_text: string
          p_workflow_id: string
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
      withdraw_governance_proposal: {
        Args: { p_document_id: string; p_reason?: string }
        Returns: string
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
