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
  public: {
    Tables: {
      artist_pipeline: {
        Row: {
          artist_name: string
          assigned_to: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          next_followup: string | null
          notes: string | null
          stage: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          artist_name: string
          assigned_to?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          next_followup?: string | null
          notes?: string | null
          stage?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          artist_name?: string
          assigned_to?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          next_followup?: string | null
          notes?: string | null
          stage?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_pipeline_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_pipeline_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_tasks: {
        Row: {
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          is_required: boolean
          recipient_assignment_id: string | null
          recurrence_last_spawned_at: string | null
          recurrence_parent_id: string | null
          recurrence_spec: Json | null
          scope: string
          sort_order: number
          source_template_id: string | null
          source_template_item_id: string | null
          source_type: Database["public"]["Enums"]["assigned_source_type"]
          studio_space: string | null
          team_id: string | null
          title: string
          updated_at: string
          visible_on_overview: boolean
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          is_required?: boolean
          recipient_assignment_id?: string | null
          recurrence_last_spawned_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_spec?: Json | null
          scope?: string
          sort_order?: number
          source_template_id?: string | null
          source_template_item_id?: string | null
          source_type: Database["public"]["Enums"]["assigned_source_type"]
          studio_space?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
          visible_on_overview?: boolean
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          is_required?: boolean
          recipient_assignment_id?: string | null
          recurrence_last_spawned_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_spec?: Json | null
          scope?: string
          sort_order?: number
          source_template_id?: string | null
          source_template_item_id?: string | null
          source_type?: Database["public"]["Enums"]["assigned_source_type"]
          studio_space?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          visible_on_overview?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assigned_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_recipient_assignment_id_fkey"
            columns: ["recipient_assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "assigned_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_source_template_item_id_fkey"
            columns: ["source_template_item_id"]
            isOneToOne: false
            referencedRelation: "task_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_notifications: {
        Row: {
          batch_id: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          notification_type: Database["public"]["Enums"]["assignment_notification_type"]
          read_at: string | null
          recipient_id: string
          session_id: string | null
          task_reassign_request_id: string | null
          task_request_id: string | null
          title: string
        }
        Insert: {
          batch_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type: Database["public"]["Enums"]["assignment_notification_type"]
          read_at?: string | null
          recipient_id: string
          session_id?: string | null
          task_reassign_request_id?: string | null
          task_request_id?: string | null
          title: string
        }
        Update: {
          batch_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type?: Database["public"]["Enums"]["assignment_notification_type"]
          read_at?: string | null
          recipient_id?: string
          session_id?: string | null
          task_reassign_request_id?: string | null
          task_request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_notifications_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "task_assignment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_task_reassign_request_id_fkey"
            columns: ["task_reassign_request_id"]
            isOneToOne: false
            referencedRelation: "task_reassign_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_task_request_id_fkey"
            columns: ["task_request_id"]
            isOneToOne: false
            referencedRelation: "task_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_recipients: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          recipient_id: string
          status: Database["public"]["Enums"]["recipient_status"]
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          recipient_id: string
          status?: Database["public"]["Enums"]["recipient_status"]
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
          status?: Database["public"]["Enums"]["recipient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "assignment_recipients_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "task_assignment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_members: {
        Row: {
          added_at: string
          channel_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          channel_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          kind: string
          name: string
          pinned_at: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          name: string
          pinned_at?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          pinned_at?: string | null
          slug?: string
        }
        Relationships: []
      }
      chat_link_previews: {
        Row: {
          description: string | null
          fetched_at: string
          image_url: string | null
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          description?: string | null
          fetched_at?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
          sender_initial: string
          sender_name: string
        }
        Insert: {
          attachments?: Json
          channel_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
          sender_initial?: string
          sender_name: string
        }
        Update: {
          attachments?: Json
          channel_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
          sender_initial?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_mentions: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          mentioned_by: string
          mentioned_by_name: string
          mentioned_user_id: string
          message_id: string
          token: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          mentioned_by: string
          mentioned_by_name: string
          mentioned_user_id: string
          message_id: string
          token: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          mentioned_by?: string
          mentioned_by_name?: string
          mentioned_user_id?: string
          message_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_mentions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_mentions_mentioned_by_fkey"
            columns: ["mentioned_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          channel_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
          user_name: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          id: string
          logged_by: string | null
          rating: number
          reviewed_at: string
          source: string
          team_id: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          rating: number
          reviewed_at?: string
          source?: string
          team_id: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          rating?: number
          reviewed_at?: string
          source?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_review_link?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_review_link?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_run_log: {
        Row: {
          duration_ms: number | null
          frequency: string | null
          id: string
          job_name: string
          notes: string | null
          ran_at: string
          users_failed: number
          users_processed: number
        }
        Insert: {
          duration_ms?: number | null
          frequency?: string | null
          id?: string
          job_name: string
          notes?: string | null
          ran_at?: string
          users_failed?: number
          users_processed?: number
        }
        Update: {
          duration_ms?: number | null
          frequency?: string | null
          id?: string
          job_name?: string
          notes?: string | null
          ran_at?: string
          users_failed?: number
          users_processed?: number
        }
        Relationships: []
      }
      deliverable_submissions: {
        Row: {
          created_at: string | null
          dropbox_url: string | null
          id: string
          intern_id: string
          notes: string | null
          platform_tag: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submission_date: string
          submission_type: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          dropbox_url?: string | null
          id?: string
          intern_id: string
          notes?: string | null
          platform_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_date: string
          submission_type: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          dropbox_url?: string | null
          id?: string
          intern_id?: string
          notes?: string | null
          platform_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_date?: string
          submission_type?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_submissions_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_submissions_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      education_students: {
        Row: {
          assigned_to: string | null
          contact_email: string | null
          created_at: string | null
          id: string
          instrument: string | null
          level: string | null
          notes: string | null
          status: string
          student_name: string
          team_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          instrument?: string | null
          level?: string | null
          notes?: string | null
          status?: string
          student_name: string
          team_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          instrument?: string | null
          level?: string | null
          notes?: string | null
          status?: string
          student_name?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_students_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_students_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      flywheel_events: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          metadata: Json
          occurred_at: string
          source_id: string | null
          source_type: string
          stage: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          source_type: string
          stage: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          source_type?: string
          stage?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flywheel_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flywheel_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          calendar_id: string
          connected_by: string | null
          created_at: string
          encrypted_refresh_token: string
          google_email: string
          google_sync_token: string | null
          inbound_last_sync_error: string | null
          inbound_last_sync_summary: Json
          inbound_last_synced_at: string | null
          last_sync_error: string | null
          last_tested_at: string | null
          refresh_token_iv: string
          team_id: string
          token_scope: string[]
          token_type: string
          updated_at: string
        }
        Insert: {
          calendar_id?: string
          connected_by?: string | null
          created_at?: string
          encrypted_refresh_token: string
          google_email: string
          google_sync_token?: string | null
          inbound_last_sync_error?: string | null
          inbound_last_sync_summary?: Json
          inbound_last_synced_at?: string | null
          last_sync_error?: string | null
          last_tested_at?: string | null
          refresh_token_iv: string
          team_id: string
          token_scope?: string[]
          token_type?: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          connected_by?: string | null
          created_at?: string
          encrypted_refresh_token?: string
          google_email?: string
          google_sync_token?: string | null
          inbound_last_sync_error?: string | null
          inbound_last_sync_summary?: Json
          inbound_last_synced_at?: string | null
          last_sync_error?: string | null
          last_tested_at?: string | null
          refresh_token_iv?: string
          team_id?: string
          token_scope?: string[]
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_states: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          redirect_to: string
          state: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          redirect_to: string
          state: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          redirect_to?: string
          state?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_states_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_oauth_states_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      media_submissions: {
        Row: {
          content_type: string | null
          created_at: string
          drive_file_id: string
          drive_view_url: string | null
          id: string
          member_id: string
          original_filename: string
          size_bytes: number
          stored_filename: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          drive_file_id: string
          drive_view_url?: string | null
          id?: string
          member_id: string
          original_filename: string
          size_bytes: number
          stored_filename: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          drive_file_id?: string
          drive_view_url?: string | null
          id?: string
          member_id?: string
          original_filename?: string
          size_bytes?: number
          stored_filename?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_kpi_entries: {
        Row: {
          created_at: string | null
          entered_by: string | null
          entry_date: string
          id: string
          kpi_id: string
          notes: string | null
          team_id: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          entry_date: string
          id?: string
          kpi_id: string
          notes?: string | null
          team_id?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          entry_date?: string
          id?: string
          kpi_id?: string
          notes?: string | null
          team_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_kpi_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_kpi_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "member_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      member_kpis: {
        Row: {
          created_at: string | null
          created_by: string | null
          flywheel_stage: string
          id: string
          intern_id: string
          name: string
          target_direction: string | null
          target_value: number | null
          team_id: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          flywheel_stage: string
          id?: string
          intern_id: string
          name: string
          target_direction?: string | null
          target_value?: number | null
          team_id?: string | null
          unit?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          flywheel_stage?: string
          id?: string
          intern_id?: string
          name?: string
          target_direction?: string | null
          target_value?: number | null
          team_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_kpis_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_kpis_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_presence_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          last_seen_at: string
          member_id: string
          source: string
          started_at: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          member_id: string
          source?: string
          started_at?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          member_id?: string
          source?: string
          started_at?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_presence_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_presence_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_presence_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_metrics: {
        Row: {
          created_at: string | null
          entered_by: string | null
          follower_count: number
          id: string
          metric_date: string
          platform: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          entered_by?: string | null
          follower_count: number
          id?: string
          metric_date: string
          platform: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          entered_by?: string | null
          follower_count?: number
          id?: string
          metric_date?: string
          platform?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_metrics_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_metrics_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_to: string | null
          client_name: string | null
          created_at: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          project_type: string
          status: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_name?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          project_type: string
          status?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_name?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_type?: string
          status?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string | null
          fields: Json
          id: string
          is_default: boolean | null
          name: string
          position: string | null
          team_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fields?: Json
          id?: string
          is_default?: boolean | null
          name: string
          position?: string | null
          team_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fields?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          position?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          assigned_to: string | null
          calendar_last_changed_at: string | null
          calendar_last_changed_source: string
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          end_time: string
          google_event_id: string | null
          google_last_synced_at: string | null
          google_sync_error: string | null
          google_sync_status: string
          id: string
          notes: string | null
          project_id: string | null
          recurrence_last_spawned_at: string | null
          recurrence_parent_id: string | null
          recurrence_spec: Json | null
          room: string | null
          session_date: string
          session_type: string
          start_time: string
          status: string
          team_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          calendar_last_changed_at?: string | null
          calendar_last_changed_source?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time: string
          google_event_id?: string | null
          google_last_synced_at?: string | null
          google_sync_error?: string | null
          google_sync_status?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          recurrence_last_spawned_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_spec?: Json | null
          room?: string | null
          session_date: string
          session_type: string
          start_time: string
          status?: string
          team_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          calendar_last_changed_at?: string | null
          calendar_last_changed_source?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          google_event_id?: string | null
          google_last_synced_at?: string | null
          google_sync_error?: string | null
          google_sync_status?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          recurrence_last_spawned_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_spec?: Json | null
          room?: string | null
          session_date?: string
          session_type?: string
          start_time?: string
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_hours_of_operation: {
        Row: {
          active: boolean
          close_time: string
          created_at: string
          id: string
          open_time: string
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          active?: boolean
          close_time: string
          created_at?: string
          id?: string
          open_time: string
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          active?: boolean
          close_time?: string
          created_at?: string
          id?: string
          open_time?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_hours_of_operation_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_hours_of_operation_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      support_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          page_url: string | null
          reported_by: string | null
          severity: string
          status: string
          team_id: string
          user_agent: string | null
          what_tried: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          reported_by?: string | null
          severity?: string
          status?: string
          team_id: string
          user_agent?: string | null
          what_tried?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          reported_by?: string | null
          severity?: string
          status?: string
          team_id?: string
          user_agent?: string | null
          what_tried?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignment_batches: {
        Row: {
          assigned_by: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          source_template_id: string | null
          title: string
        }
        Insert: {
          assigned_by: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          source_template_id?: string | null
          title: string
        }
        Update: {
          assigned_by?: string
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          source_template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignment_batches_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignment_batches_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignment_batches_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          intern_id: string | null
          is_active: boolean | null
          position: string | null
          team_id: string | null
          template_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          intern_id?: string | null
          is_active?: boolean | null
          position?: string | null
          team_id?: string | null
          template_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          intern_id?: string | null
          is_active?: boolean | null
          position?: string | null
          team_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_edit_requests: {
        Row: {
          apply_to_template: boolean
          change_type: Database["public"]["Enums"]["task_edit_change_type"]
          created_at: string
          id: string
          instance_id: string
          item_id: string | null
          previous_text: string | null
          proposed_category: string | null
          proposed_text: string | null
          reject_reason: string | null
          requested_at: string
          requested_by: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["task_edit_status"]
          team_id: string | null
        }
        Insert: {
          apply_to_template?: boolean
          change_type: Database["public"]["Enums"]["task_edit_change_type"]
          created_at?: string
          id?: string
          instance_id: string
          item_id?: string | null
          previous_text?: string | null
          proposed_category?: string | null
          proposed_text?: string | null
          reject_reason?: string | null
          requested_at?: string
          requested_by: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["task_edit_status"]
          team_id?: string | null
        }
        Update: {
          apply_to_template?: boolean
          change_type?: Database["public"]["Enums"]["task_edit_change_type"]
          created_at?: string
          id?: string
          instance_id?: string
          item_id?: string | null
          previous_text?: string | null
          proposed_category?: string | null
          proposed_text?: string | null
          reject_reason?: string | null
          requested_at?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["task_edit_status"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_edit_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edit_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reassign_requests: {
        Row: {
          created_at: string
          current_assignee_id: string
          direction: string
          id: string
          note: string | null
          requester_id: string
          resolved_at: string | null
          resolver_id: string | null
          status: string
          task_id: string
        }
        Insert: {
          created_at?: string
          current_assignee_id: string
          direction?: string
          id?: string
          note?: string | null
          requester_id: string
          resolved_at?: string | null
          resolver_id?: string | null
          status?: string
          task_id: string
        }
        Update: {
          created_at?: string
          current_assignee_id?: string
          direction?: string
          id?: string
          note?: string | null
          requester_id?: string
          resolved_at?: string | null
          resolver_id?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reassign_requests_current_assignee_id_fkey"
            columns: ["current_assignee_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_current_assignee_id_fkey"
            columns: ["current_assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_resolver_id_fkey"
            columns: ["resolver_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_resolver_id_fkey"
            columns: ["resolver_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reassign_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "assigned_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_requests: {
        Row: {
          approved_task_id: string | null
          category: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_required: boolean
          kind: string
          proposed: Json | null
          recurrence_spec: Json | null
          requester_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          target_task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_task_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          kind?: string
          proposed?: Json | null
          recurrence_spec?: Json | null
          requester_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          target_task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_task_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          kind?: string
          proposed?: Json | null
          recurrence_spec?: Json | null
          requester_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          target_task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_requests_approved_task_id_fkey"
            columns: ["approved_task_id"]
            isOneToOne: false
            referencedRelation: "assigned_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_requests_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "assigned_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_items: {
        Row: {
          category: string | null
          created_at: string
          default_due_offset_days: number | null
          description: string | null
          id: string
          is_required: boolean
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_due_offset_days?: number | null
          description?: string | null
          id?: string
          is_required?: boolean
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_due_offset_days?: number | null
          description?: string | null
          id?: string
          is_required?: boolean
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          is_onboarding: boolean
          name: string
          role_tag: string | null
          template_kind: Database["public"]["Enums"]["template_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_onboarding?: boolean
          name: string
          role_tag?: string | null
          template_kind?: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_onboarding?: boolean
          name?: string
          role_tag?: string | null
          template_kind?: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_checklist_instances: {
        Row: {
          created_at: string | null
          frequency: string
          id: string
          intern_id: string
          period_date: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          frequency: string
          id?: string
          intern_id: string
          period_date: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: string
          id?: string
          intern_id?: string
          period_date?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_checklist_instances_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_instances_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_checklist_items: {
        Row: {
          category: string
          completed_at: string | null
          id: string
          instance_id: string
          is_completed: boolean | null
          item_text: string
          sort_order: number | null
          team_id: string | null
          template_id: string | null
        }
        Insert: {
          category: string
          completed_at?: string | null
          id?: string
          instance_id: string
          is_completed?: boolean | null
          item_text: string
          sort_order?: number | null
          team_id?: string | null
          template_id?: string | null
        }
        Update: {
          category?: string
          completed_at?: string | null
          id?: string
          instance_id?: string
          is_completed?: boolean | null
          item_text?: string
          sort_order?: number | null
          team_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_checklist_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      team_checklist_templates: {
        Row: {
          category: string
          created_at: string | null
          frequency: string
          id: string
          is_active: boolean | null
          item_text: string
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          item_text: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          item_text?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      team_daily_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          intern_id: string
          manager_reply: string | null
          note_date: string
          replied_at: string | null
          submitted_at: string | null
          team_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          intern_id: string
          manager_reply?: string | null
          note_date: string
          replied_at?: string | null
          submitted_at?: string | null
          team_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          intern_id?: string
          manager_reply?: string | null
          note_date?: string
          replied_at?: string | null
          submitted_at?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_daily_notes_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_daily_notes_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_lead_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          lead_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          lead_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intern_lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "intern_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leads: {
        Row: {
          amount: number | null
          company: string | null
          contact: string | null
          contact_info: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          follow_up_date: string | null
          id: string
          intern_id: string | null
          lead_type: string | null
          name: string | null
          needs_follow_up: boolean | null
          notes: string | null
          phone: string | null
          priority: string | null
          social_links: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          company?: string | null
          contact?: string | null
          contact_info?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          intern_id?: string | null
          lead_type?: string | null
          name?: string | null
          needs_follow_up?: boolean | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          social_links?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          company?: string | null
          contact?: string | null
          contact_info?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string
          intern_id?: string | null
          lead_type?: string | null
          name?: string | null
          needs_follow_up?: boolean | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          social_links?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_maintenance_completions: {
        Row: {
          checked_at: string
          checked_by: string
          id: string
          item_id: string
          period_key: string
          team_id: string
        }
        Insert: {
          checked_at?: string
          checked_by: string
          id?: string
          item_id: string
          period_key: string
          team_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          id?: string
          item_id?: string
          period_key?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_maintenance_completions_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_completions_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_completions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "team_maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_completions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_maintenance_items: {
        Row: {
          assigned_to: string | null
          cadence: string
          claim_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          sort_order: number
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cadence: string
          claim_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          sort_order?: number
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cadence?: string
          claim_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          sort_order?: number
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_maintenance_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_maintenance_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          department: string | null
          display_name: string
          email: string | null
          end_date: string | null
          id: string
          managed_by: string | null
          notification_prefs: Json
          phone: string | null
          position: string | null
          preferences: Json
          pronouns: string | null
          role: string
          socials: Json
          start_date: string | null
          status: string | null
          team_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          department?: string | null
          display_name: string
          email?: string | null
          end_date?: string | null
          id: string
          managed_by?: string | null
          notification_prefs?: Json
          phone?: string | null
          position?: string | null
          preferences?: Json
          pronouns?: string | null
          role: string
          socials?: Json
          start_date?: string | null
          status?: string | null
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          department?: string | null
          display_name?: string
          email?: string | null
          end_date?: string | null
          id?: string
          managed_by?: string | null
          notification_prefs?: Json
          phone?: string | null
          position?: string | null
          preferences?: Json
          pronouns?: string | null
          role?: string
          socials?: Json
          start_date?: string | null
          status?: string | null
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intern_users_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_users_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_performance_reviews: {
        Row: {
          created_at: string | null
          id: string
          intern_id: string
          notes: string | null
          overall_score: number | null
          published_at: string | null
          review_period: string
          reviewer_id: string
          status: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intern_id: string
          notes?: string | null
          overall_score?: number | null
          published_at?: string | null
          review_period: string
          reviewer_id: string
          status?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intern_id?: string
          notes?: string | null
          overall_score?: number | null
          published_at?: string | null
          review_period?: string
          reviewer_id?: string
          status?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_performance_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_performance_scores: {
        Row: {
          category: string
          id: string
          review_id: string
          score: number
          team_id: string | null
        }
        Insert: {
          category: string
          id?: string
          review_id: string
          score: number
          team_id?: string | null
        }
        Update: {
          category?: string
          id?: string
          review_id?: string
          score?: number
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_performance_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "intern_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "team_performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      team_positions: {
        Row: {
          color: string | null
          created_at: string | null
          display_name: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_name: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      team_schedule_blocks: {
        Row: {
          approved_by: string | null
          created_at: string
          ends_at: string
          id: string
          member_id: string
          note: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          ends_at: string
          id?: string
          member_id: string
          note?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          member_id?: string
          note?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_schedule_blocks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_blocks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_blocks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_blocks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_blocks_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_blocks_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_schedule_recurring: {
        Row: {
          active: boolean
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          member_id: string
          note: string | null
          pending_deletion: boolean
          requested_by: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          start_time: string
          status: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          end_time: string
          id?: string
          member_id: string
          note?: string | null
          pending_deletion?: boolean
          requested_by?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          start_time: string
          status?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string
          id?: string
          member_id?: string
          note?: string | null
          pending_deletion?: boolean
          requested_by?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_schedule_recurring_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_schedule_recurring_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_schedule_templates: {
        Row: {
          day_of_week: number
          focus_areas: string[]
          frequency: string | null
          id: string
          intern_id: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          day_of_week: number
          focus_areas?: string[]
          frequency?: string | null
          id?: string
          intern_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          day_of_week?: number
          focus_areas?: string[]
          frequency?: string | null
          id?: string
          intern_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_schedule_templates_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_schedule_templates_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          site_banner_fit: string
          site_banner_opacity: number
          site_banner_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          site_banner_fit?: string
          site_banner_opacity?: number
          site_banner_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          site_banner_fit?: string
          site_banner_opacity?: number
          site_banner_url?: string | null
        }
        Relationships: []
      }
      time_clock_entries: {
        Row: {
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clocked_in_at?: string
          clocked_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clocked_in_at?: string
          clocked_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_admin_reviews: {
        Row: {
          action_items: Json | null
          created_at: string | null
          flywheel_scores: Json
          id: string
          improvements: string | null
          intern_id: string
          kpi_on_track: boolean | null
          overall_score: number | null
          reviewer_id: string
          strengths: string | null
          team_id: string | null
          week_start: string
        }
        Insert: {
          action_items?: Json | null
          created_at?: string | null
          flywheel_scores?: Json
          id?: string
          improvements?: string | null
          intern_id: string
          kpi_on_track?: boolean | null
          overall_score?: number | null
          reviewer_id: string
          strengths?: string | null
          team_id?: string | null
          week_start: string
        }
        Update: {
          action_items?: Json | null
          created_at?: string | null
          flywheel_scores?: Json
          id?: string
          improvements?: string | null
          intern_id?: string
          kpi_on_track?: boolean | null
          overall_score?: number | null
          reviewer_id?: string
          strengths?: string | null
          team_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_admin_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_admin_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_admin_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_admin_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      intern_checklist_instances: {
        Row: {
          created_at: string | null
          frequency: string | null
          id: string | null
          intern_id: string | null
          period_date: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: string | null
          id?: string | null
          intern_id?: string | null
          period_date?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: string | null
          id?: string | null
          intern_id?: string | null
          period_date?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_checklist_instances_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_instances_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_checklist_items: {
        Row: {
          category: string | null
          completed_at: string | null
          id: string | null
          instance_id: string | null
          is_completed: boolean | null
          item_text: string | null
          sort_order: number | null
          team_id: string | null
          template_id: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          id?: string | null
          instance_id?: string | null
          is_completed?: boolean | null
          item_text?: string | null
          sort_order?: number | null
          team_id?: string | null
          template_id?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          id?: string | null
          instance_id?: string | null
          is_completed?: boolean | null
          item_text?: string | null
          sort_order?: number | null
          team_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_checklist_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "intern_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "team_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_checklist_templates: {
        Row: {
          category: string | null
          created_at: string | null
          frequency: string | null
          id: string | null
          is_active: boolean | null
          item_text: string | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          frequency?: string | null
          id?: string | null
          is_active?: boolean | null
          item_text?: string | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          frequency?: string | null
          id?: string | null
          is_active?: boolean | null
          item_text?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      intern_daily_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          intern_id: string | null
          manager_reply: string | null
          note_date: string | null
          replied_at: string | null
          submitted_at: string | null
          team_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          intern_id?: string | null
          manager_reply?: string | null
          note_date?: string | null
          replied_at?: string | null
          submitted_at?: string | null
          team_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          intern_id?: string | null
          manager_reply?: string | null
          note_date?: string | null
          replied_at?: string | null
          submitted_at?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_daily_notes_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_daily_notes_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_lead_activities: {
        Row: {
          activity_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          lead_id: string | null
        }
        Insert: {
          activity_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          lead_id?: string | null
        }
        Update: {
          activity_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "intern_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_leads: {
        Row: {
          amount: number | null
          company: string | null
          contact: string | null
          contact_info: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          follow_up_date: string | null
          id: string | null
          intern_id: string | null
          lead_type: string | null
          name: string | null
          needs_follow_up: boolean | null
          notes: string | null
          phone: string | null
          priority: string | null
          social_links: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          company?: string | null
          contact?: string | null
          contact_info?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string | null
          intern_id?: string | null
          lead_type?: string | null
          name?: string | null
          needs_follow_up?: boolean | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          social_links?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          company?: string | null
          contact?: string | null
          contact_info?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up_date?: string | null
          id?: string | null
          intern_id?: string | null
          lead_type?: string | null
          name?: string | null
          needs_follow_up?: boolean | null
          notes?: string | null
          phone?: string | null
          priority?: string | null
          social_links?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_leads_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_performance_reviews: {
        Row: {
          created_at: string | null
          id: string | null
          intern_id: string | null
          notes: string | null
          overall_score: number | null
          published_at: string | null
          review_period: string | null
          reviewer_id: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          intern_id?: string | null
          notes?: string | null
          overall_score?: number | null
          published_at?: string | null
          review_period?: string | null
          reviewer_id?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          intern_id?: string | null
          notes?: string | null
          overall_score?: number | null
          published_at?: string | null
          review_period?: string | null
          reviewer_id?: string | null
          status?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_performance_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_performance_scores: {
        Row: {
          category: string | null
          id: string | null
          review_id: string | null
          score: number | null
          team_id: string | null
        }
        Insert: {
          category?: string | null
          id?: string | null
          review_id?: string | null
          score?: number | null
          team_id?: string | null
        }
        Update: {
          category?: string | null
          id?: string | null
          review_id?: string | null
          score?: number | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_performance_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "intern_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_performance_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "team_performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_schedule_templates: {
        Row: {
          day_of_week: number | null
          focus_areas: string[] | null
          frequency: string | null
          id: string | null
          intern_id: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          day_of_week?: number | null
          focus_areas?: string[] | null
          frequency?: string | null
          id?: string | null
          intern_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          day_of_week?: number | null
          focus_areas?: string[] | null
          frequency?: string | null
          id?: string | null
          intern_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_schedule_templates_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_schedule_templates_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_users: {
        Row: {
          created_at: string | null
          department: string | null
          display_name: string | null
          email: string | null
          end_date: string | null
          id: string | null
          managed_by: string | null
          phone: string | null
          position: string | null
          role: string | null
          start_date: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          end_date?: string | null
          id?: string | null
          managed_by?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          start_date?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          end_date?: string | null
          id?: string | null
          managed_by?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          start_date?: string | null
          status?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intern_users_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "intern_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_users_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_task_template_item: {
        Args: {
          p_category?: string
          p_default_due_offset_days?: number
          p_description?: string
          p_is_required?: boolean
          p_sort_order?: number
          p_template_id: string
          p_title: string
        }
        Returns: Json
      }
      admin_bootstrap_member_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      admin_clone_task_to_members: {
        Args: { p_member_ids: string[]; p_task_id: string }
        Returns: Json
      }
      admin_currently_clocked_in: {
        Args: never
        Returns: {
          clocked_in_at: string
          display_name: string
          email: string
          entry_id: string
          user_id: string
        }[]
      }
      admin_delete_assigned_tasks: {
        Args: { p_task_ids: string[] }
        Returns: Json
      }
      admin_delete_future_sessions: {
        Args: { p_cancel_note?: string; p_session_id: string }
        Returns: Json
      }
      admin_delete_session: {
        Args: { p_cancel_note?: string; p_session_id: string }
        Returns: Json
      }
      admin_list_all_assigned_tasks: {
        Args: { p_include_completed?: boolean }
        Returns: Json
      }
      admin_list_all_sessions: {
        Args: { p_include_past?: boolean }
        Returns: Json
      }
      admin_list_clock_entries: {
        Args: { p_limit?: number; p_member_id?: string }
        Returns: {
          clocked_in_at: string
          clocked_out_at: string
          duration_minutes: number
          entry_id: string
          member_id: string
          member_name: string
          notes: string
        }[]
      }
      admin_recent_approvals: { Args: { p_limit?: number }; Returns: Json }
      admin_recent_assignments: { Args: { p_limit?: number }; Returns: Json }
      admin_team_maintenance_archive: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      admin_team_maintenance_create:
        | {
            Args: {
              p_cadence: string
              p_description?: string
              p_sort_order?: number
              p_title: string
            }
            Returns: {
              assigned_to: string | null
              cadence: string
              claim_type: string
              created_at: string
              created_by: string | null
              description: string | null
              id: string
              is_archived: boolean
              sort_order: number
              team_id: string
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "team_maintenance_items"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_assigned_to?: string
              p_cadence: string
              p_claim_type?: string
              p_description?: string
              p_sort_order?: number
              p_title: string
            }
            Returns: {
              assigned_to: string | null
              cadence: string
              claim_type: string
              created_at: string
              created_by: string | null
              description: string | null
              id: string
              is_archived: boolean
              sort_order: number
              team_id: string
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "team_maintenance_items"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      admin_team_maintenance_update:
        | {
            Args: {
              p_cadence?: string
              p_clear_description?: boolean
              p_description?: string
              p_item_id: string
              p_sort_order?: number
              p_title?: string
            }
            Returns: {
              assigned_to: string | null
              cadence: string
              claim_type: string
              created_at: string
              created_by: string | null
              description: string | null
              id: string
              is_archived: boolean
              sort_order: number
              team_id: string
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "team_maintenance_items"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_assigned_to?: string
              p_cadence?: string
              p_claim_type?: string
              p_clear_assigned_to?: boolean
              p_clear_description?: boolean
              p_description?: string
              p_item_id: string
              p_sort_order?: number
              p_title?: string
            }
            Returns: {
              assigned_to: string | null
              cadence: string
              claim_type: string
              created_at: string
              created_by: string | null
              description: string | null
              id: string
              is_archived: boolean
              sort_order: number
              team_id: string
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "team_maintenance_items"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      admin_update_assigned_task:
        | {
            Args: {
              p_category?: string
              p_clear_category?: boolean
              p_clear_description?: boolean
              p_clear_due?: boolean
              p_clear_studio_space?: boolean
              p_description?: string
              p_due_date?: string
              p_studio_space?: string
              p_task_id: string
              p_title?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assigned_to?: string
              p_category?: string
              p_clear_assigned_to?: boolean
              p_clear_category?: boolean
              p_clear_description?: boolean
              p_clear_due?: boolean
              p_clear_recurrence_spec?: boolean
              p_clear_studio_space?: boolean
              p_description?: string
              p_due_date?: string
              p_is_required?: boolean
              p_recurrence_spec?: Json
              p_studio_space?: string
              p_task_id: string
              p_title?: string
            }
            Returns: Json
          }
      admin_update_session: {
        Args: {
          p_assigned_to?: string
          p_clear_assigned_to?: boolean
          p_clear_client_name?: boolean
          p_clear_notes?: boolean
          p_clear_room?: boolean
          p_client_name?: string
          p_end_time?: string
          p_notes?: string
          p_room?: string
          p_session_date?: string
          p_session_id: string
          p_session_type?: string
          p_start_time?: string
          p_status?: string
        }
        Returns: Json
      }
      approve_task_edit_request: {
        Args: { p_apply_to_template?: boolean; p_request_id: string }
        Returns: undefined
      }
      approve_task_reassignment: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approve_task_request: {
        Args: { p_category?: string; p_request_id: string }
        Returns: Json
      }
      archive_client: {
        Args: { p_id: string }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_custom_task_to_members:
        | {
            Args: {
              p_category?: string
              p_description?: string
              p_due_date?: string
              p_is_required?: boolean
              p_member_ids: string[]
              p_show_on_overview?: boolean
              p_title: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_category?: string
              p_description?: string
              p_due_date?: string
              p_is_required?: boolean
              p_member_ids: string[]
              p_scope?: string
              p_show_on_overview?: boolean
              p_title: string
            }
            Returns: Json
          }
      assign_custom_tasks_to_members: {
        Args: {
          p_batch_title?: string
          p_member_ids: string[]
          p_scope?: string
          p_tasks: Json
        }
        Returns: Json
      }
      assign_session: {
        Args: { p_assignee_id: string; p_session_id: string }
        Returns: Json
      }
      assign_template_items_to_members: {
        Args: {
          p_description_override?: string
          p_due_date?: string
          p_member_ids: string[]
          p_show_on_overview?: boolean
          p_template_id: string
          p_template_item_ids: string[]
          p_title_override?: string
        }
        Returns: Json
      }
      assign_template_preview: {
        Args: { p_template_id: string; p_template_item_ids?: string[] }
        Returns: Json
      }
      assign_template_to_members: {
        Args: {
          p_description_override?: string
          p_due_date?: string
          p_member_ids: string[]
          p_show_on_overview?: boolean
          p_template_id: string
          p_title_override?: string
        }
        Returns: Json
      }
      add_chat_message_mentions: {
        Args: { p_mentioned_user_ids: string[]; p_message_id: string }
        Returns: number
      }
      cancel_my_task_reassignment: {
        Args: { p_request_id: string }
        Returns: Json
      }
      cancel_my_task_request: { Args: { p_request_id: string }; Returns: Json }
      cancel_task_assignment_batch: {
        Args: { p_batch_id: string; p_hide_open_tasks?: boolean }
        Returns: Json
      }
      clock_in: {
        Args: never
        Returns: {
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_clock_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clock_out: {
        Args: { p_notes?: string }
        Returns: {
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_clock_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_assigned_task: {
        Args: { p_assigned_task_id: string; p_is_completed: boolean }
        Returns: Json
      }
      create_client: {
        Args: {
          p_email?: string
          p_google_review_link?: string
          p_name: string
          p_notes?: string
          p_phone?: string
        }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group_dm: {
        Args: { p_members: string[]; p_title?: string }
        Returns: string
      }
      create_task_template: {
        Args: {
          p_description?: string
          p_is_onboarding?: boolean
          p_name: string
          p_role_tag?: string
        }
        Returns: Json
      }
      cron_materialize_checklists: { Args: never; Returns: undefined }
      decline_task_reassignment: {
        Args: { p_note?: string; p_request_id: string }
        Returns: Json
      }
      delete_task_template: { Args: { p_template_id: string }; Returns: Json }
      delete_task_template_item: { Args: { p_item_id: string }; Returns: Json }
      duplicate_task_template: {
        Args: { p_new_name: string; p_template_id: string }
        Returns: Json
      }
      find_or_create_dm: { Args: { p_other: string }; Returns: string }
      get_assignment_notifications: {
        Args: { p_limit?: number; p_unread_only?: boolean; p_user_id: string }
        Returns: Json
      }
      get_channel_notifications: {
        Args: never
        Returns: {
          channel_id: string
          channel_name: string
          channel_slug: string
          last_read_at: string
          latest_content: string
          latest_created_at: string
          latest_id: string
          latest_initial: string
          latest_sender: string
          unread_count: number
        }[]
      }
      get_clients: {
        Args: { p_include_archived?: boolean }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_direct_reports: { Args: { manager: string }; Returns: string[] }
      get_dm_threads: {
        Args: never
        Returns: {
          channel_id: string
          kind: string
          last_read_at: string
          latest_content: string
          latest_created_at: string
          latest_id: string
          latest_sender: string
          members: Json
          title: string
          unread_count: number
        }[]
      }
      get_flywheel_stage_summary: {
        Args: { p_member?: string; p_since?: string; p_until?: string }
        Returns: {
          event_count: number
          stage: string
        }[]
      }
      get_member_assigned_tasks: {
        Args: {
          p_include_completed?: boolean
          p_only_overview?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      get_my_incoming_reassign_requests: { Args: never; Returns: Json }
      get_my_open_clock_entry: {
        Args: never
        Returns: {
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_clock_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_outgoing_pending_reassign_requests: { Args: never; Returns: Json }
      get_my_task_requests: { Args: { p_limit?: number }; Returns: Json }
      get_my_team_id: { Args: never; Returns: string }
      get_team_site_branding: {
        Args: never
        Returns: {
          site_banner_fit: string
          site_banner_opacity: number
          site_banner_url: string | null
        }[]
      }
      get_pending_task_requests: { Args: never; Returns: Json }
      get_studio_assigned_tasks: {
        Args: { p_include_completed?: boolean; p_user_id: string }
        Returns: Json
      }
      get_task_template_detail: {
        Args: { p_template_id: string }
        Returns: Json
      }
      get_task_template_library: {
        Args: { p_include_inactive?: boolean; p_role_tag?: string }
        Returns: Json
      }
      get_team_assigned_tasks: {
        Args: { p_include_completed?: boolean; p_user_id: string }
        Returns: Json
      }
      presence_close: {
        Args: never
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          last_seen_at: string
          member_id: string
          source: string
          started_at: string
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_presence_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      presence_ping: {
        Args: { p_idle_minutes?: number }
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          last_seen_at: string
          member_id: string
          source: string
          started_at: string
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_presence_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      intern_generate_checklist: {
        Args: { p_date: string; p_frequency: string; p_intern_id: string }
        Returns: string
      }
      intern_get_user_role: { Args: never; Returns: string }
      is_channel_member: {
        Args: { p_channel: string; p_uid?: string }
        Returns: boolean
      }
      update_team_site_branding: {
        Args: {
          p_site_banner_fit?: string
          p_site_banner_opacity?: number
          p_site_banner_url: string | null
        }
        Returns: {
          site_banner_fit: string
          site_banner_opacity: number
          site_banner_url: string | null
        }[]
      }
      is_private_channel: { Args: { p_channel: string }; Returns: boolean }
      is_team_admin: { Args: never; Returns: boolean }
      log_client_review: {
        Args: {
          p_body?: string
          p_client_id: string
          p_rating: number
          p_source?: string
        }
        Returns: string
      }
      mark_all_assignment_notifications_read: { Args: never; Returns: Json }
      mark_all_channels_read: { Args: never; Returns: Json }
      mark_assignment_notification_read: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      mark_channel_read: { Args: { p_channel_id: string }; Returns: undefined }
      member_overview_snapshot: {
        Args: { p_date: string; p_user_id: string }
        Returns: Json
      }
      owner_reset_member_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      owner_set_member_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          department: string | null
          display_name: string
          email: string | null
          end_date: string | null
          id: string
          managed_by: string | null
          notification_prefs: Json
          phone: string | null
          position: string | null
          preferences: Json
          pronouns: string | null
          role: string
          socials: Json
          start_date: string | null
          status: string | null
          team_id: string | null
          timezone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "team_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_daily_checklist: {
        Args: {
          p_replace?: boolean
          p_target_ids?: string[]
          p_target_mode: string
          p_target_position?: string
        }
        Returns: Json
      }
      record_flywheel_event: {
        Args: {
          p_member_id?: string
          p_metadata?: Json
          p_occurred_at?: string
          p_source_id?: string
          p_source_type: string
          p_stage: string
        }
        Returns: string
      }
      reject_task_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: Json
      }
      request_recurring_deletion: {
        Args: { p_note?: string; p_rule_id: string }
        Returns: {
          active: boolean
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          member_id: string
          note: string | null
          pending_deletion: boolean
          requested_by: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          start_time: string
          status: string
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "team_schedule_recurring"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_task_reassignment: {
        Args: { p_note?: string; p_task_id: string }
        Returns: Json
      }
      search_clients: {
        Args: { p_query: string }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_support_report_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      spawn_recurring_session_instances: { Args: never; Returns: undefined }
      spawn_recurring_task_instances: { Args: never; Returns: undefined }
      submit_support_report: {
        Args: {
          p_description: string
          p_page_url?: string
          p_severity?: string
          p_user_agent?: string
          p_what_tried?: string
        }
        Returns: string
      }
      submit_task_delete_request: {
        Args: { p_reason?: string; p_task_id: string }
        Returns: Json
      }
      submit_task_edit_request: {
        Args: { p_proposed: Json; p_reason?: string; p_task_id: string }
        Returns: Json
      }
      submit_task_request:
        | {
            Args: {
              p_category?: string
              p_description?: string
              p_due_date?: string
              p_title: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_category?: string
              p_description?: string
              p_due_date?: string
              p_recurrence_spec?: Json
              p_title: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_category?: string
              p_description?: string
              p_due_date?: string
              p_is_required?: boolean
              p_recurrence_spec?: Json
              p_title: string
            }
            Returns: Json
          }
      submit_task_transfer_request: {
        Args: { p_note: string; p_target_member_id: string; p_task_id: string }
        Returns: Json
      }
      team_maintenance_list: {
        Args: never
        Returns: {
          assigned_to: string
          assigned_to_name: string
          cadence: string
          claim_type: string
          completions: Json
          created_at: string
          description: string
          id: string
          period_key: string
          sort_order: number
          title: string
        }[]
      }
      team_maintenance_period_key: {
        Args: { p_at?: string; p_cadence: string }
        Returns: string
      }
      team_maintenance_toggle: {
        Args: { p_check: boolean; p_item_id: string }
        Returns: Json
      }
      update_client: {
        Args: {
          p_archived?: boolean
          p_email?: string
          p_google_review_link?: string
          p_id: string
          p_name?: string
          p_notes?: string
          p_phone?: string
        }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          google_review_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_task_template: {
        Args: {
          p_description?: string
          p_is_active?: boolean
          p_is_onboarding?: boolean
          p_name?: string
          p_role_tag?: string
          p_template_id: string
        }
        Returns: Json
      }
      update_task_template_item: {
        Args: {
          p_category?: string
          p_default_due_offset_days?: number
          p_description?: string
          p_is_required?: boolean
          p_item_id: string
          p_sort_order?: number
          p_title?: string
        }
        Returns: Json
      }
      withdraw_recurring_deletion_request: {
        Args: { p_rule_id: string }
        Returns: {
          active: boolean
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          member_id: string
          note: string | null
          pending_deletion: boolean
          requested_by: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          start_time: string
          status: string
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "team_schedule_recurring"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      assigned_source_type: "custom" | "template_full" | "template_partial"
      assignment_notification_type:
        | "task_assigned"
        | "template_assigned"
        | "partial_template_assigned"
        | "session_assigned"
        | "session_reassigned"
        | "task_request_submitted"
        | "task_request_approved"
        | "task_request_rejected"
        | "task_reassign_requested"
        | "task_reassign_approved"
        | "task_reassign_declined"
        | "task_edited"
        | "task_request_cancelled"
      assignment_type: "custom_task" | "template_full" | "template_partial"
      recipient_status: "active" | "completed" | "archived" | "cancelled"
      task_edit_change_type: "add" | "rename" | "delete"
      task_edit_status: "pending" | "approved" | "rejected"
      template_kind: "admin_blueprint" | "recurring_checklist"
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
  public: {
    Enums: {
      assigned_source_type: ["custom", "template_full", "template_partial"],
      assignment_notification_type: [
        "task_assigned",
        "template_assigned",
        "partial_template_assigned",
        "session_assigned",
        "session_reassigned",
        "task_request_submitted",
        "task_request_approved",
        "task_request_rejected",
        "task_reassign_requested",
        "task_reassign_approved",
        "task_reassign_declined",
        "task_edited",
        "task_request_cancelled",
      ],
      assignment_type: ["custom_task", "template_full", "template_partial"],
      recipient_status: ["active", "completed", "archived", "cancelled"],
      task_edit_change_type: ["add", "rename", "delete"],
      task_edit_status: ["pending", "approved", "rejected"],
      template_kind: ["admin_blueprint", "recurring_checklist"],
    },
  },
} as const
