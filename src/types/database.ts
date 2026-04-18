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
      chat_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          id: string
          sender_id: string
          sender_initial: string
          sender_name: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          sender_id: string
          sender_initial?: string
          sender_name: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
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
          client_name: string | null
          created_at: string | null
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          project_id: string | null
          room: string | null
          session_date: string
          session_type: string
          start_time: string
          status: string
          team_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          project_id?: string | null
          room?: string | null
          session_date: string
          session_type: string
          start_time: string
          status?: string
          team_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          project_id?: string | null
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
      team_members: {
        Row: {
          created_at: string | null
          department: string | null
          display_name: string
          email: string | null
          end_date: string | null
          id: string
          managed_by: string | null
          phone: string | null
          position: string | null
          role: string
          start_date: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          display_name: string
          email?: string | null
          end_date?: string | null
          id: string
          managed_by?: string | null
          phone?: string | null
          position?: string | null
          role: string
          start_date?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          display_name?: string
          email?: string | null
          end_date?: string | null
          id?: string
          managed_by?: string | null
          phone?: string | null
          position?: string | null
          role?: string
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
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
      approve_task_edit_request: {
        Args: { p_apply_to_template?: boolean; p_request_id: string }
        Returns: undefined
      }
      get_direct_reports: { Args: { manager: string }; Returns: string[] }
      get_my_team_id: { Args: never; Returns: string }
      intern_generate_checklist: {
        Args: { p_date: string; p_frequency: string; p_intern_id: string }
        Returns: string
      }
      intern_get_user_role: { Args: never; Returns: string }
      is_team_admin: { Args: never; Returns: boolean }
      owner_reset_member_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      owner_set_member_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: {
          created_at: string | null
          department: string | null
          display_name: string
          email: string | null
          end_date: string | null
          id: string
          managed_by: string | null
          phone: string | null
          position: string | null
          role: string
          start_date: string | null
          status: string | null
          team_id: string | null
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
    }
    Enums: {
      task_edit_change_type: "add" | "rename" | "delete"
      task_edit_status: "pending" | "approved" | "rejected"
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
      task_edit_change_type: ["add", "rename", "delete"],
      task_edit_status: ["pending", "approved", "rejected"],
    },
  },
} as const
