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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_title_changes: {
        Row: {
          action: string
          actor_name: string | null
          company_id: string
          created_at: string
          detail: Json
          entity: string
          id: string
          office_name: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          company_id: string
          created_at?: string
          detail?: Json
          entity: string
          id?: string
          office_name?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          company_id?: string
          created_at?: string
          detail?: Json
          entity?: string
          id?: string
          office_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_title_changes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      account_title_mappings: {
        Row: {
          account_title_id: string
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string
          condolence_target: string | null
          created_at: string
          id: string
          purchase_type: Database["public"]["Enums"]["purchase_type"] | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
        }
        Insert: {
          account_title_id: string
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string
          condolence_target?: string | null
          created_at?: string
          id?: string
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
        }
        Update: {
          account_title_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          company_id?: string
          condolence_target?: string | null
          created_at?: string
          id?: string
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_title_mappings_account_title_id_company_id_fkey"
            columns: ["account_title_id", "company_id"]
            isOneToOne: false
            referencedRelation: "account_titles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "account_title_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      account_titles: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_titles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_format_requests: {
        Row: {
          company_id: string
          created_at: string
          done_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          memo: string | null
          program: string
          requested_by_name: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          done_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          memo?: string | null
          program: string
          requested_by_name?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          done_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          memo?: string | null
          program?: string
          requested_by_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_format_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          company_id: string | null
          created_at: string
          created_by_member_id: string | null
          id: string
          pushed_count: number
          scope: Database["public"]["Enums"]["announcement_scope"]
          title: string
        }
        Insert: {
          body: string
          company_id?: string | null
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          pushed_count?: number
          scope: Database["public"]["Enums"]["announcement_scope"]
          title: string
        }
        Update: {
          body?: string
          company_id?: string | null
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          pushed_count?: number
          scope?: Database["public"]["Enums"]["announcement_scope"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_member_id_company_id_fkey"
            columns: ["created_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      app_admins: {
        Row: {
          auth_user_id: string
          created_at: string
          note: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          note?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          note?: string | null
        }
        Relationships: []
      }
      approval_line_steps: {
        Row: {
          approval_line_id: string
          approver_member_id: string
          company_id: string
          created_at: string
          id: string
          step_order: number
          updated_at: string
        }
        Insert: {
          approval_line_id: string
          approver_member_id: string
          company_id: string
          created_at?: string
          id?: string
          step_order: number
          updated_at?: string
        }
        Update: {
          approval_line_id?: string
          approver_member_id?: string
          company_id?: string
          created_at?: string
          id?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_line_steps_approval_line_id_company_id_fkey"
            columns: ["approval_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "approval_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "approval_line_steps_approver_member_id_company_id_fkey"
            columns: ["approver_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "approval_line_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_lines: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_lines_department_id_company_id_fkey"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      attendance_attempts: {
        Row: {
          at: string
          code: string
          company_id: string | null
          id: number
          ip: string | null
          member_id: string | null
          terminal_id: string | null
          user_agent: string | null
        }
        Insert: {
          at?: string
          code: string
          company_id?: string | null
          id?: never
          ip?: string | null
          member_id?: string | null
          terminal_id?: string | null
          user_agent?: string | null
        }
        Update: {
          at?: string
          code?: string
          company_id?: string | null
          id?: never
          ip?: string | null
          member_id?: string | null
          terminal_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      attendance_days: {
        Row: {
          alert_minutes: number
          alerted_at: string | null
          company_id: string
          created_at: string
          holiday: boolean
          holiday_approved_at: string | null
          in_at: string
          in_method: string
          in_terminal_id: string | null
          member_id: string
          out_at: string | null
          out_method: string | null
          out_terminal_id: string | null
          sched_end: string
          work_date: string
        }
        Insert: {
          alert_minutes: number
          alerted_at?: string | null
          company_id: string
          created_at?: string
          holiday?: boolean
          holiday_approved_at?: string | null
          in_at: string
          in_method?: string
          in_terminal_id?: string | null
          member_id: string
          out_at?: string | null
          out_method?: string | null
          out_terminal_id?: string | null
          sched_end: string
          work_date: string
        }
        Update: {
          alert_minutes?: number
          alerted_at?: string | null
          company_id?: string
          created_at?: string
          holiday?: boolean
          holiday_approved_at?: string | null
          in_at?: string
          in_method?: string
          in_terminal_id?: string | null
          member_id?: string
          out_at?: string | null
          out_method?: string | null
          out_terminal_id?: string | null
          sched_end?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_days_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          action: string
          at: string
          changes: Json
          company_id: string
          id: number
          member_id: string | null
          member_name: string | null
        }
        Insert: {
          action: string
          at?: string
          changes: Json
          company_id: string
          id?: never
          member_id?: string | null
          member_name?: string | null
        }
        Update: {
          action?: string
          at?: string
          changes?: Json
          company_id?: string
          id?: never
          member_id?: string | null
          member_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_leave_files: {
        Row: {
          company_id: string
          consented_at: string
          created_at: string
          delete_after: string
          id: string
          leave_id: string
          member_id: string
          mime: string
          name: string
          path: string
          purged_at: string | null
          size: number
        }
        Insert: {
          company_id: string
          consented_at: string
          created_at?: string
          delete_after: string
          id?: string
          leave_id: string
          member_id: string
          mime: string
          name: string
          path: string
          purged_at?: string | null
          size: number
        }
        Update: {
          company_id?: string
          consented_at?: string
          created_at?: string
          delete_after?: string
          id?: string
          leave_id?: string
          member_id?: string
          mime?: string
          name?: string
          path?: string
          purged_at?: string | null
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_leave_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_leave_files_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "attendance_leaves"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_leave_grants: {
        Row: {
          company_id: string
          confirmed_at: string
          confirmed_by: string | null
          confirmed_by_name: string | null
          granted_days: number
          member_id: string
          period_end: string
          period_start: string
          reason: string | null
          recommended_days: number | null
        }
        Insert: {
          company_id: string
          confirmed_at?: string
          confirmed_by?: string | null
          confirmed_by_name?: string | null
          granted_days: number
          member_id: string
          period_end: string
          period_start: string
          reason?: string | null
          recommended_days?: number | null
        }
        Update: {
          company_id?: string
          confirmed_at?: string
          confirmed_by?: string | null
          confirmed_by_name?: string | null
          granted_days?: number
          member_id?: string
          period_end?: string
          period_start?: string
          reason?: string | null
          recommended_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_leave_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_leave_grants_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      attendance_leave_types: {
        Row: {
          allow_hours: boolean
          builtin_key: string | null
          company_id: string
          created_at: string
          deducts: boolean
          enabled: boolean
          id: string
          law_ref: string | null
          name: string
          paid: string
          proof: string
          proof_locked: boolean
          sort: number
        }
        Insert: {
          allow_hours?: boolean
          builtin_key?: string | null
          company_id: string
          created_at?: string
          deducts?: boolean
          enabled?: boolean
          id?: string
          law_ref?: string | null
          name: string
          paid?: string
          proof?: string
          proof_locked?: boolean
          sort?: number
        }
        Update: {
          allow_hours?: boolean
          builtin_key?: string | null
          company_id?: string
          created_at?: string
          deducts?: boolean
          enabled?: boolean
          id?: string
          law_ref?: string | null
          name?: string
          paid?: string
          proof?: string
          proof_locked?: boolean
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_leave_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_leaves: {
        Row: {
          cancel_decided_at: string | null
          cancel_decided_by_name: string | null
          cancel_reason: string | null
          cancel_reject_reason: string | null
          cancel_requested_at: string | null
          cancel_status: string | null
          company_id: string
          created_at: string
          custom_payload: Json
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          deduct_days: number
          deducts: boolean
          end_date: string
          form_id: string | null
          hours: number | null
          id: string
          member_id: string
          member_name: string
          member_role: string
          period_start: string | null
          proof: string
          reason: string | null
          reject_reason: string | null
          remaining_days: number | null
          self_approved: boolean
          start_date: string
          start_time: string | null
          status: string
          type_id: string
          type_name: string
          unit: string
          workdays: number
        }
        Insert: {
          cancel_decided_at?: string | null
          cancel_decided_by_name?: string | null
          cancel_reason?: string | null
          cancel_reject_reason?: string | null
          cancel_requested_at?: string | null
          cancel_status?: string | null
          company_id: string
          created_at?: string
          custom_payload?: Json
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          deduct_days?: number
          deducts: boolean
          end_date: string
          form_id?: string | null
          hours?: number | null
          id?: string
          member_id: string
          member_name: string
          member_role: string
          period_start?: string | null
          proof: string
          reason?: string | null
          reject_reason?: string | null
          remaining_days?: number | null
          self_approved?: boolean
          start_date: string
          start_time?: string | null
          status?: string
          type_id: string
          type_name: string
          unit: string
          workdays: number
        }
        Update: {
          cancel_decided_at?: string | null
          cancel_decided_by_name?: string | null
          cancel_reason?: string | null
          cancel_reject_reason?: string | null
          cancel_requested_at?: string | null
          cancel_status?: string | null
          company_id?: string
          created_at?: string
          custom_payload?: Json
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          deduct_days?: number
          deducts?: boolean
          end_date?: string
          form_id?: string | null
          hours?: number | null
          id?: string
          member_id?: string
          member_name?: string
          member_role?: string
          period_start?: string | null
          proof?: string
          reason?: string | null
          reject_reason?: string | null
          remaining_days?: number | null
          self_approved?: boolean
          start_date?: string
          start_time?: string | null
          status?: string
          type_id?: string
          type_name?: string
          unit?: string
          workdays?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_leaves_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_leaves_form_fk"
            columns: ["form_id", "company_id"]
            isOneToOne: false
            referencedRelation: "company_forms"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "attendance_leaves_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "attendance_leaves_type_id_company_id_fkey"
            columns: ["type_id", "company_id"]
            isOneToOne: false
            referencedRelation: "attendance_leave_types"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      attendance_pair_codes: {
        Row: {
          code_hash: string
          company_id: string
          created_at: string
          created_by_member_id: string | null
          expires_at: string
          id: string
          name: string
          terminal_id: string | null
          used_at: string | null
        }
        Insert: {
          code_hash: string
          company_id: string
          created_at?: string
          created_by_member_id?: string | null
          expires_at: string
          id?: string
          name: string
          terminal_id?: string | null
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          company_id?: string
          created_at?: string
          created_by_member_id?: string | null
          expires_at?: string
          id?: string
          name?: string
          terminal_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_pair_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_requests: {
        Row: {
          before: Json
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          id: string
          kind: string
          member_id: string
          member_name: string
          member_role: string
          new_in: string
          new_out: string
          reason: string
          reject_reason: string | null
          self_approved: boolean
          status: string
          work_date: string
        }
        Insert: {
          before: Json
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          id?: string
          kind: string
          member_id: string
          member_name: string
          member_role: string
          new_in: string
          new_out: string
          reason: string
          reject_reason?: string | null
          self_approved?: boolean
          status?: string
          work_date: string
        }
        Update: {
          before?: Json
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          id?: string
          kind?: string
          member_id?: string
          member_name?: string
          member_role?: string
          new_in?: string
          new_out?: string
          reason?: string
          reject_reason?: string | null
          self_approved?: boolean
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          company_id: string
          daily_hours: number
          hourly_leave: boolean
          leave_rounding: string
          leave_shortage: string
          leave_year_basis: string
          missing_alert_minutes: number
          under_five: boolean
          updated_at: string
          updated_by_member_id: string | null
          work_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          company_id: string
          daily_hours?: number
          hourly_leave?: boolean
          leave_rounding?: string
          leave_shortage?: string
          leave_year_basis?: string
          missing_alert_minutes?: number
          under_five?: boolean
          updated_at?: string
          updated_by_member_id?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          company_id?: string
          daily_hours?: number
          hourly_leave?: boolean
          leave_rounding?: string
          leave_shortage?: string
          leave_year_basis?: string
          missing_alert_minutes?: number
          under_five?: boolean
          updated_at?: string
          updated_by_member_id?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_terminals: {
        Row: {
          company_id: string
          created_at: string
          created_by_member_id: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_terminals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_addons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_purchasable: boolean
          name: string
          price: number
          receipts: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_purchasable?: boolean
          name: string
          price: number
          receipts: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_purchasable?: boolean
          name?: string
          price?: number
          receipts?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          annual_price: number | null
          chat_storage_mb: number | null
          code: string
          created_at: string
          form_slots: number
          id: string
          is_featured: boolean
          is_purchasable: boolean
          is_unlimited: boolean
          max_members: number | null
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size: string | null
          sort_order: number
          updated_at: string
          vault_storage_mb: number | null
        }
        Insert: {
          annual_price?: number | null
          chat_storage_mb?: number | null
          code: string
          created_at?: string
          form_slots?: number
          id?: string
          is_featured?: boolean
          is_purchasable?: boolean
          is_unlimited?: boolean
          max_members?: number | null
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size?: string | null
          sort_order?: number
          updated_at?: string
          vault_storage_mb?: number | null
        }
        Update: {
          annual_price?: number | null
          chat_storage_mb?: number | null
          code?: string
          created_at?: string
          form_slots?: number
          id?: string
          is_featured?: boolean
          is_purchasable?: boolean
          is_unlimited?: boolean
          max_members?: number | null
          monthly_price?: number
          monthly_receipts?: number
          name?: string
          recommended_size?: string | null
          sort_order?: number
          updated_at?: string
          vault_storage_mb?: number | null
        }
        Relationships: []
      }
      bus_alerts: {
        Row: {
          ars_id: string
          company_id: string
          created_at: string
          expires_at: string
          last_veh: string | null
          member_id: string
          route_id: string
          route_no: string
          sent10: boolean
          sent5: boolean
          station_name: string
        }
        Insert: {
          ars_id: string
          company_id: string
          created_at?: string
          expires_at: string
          last_veh?: string | null
          member_id: string
          route_id: string
          route_no: string
          sent10?: boolean
          sent5?: boolean
          station_name: string
        }
        Update: {
          ars_id?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          last_veh?: string | null
          member_id?: string
          route_id?: string
          route_no?: string
          sent10?: boolean
          sent5?: boolean
          station_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_alerts_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      bus_api_calls: {
        Row: {
          count: number
          day: string
        }
        Insert: {
          count?: number
          day: string
        }
        Update: {
          count?: number
          day?: string
        }
        Relationships: []
      }
      bus_arrivals: {
        Row: {
          ars_id: string
          fetched_at: string
          routes: Json
          station_name: string | null
        }
        Insert: {
          ars_id: string
          fetched_at?: string
          routes: Json
          station_name?: string | null
        }
        Update: {
          ars_id?: string
          fetched_at?: string
          routes?: Json
          station_name?: string | null
        }
        Relationships: []
      }
      bus_stops: {
        Row: {
          ars_id: string
          lat: number
          lng: number
          name: string
          region: string
          st_id: string | null
          updated_at: string
        }
        Insert: {
          ars_id: string
          lat: number
          lng: number
          name: string
          region?: string
          st_id?: string | null
          updated_at?: string
        }
        Update: {
          ars_id?: string
          lat?: number
          lng?: number
          name?: string
          region?: string
          st_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_verifications: {
        Row: {
          auth_user_id: string
          b_no: string
          checked_at: string
          id: string
          raw: Json | null
          status: string
          status_label: string | null
        }
        Insert: {
          auth_user_id: string
          b_no: string
          checked_at?: string
          id?: string
          raw?: Json | null
          status: string
          status_label?: string | null
        }
        Update: {
          auth_user_id?: string
          b_no?: string
          checked_at?: string
          id?: string
          raw?: Json | null
          status?: string
          status_label?: string | null
        }
        Relationships: []
      }
      calendar_attendees: {
        Row: {
          company_id: string
          event_id: string
          member_id: string
          responded_at: string | null
          response: string
        }
        Insert: {
          company_id: string
          event_id: string
          member_id: string
          responded_at?: string | null
          response?: string
        }
        Update: {
          company_id?: string
          event_id?: string
          member_id?: string
          responded_at?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_attendees_event_id_company_id_fkey"
            columns: ["event_id", "company_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "calendar_attendees_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      calendar_event_files: {
        Row: {
          company_id: string
          created_at: string
          event_id: string
          id: string
          mime: string | null
          name: string
          path: string
          purged_at: string | null
          size: number
          uploaded_by_member_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_id: string
          id?: string
          mime?: string | null
          name: string
          path: string
          purged_at?: string | null
          size: number
          uploaded_by_member_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_id?: string
          id?: string
          mime?: string | null
          name?: string
          path?: string
          purged_at?: string | null
          size?: number
          uploaded_by_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_files_event_id_company_id_fkey"
            columns: ["event_id", "company_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "calendar_event_files_uploaded_by_member_id_company_id_fkey"
            columns: ["uploaded_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          agenda: string | null
          all_day: boolean
          company_id: string
          created_at: string
          created_by_member_id: string
          end_date: string | null
          ends_at: string | null
          id: string
          kind: string
          location: string | null
          memo: string | null
          reminded_at: string | null
          room_id: string | null
          start_date: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          all_day?: boolean
          company_id: string
          created_at?: string
          created_by_member_id: string
          end_date?: string | null
          ends_at?: string | null
          id?: string
          kind: string
          location?: string | null
          memo?: string | null
          reminded_at?: string | null
          room_id?: string | null
          start_date?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          all_day?: boolean
          company_id?: string
          created_at?: string
          created_by_member_id?: string
          end_date?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          memo?: string | null
          reminded_at?: string | null
          room_id?: string | null
          start_date?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_member_id_company_id_fkey"
            columns: ["created_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "calendar_events_room_fk"
            columns: ["room_id", "company_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      calendar_view_prefs: {
        Row: {
          company_id: string
          member_id: string
          member_ids: string[]
          show_deadlines: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          member_id: string
          member_ids?: string[]
          show_deadlines?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          member_id?: string
          member_ids?: string[]
          show_deadlines?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_view_prefs_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      card_reconcile_issues: {
        Row: {
          amount: number | null
          claim_title: string | null
          company_id: string
          expense_date: string | null
          fingerprint: string
          id: string
          item_id: string | null
          kind: string
          last4: string | null
          member_name: string | null
          memo: string | null
          merchant: string | null
          reconciliation_id: string
          resolved_at: string | null
          resolved_by_name: string | null
          status: string
        }
        Insert: {
          amount?: number | null
          claim_title?: string | null
          company_id: string
          expense_date?: string | null
          fingerprint: string
          id?: string
          item_id?: string | null
          kind: string
          last4?: string | null
          member_name?: string | null
          memo?: string | null
          merchant?: string | null
          reconciliation_id: string
          resolved_at?: string | null
          resolved_by_name?: string | null
          status?: string
        }
        Update: {
          amount?: number | null
          claim_title?: string | null
          company_id?: string
          expense_date?: string | null
          fingerprint?: string
          id?: string
          item_id?: string | null
          kind?: string
          last4?: string | null
          member_name?: string | null
          memo?: string | null
          merchant?: string | null
          reconciliation_id?: string
          resolved_at?: string | null
          resolved_by_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_reconcile_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_reconcile_issues_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_reconcile_issues_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "card_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      card_reconciliations: {
        Row: {
          cancelled: number
          company_id: string
          created_at: string
          created_by_name: string | null
          extra: number
          file_name: string | null
          id: string
          matched: number
          missing: number
          month: string
          period_from: string | null
          period_to: string | null
          personal: number
          updated_at: string
        }
        Insert: {
          cancelled?: number
          company_id: string
          created_at?: string
          created_by_name?: string | null
          extra?: number
          file_name?: string | null
          id?: string
          matched?: number
          missing?: number
          month: string
          period_from?: string | null
          period_to?: string | null
          personal?: number
          updated_at?: string
        }
        Update: {
          cancelled?: number
          company_id?: string
          created_at?: string
          created_by_name?: string | null
          extra?: number
          file_name?: string | null
          id?: string
          matched?: number
          missing?: number
          month?: string
          period_from?: string | null
          period_to?: string | null
          personal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          company_id: string
          joined_at: string
          last_read_at: string
          left_at: string | null
          member_id: string
          room_id: string
        }
        Insert: {
          company_id: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          member_id: string
          room_id: string
        }
        Update: {
          company_id?: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          member_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_members_room_id_company_id_fkey"
            columns: ["room_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_purged_at: string | null
          attachment_size: number | null
          attachment_thumb_path: string | null
          attachment_thumb_size: number | null
          body: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          kind: string
          link: string | null
          pushed_at: string | null
          room_id: string
          sender_member_id: string | null
          thread_id: string | null
          width: number | null
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_purged_at?: string | null
          attachment_size?: number | null
          attachment_thumb_path?: string | null
          attachment_thumb_size?: number | null
          body?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind: string
          link?: string | null
          pushed_at?: string | null
          room_id: string
          sender_member_id?: string | null
          thread_id?: string | null
          width?: number | null
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_purged_at?: string | null
          attachment_size?: number | null
          attachment_thumb_path?: string | null
          attachment_thumb_size?: number | null
          body?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: string
          link?: string | null
          pushed_at?: string | null
          room_id?: string
          sender_member_id?: string | null
          thread_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_company_id_fkey"
            columns: ["room_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_messages_sender_member_id_company_id_fkey"
            columns: ["sender_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_messages_thread_fk"
            columns: ["thread_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          assistant_member_id: string | null
          claim_id: string | null
          company_id: string
          created_at: string
          created_by_member_id: string | null
          direct_key: string | null
          id: string
          kind: string
          last_message_at: string | null
          notice_member_id: string | null
          title: string | null
        }
        Insert: {
          assistant_member_id?: string | null
          claim_id?: string | null
          company_id: string
          created_at?: string
          created_by_member_id?: string | null
          direct_key?: string | null
          id?: string
          kind: string
          last_message_at?: string | null
          notice_member_id?: string | null
          title?: string | null
        }
        Update: {
          assistant_member_id?: string | null
          claim_id?: string | null
          company_id?: string
          created_at?: string
          created_by_member_id?: string | null
          direct_key?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          notice_member_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_assistant_member_fk"
            columns: ["assistant_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_rooms_claim_id_company_id_fkey"
            columns: ["claim_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_created_by_member_id_company_id_fkey"
            columns: ["created_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_rooms_notice_member_fk"
            columns: ["notice_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      chat_thread_reads: {
        Row: {
          company_id: string
          last_read_at: string
          member_id: string
          participant: boolean
          thread_id: string
        }
        Insert: {
          company_id: string
          last_read_at?: string
          member_id: string
          participant?: boolean
          thread_id: string
        }
        Update: {
          company_id?: string
          last_read_at?: string
          member_id?: string
          participant?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_reads_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_thread_reads_thread_id_company_id_fkey"
            columns: ["thread_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          message_count: number
          room_id: string
          root_message_id: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number
          room_id: string
          root_message_id: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number
          room_id?: string
          root_message_id?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_closed_by_company_id_fkey"
            columns: ["closed_by", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_threads_created_by_company_id_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_threads_room_id_company_id_fkey"
            columns: ["room_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_threads_root_message_id_fkey"
            columns: ["root_message_id"]
            isOneToOne: true
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_approvals: {
        Row: {
          acted_at: string | null
          acted_by_member_id: string | null
          approver_member_id: string | null
          claim_id: string
          comment: string | null
          company_id: string
          created_at: string
          flagged_item_ids: string[]
          id: string
          round: number
          status: Database["public"]["Enums"]["approval_step_status"]
          step_kind: Database["public"]["Enums"]["approval_step_kind"]
          step_order: number
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          acted_by_member_id?: string | null
          approver_member_id?: string | null
          claim_id: string
          comment?: string | null
          company_id: string
          created_at?: string
          flagged_item_ids?: string[]
          id?: string
          round: number
          status: Database["public"]["Enums"]["approval_step_status"]
          step_kind: Database["public"]["Enums"]["approval_step_kind"]
          step_order: number
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          acted_by_member_id?: string | null
          approver_member_id?: string | null
          claim_id?: string
          comment?: string | null
          company_id?: string
          created_at?: string
          flagged_item_ids?: string[]
          id?: string
          round?: number
          status?: Database["public"]["Enums"]["approval_step_status"]
          step_kind?: Database["public"]["Enums"]["approval_step_kind"]
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_approvals_acted_by_member_id_company_id_fkey"
            columns: ["acted_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "claim_approvals_approver_member_id_company_id_fkey"
            columns: ["approver_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "claim_approvals_claim_id_company_id_fkey"
            columns: ["claim_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "claim_approvals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_status: Database["public"]["Enums"]["billing_status"]
          business_number: string
          business_status: string
          business_verified_at: string | null
          claim_deadline_days: number | null
          claim_deadline_type: Database["public"]["Enums"]["claim_deadline_type"]
          created_at: string
          event_bonus_acknowledged_at: string | null
          extra_form_slots: number
          first_purchase_at: string | null
          fuel_enabled: boolean
          fuel_rate_mode: string
          fuel_rate_per_km: number
          id: string
          invite_code: string
          last_event_bonus_at: string | null
          meal_limit_enabled: boolean
          meal_limit_mode: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person: number
          name: string
          odometer_photo_required: boolean
          per_diem_amount: number
          per_diem_enabled: boolean
          policy_confirmed_at: string | null
          receipt_credits_granted: number
          receipt_credits_used: number
          review_coupon_at: string | null
          trial_ends_on: string | null
          updated_at: string
        }
        Insert: {
          billing_status?: Database["public"]["Enums"]["billing_status"]
          business_number: string
          business_status?: string
          business_verified_at?: string | null
          claim_deadline_days?: number | null
          claim_deadline_type?: Database["public"]["Enums"]["claim_deadline_type"]
          created_at?: string
          event_bonus_acknowledged_at?: string | null
          extra_form_slots?: number
          first_purchase_at?: string | null
          fuel_enabled?: boolean
          fuel_rate_mode?: string
          fuel_rate_per_km?: number
          id?: string
          invite_code: string
          last_event_bonus_at?: string | null
          meal_limit_enabled?: boolean
          meal_limit_mode?: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person?: number
          name: string
          odometer_photo_required?: boolean
          per_diem_amount?: number
          per_diem_enabled?: boolean
          policy_confirmed_at?: string | null
          receipt_credits_granted?: number
          receipt_credits_used?: number
          review_coupon_at?: string | null
          trial_ends_on?: string | null
          updated_at?: string
        }
        Update: {
          billing_status?: Database["public"]["Enums"]["billing_status"]
          business_number?: string
          business_status?: string
          business_verified_at?: string | null
          claim_deadline_days?: number | null
          claim_deadline_type?: Database["public"]["Enums"]["claim_deadline_type"]
          created_at?: string
          event_bonus_acknowledged_at?: string | null
          extra_form_slots?: number
          first_purchase_at?: string | null
          fuel_enabled?: boolean
          fuel_rate_mode?: string
          fuel_rate_per_km?: number
          id?: string
          invite_code?: string
          last_event_bonus_at?: string | null
          meal_limit_enabled?: boolean
          meal_limit_mode?: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person?: number
          name?: string
          odometer_photo_required?: boolean
          per_diem_amount?: number
          per_diem_enabled?: boolean
          policy_confirmed_at?: string | null
          receipt_credits_granted?: number
          receipt_credits_used?: number
          review_coupon_at?: string | null
          trial_ends_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_chat_settings: {
        Row: {
          attachment_days: number
          company_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachment_days: number
          company_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachment_days?: number
          company_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_chat_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_chat_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      company_features: {
        Row: {
          company_id: string
          enabled: boolean
          feature: string
          updated_at: string
        }
        Insert: {
          company_id: string
          enabled?: boolean
          feature: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          enabled?: boolean
          feature?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_forms: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          fields: Json
          group_id: string
          id: string
          kind: string | null
          mime: string
          name: string
          published_at: string | null
          reads: number
          sheets: Json | null
          source_name: string | null
          source_path: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          fields?: Json
          group_id: string
          id: string
          kind?: string | null
          mime: string
          name: string
          published_at?: string | null
          reads?: number
          sheets?: Json | null
          source_name?: string | null
          source_path: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          fields?: Json
          group_id?: string
          id?: string
          kind?: string | null
          mime?: string
          name?: string
          published_at?: string | null
          reads?: number
          sheets?: Json | null
          source_name?: string | null
          source_path?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_forms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_forms_created_by_company_id_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      company_location_history: {
        Row: {
          at: string
          company_id: string
          from_address: string | null
          id: number
          member_name: string | null
          to_address: string
        }
        Insert: {
          at?: string
          company_id: string
          from_address?: string | null
          id?: never
          member_name?: string | null
          to_address: string
        }
        Update: {
          at?: string
          company_id?: string
          from_address?: string | null
          id?: never
          member_name?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_location_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_locations: {
        Row: {
          address: string
          company_id: string
          found_address: string | null
          jibun_address: string | null
          lat: number
          lng: number
          region: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
          zonecode: string | null
        }
        Insert: {
          address: string
          company_id: string
          found_address?: string | null
          jibun_address?: string | null
          lat: number
          lng: number
          region: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          zonecode?: string | null
        }
        Update: {
          address?: string
          company_id?: string
          found_address?: string | null
          jibun_address?: string | null
          lat?: number
          lng?: number
          region?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          zonecode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_referrals: {
        Row: {
          company_id: string
          created_at: string
          kind: string
          member_id: string | null
          referrer_company_id: string | null
          referrer_company_name: string | null
          referrer_name: string | null
          referrer_phone: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          kind: string
          member_id?: string | null
          referrer_company_id?: string | null
          referrer_company_name?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          kind?: string
          member_id?: string | null
          referrer_company_id?: string | null
          referrer_company_name?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_referrals_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "company_referrals_referrer_company_id_fkey"
            columns: ["referrer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tax_offices: {
        Row: {
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          assigned_member_id: string | null
          card_via_hometax: boolean
          company_id: string
          connect_code: string | null
          created_at: string
          custom_titles: boolean
          office_email: string
          office_id: string | null
          office_name: string
          released_at: string | null
          released_office_name: string | null
          updated_at: string
          updated_by_member_id: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          assigned_member_id?: string | null
          card_via_hometax?: boolean
          company_id: string
          connect_code?: string | null
          created_at?: string
          custom_titles?: boolean
          office_email: string
          office_id?: string | null
          office_name: string
          released_at?: string | null
          released_office_name?: string | null
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          assigned_member_id?: string | null
          card_via_hometax?: boolean
          company_id?: string
          connect_code?: string | null
          created_at?: string
          custom_titles?: boolean
          office_email?: string
          office_id?: string | null
          office_name?: string
          released_at?: string | null
          released_office_name?: string | null
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_tax_offices_assigned_member_id_office_id_fkey"
            columns: ["assigned_member_id", "office_id"]
            isOneToOne: false
            referencedRelation: "tax_office_members"
            referencedColumns: ["id", "office_id"]
          },
          {
            foreignKeyName: "company_tax_offices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tax_offices_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "tax_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tax_offices_updated_by_member_id_company_id_fkey"
            columns: ["updated_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      company_vehicles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          nickname: string
          plate_number: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          nickname: string
          plate_number: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          nickname?: string
          plate_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_cards: {
        Row: {
          bin6: string | null
          company_id: string
          created_at: string
          holder_member_id: string | null
          id: string
          is_active: boolean
          last4: string
          nickname: string
          updated_at: string
        }
        Insert: {
          bin6?: string | null
          company_id: string
          created_at?: string
          holder_member_id?: string | null
          id?: string
          is_active?: boolean
          last4: string
          nickname: string
          updated_at?: string
        }
        Update: {
          bin6?: string | null
          company_id?: string
          created_at?: string
          holder_member_id?: string | null
          id?: string
          is_active?: boolean
          last4?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_cards_holder_member_id_company_id_fkey"
            columns: ["holder_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          company_id: string
          created_at: string
          delta: number
          id: string
          item_id: string | null
          member_id: string | null
          note: string | null
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delta: number
          id?: string
          item_id?: string | null
          member_id?: string | null
          note?: string | null
          reason: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delta?: number
          id?: string
          item_id?: string | null
          member_id?: string | null
          note?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_item_id_company_id_fkey"
            columns: ["item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "credit_ledger_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_conversions: {
        Row: {
          company_id: string
          confirmed_at: string | null
          created_at: string
          credits: number
          id: string
          member_id: string
          mime: string
          name: string
          pages: number
          scope: string
          sheets: Json | null
          source_message_id: string | null
          source_path: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          credits?: number
          id: string
          member_id: string
          mime: string
          name: string
          pages: number
          scope?: string
          sheets?: Json | null
          source_message_id?: string | null
          source_path: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          credits?: number
          id?: string
          member_id?: string
          mime?: string
          name?: string
          pages?: number
          scope?: string
          sheets?: Json | null
          source_message_id?: string | null
          source_path?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_conversions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_conversions_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      expense_claims: {
        Row: {
          approved_at: string | null
          attendees: string | null
          calendar_event_id: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          client_name: string | null
          company_id: string
          condolence_target: string | null
          created_at: string
          current_round: number
          default_payment_method: Database["public"]["Enums"]["payment_method"]
          description: string | null
          exception_memo: string | null
          form_template_id: string | null
          headcount: number | null
          header_custom_payload: Json
          id: string
          is_business_trip: boolean
          item_count: number
          meeting_purpose: string | null
          member_id: string
          paid_at: string | null
          paid_by_member_id: string | null
          payout_proof_name: string | null
          payout_proof_path: string | null
          purchase_items: string | null
          purchase_purpose: string | null
          purchase_type: Database["public"]["Enums"]["purchase_type"] | null
          recurring_payment_id: string | null
          recurring_period: string | null
          rejected_at: string | null
          rejection_reason: string | null
          self_approved: boolean
          settlement_required: boolean | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          title: string
          total_amount: number
          total_company_supported: number
          total_personal_burden: number
          trip_destination: string | null
          trip_end_date: string | null
          trip_purpose: string | null
          trip_start_date: string | null
          trip_transport: Database["public"]["Enums"]["trip_transport"] | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          approved_at?: string | null
          attendees?: string | null
          calendar_event_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          client_name?: string | null
          company_id: string
          condolence_target?: string | null
          created_at?: string
          current_round?: number
          default_payment_method?: Database["public"]["Enums"]["payment_method"]
          description?: string | null
          exception_memo?: string | null
          form_template_id?: string | null
          headcount?: number | null
          header_custom_payload?: Json
          id?: string
          is_business_trip?: boolean
          item_count?: number
          meeting_purpose?: string | null
          member_id: string
          paid_at?: string | null
          paid_by_member_id?: string | null
          payout_proof_name?: string | null
          payout_proof_path?: string | null
          purchase_items?: string | null
          purchase_purpose?: string | null
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          recurring_payment_id?: string | null
          recurring_period?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          self_approved?: boolean
          settlement_required?: boolean | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          title?: string
          total_amount?: number
          total_company_supported?: number
          total_personal_burden?: number
          trip_destination?: string | null
          trip_end_date?: string | null
          trip_purpose?: string | null
          trip_start_date?: string | null
          trip_transport?: Database["public"]["Enums"]["trip_transport"] | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          approved_at?: string | null
          attendees?: string | null
          calendar_event_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          client_name?: string | null
          company_id?: string
          condolence_target?: string | null
          created_at?: string
          current_round?: number
          default_payment_method?: Database["public"]["Enums"]["payment_method"]
          description?: string | null
          exception_memo?: string | null
          form_template_id?: string | null
          headcount?: number | null
          header_custom_payload?: Json
          id?: string
          is_business_trip?: boolean
          item_count?: number
          meeting_purpose?: string | null
          member_id?: string
          paid_at?: string | null
          paid_by_member_id?: string | null
          payout_proof_name?: string | null
          payout_proof_path?: string | null
          purchase_items?: string | null
          purchase_purpose?: string | null
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          recurring_payment_id?: string | null
          recurring_period?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          self_approved?: boolean
          settlement_required?: boolean | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          title?: string
          total_amount?: number
          total_company_supported?: number
          total_personal_burden?: number
          trip_destination?: string | null
          trip_end_date?: string | null
          trip_purpose?: string | null
          trip_start_date?: string | null
          trip_transport?: Database["public"]["Enums"]["trip_transport"] | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_claims_calendar_event_fk"
            columns: ["calendar_event_id", "company_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_form_template_id_company_id_fkey"
            columns: ["form_template_id", "company_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_claims_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_claims_paid_by_member_id_company_id_fkey"
            columns: ["paid_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_claims_recurring_fk"
            columns: ["recurring_payment_id", "company_id"]
            isOneToOne: false
            referencedRelation: "recurring_payments"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_claims_vehicle_fk"
            columns: ["vehicle_id", "company_id"]
            isOneToOne: false
            referencedRelation: "company_vehicles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      expense_items: {
        Row: {
          account_title_code: string | null
          account_title_id: string | null
          account_title_name: string | null
          account_title_overridden: boolean
          ai_parsed_payload: Json | null
          amount: number | null
          applied_fuel_mode: string | null
          applied_fuel_price: number | null
          applied_fuel_rate_per_km: number | null
          applied_fuel_type: string | null
          applied_meal_limit_mode:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person: number | null
          approval_number: string | null
          attendees: string | null
          card_last4: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          category_mismatch_ack: boolean
          claim_id: string
          client_name: string | null
          closed_month: string | null
          closing_kind: string | null
          closing_seq: number | null
          company_id: string
          company_supported_amount: number | null
          condolence_target: string | null
          corporate_card_id: string | null
          created_at: string
          credit_charged: boolean
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"] | null
          end_lat: number | null
          end_lng: number | null
          end_location: string | null
          evidence_kind: Database["public"]["Enums"]["evidence_kind"] | null
          evidence_substitute: Json | null
          evidence_type: Database["public"]["Enums"]["evidence_type"] | null
          expense_date: string | null
          headcount: number | null
          id: string
          is_round_trip: boolean | null
          item_custom_payload: Json
          line_items: Json
          merchant_address: string | null
          merchant_business_number: string | null
          merchant_name: string | null
          no_evidence_reason: string | null
          odometer_end_path: string | null
          odometer_start_path: string | null
          paid_time: string | null
          parse_status: Database["public"]["Enums"]["parse_status"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount: number
          purchase_type: Database["public"]["Enums"]["purchase_type"] | null
          purpose: string | null
          receipt_path: string | null
          receipt_thumb_path: string | null
          route_card_path: string | null
          route_evidence: Json | null
          route_one_way_km: number | null
          sort_order: number
          start_lat: number | null
          start_lng: number | null
          start_location: string | null
          supply_amount: number | null
          tax_review_request: string | null
          tax_review_requested_at: string | null
          tax_review_requested_by: string | null
          tax_review_resolved_at: string | null
          trip_end_date: string | null
          trip_start_date: string | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          account_title_code?: string | null
          account_title_id?: string | null
          account_title_name?: string | null
          account_title_overridden?: boolean
          ai_parsed_payload?: Json | null
          amount?: number | null
          applied_fuel_mode?: string | null
          applied_fuel_price?: number | null
          applied_fuel_rate_per_km?: number | null
          applied_fuel_type?: string | null
          applied_meal_limit_mode?:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person?: number | null
          approval_number?: string | null
          attendees?: string | null
          card_last4?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          category_mismatch_ack?: boolean
          claim_id: string
          client_name?: string | null
          closed_month?: string | null
          closing_kind?: string | null
          closing_seq?: number | null
          company_id: string
          company_supported_amount?: number | null
          condolence_target?: string | null
          corporate_card_id?: string | null
          created_at?: string
          credit_charged?: boolean
          distance_km?: number | null
          distance_source?:
            | Database["public"]["Enums"]["distance_source"]
            | null
          end_lat?: number | null
          end_lng?: number | null
          end_location?: string | null
          evidence_kind?: Database["public"]["Enums"]["evidence_kind"] | null
          evidence_substitute?: Json | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"] | null
          expense_date?: string | null
          headcount?: number | null
          id?: string
          is_round_trip?: boolean | null
          item_custom_payload?: Json
          line_items?: Json
          merchant_address?: string | null
          merchant_business_number?: string | null
          merchant_name?: string | null
          no_evidence_reason?: string | null
          odometer_end_path?: string | null
          odometer_start_path?: string | null
          paid_time?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount?: number
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          purpose?: string | null
          receipt_path?: string | null
          receipt_thumb_path?: string | null
          route_card_path?: string | null
          route_evidence?: Json | null
          route_one_way_km?: number | null
          sort_order?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          supply_amount?: number | null
          tax_review_request?: string | null
          tax_review_requested_at?: string | null
          tax_review_requested_by?: string | null
          tax_review_resolved_at?: string | null
          trip_end_date?: string | null
          trip_start_date?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          account_title_code?: string | null
          account_title_id?: string | null
          account_title_name?: string | null
          account_title_overridden?: boolean
          ai_parsed_payload?: Json | null
          amount?: number | null
          applied_fuel_mode?: string | null
          applied_fuel_price?: number | null
          applied_fuel_rate_per_km?: number | null
          applied_fuel_type?: string | null
          applied_meal_limit_mode?:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person?: number | null
          approval_number?: string | null
          attendees?: string | null
          card_last4?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          category_mismatch_ack?: boolean
          claim_id?: string
          client_name?: string | null
          closed_month?: string | null
          closing_kind?: string | null
          closing_seq?: number | null
          company_id?: string
          company_supported_amount?: number | null
          condolence_target?: string | null
          corporate_card_id?: string | null
          created_at?: string
          credit_charged?: boolean
          distance_km?: number | null
          distance_source?:
            | Database["public"]["Enums"]["distance_source"]
            | null
          end_lat?: number | null
          end_lng?: number | null
          end_location?: string | null
          evidence_kind?: Database["public"]["Enums"]["evidence_kind"] | null
          evidence_substitute?: Json | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"] | null
          expense_date?: string | null
          headcount?: number | null
          id?: string
          is_round_trip?: boolean | null
          item_custom_payload?: Json
          line_items?: Json
          merchant_address?: string | null
          merchant_business_number?: string | null
          merchant_name?: string | null
          no_evidence_reason?: string | null
          odometer_end_path?: string | null
          odometer_start_path?: string | null
          paid_time?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount?: number
          purchase_type?: Database["public"]["Enums"]["purchase_type"] | null
          purpose?: string | null
          receipt_path?: string | null
          receipt_thumb_path?: string | null
          route_card_path?: string | null
          route_evidence?: Json | null
          route_one_way_km?: number | null
          sort_order?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          supply_amount?: number | null
          tax_review_request?: string | null
          tax_review_requested_at?: string | null
          tax_review_requested_by?: string | null
          tax_review_resolved_at?: string | null
          trip_end_date?: string | null
          trip_start_date?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_account_title_id_company_id_fkey"
            columns: ["account_title_id", "company_id"]
            isOneToOne: false
            referencedRelation: "account_titles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_items_claim_id_company_id_fkey"
            columns: ["claim_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "expense_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_corporate_card_id_company_id_fkey"
            columns: ["corporate_card_id", "company_id"]
            isOneToOne: false
            referencedRelation: "corporate_cards"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      feedback_logs: {
        Row: {
          app_version: string | null
          category: string
          company_id: string
          content: string
          created_at: string
          id: string
          member_id: string
          operator_note: string | null
          page_url: string | null
          reporter_name: string | null
          resolved_at: string | null
          shot_path: string | null
          status: string
          updated_at: string
          user_agent: string | null
          viewport: string | null
        }
        Insert: {
          app_version?: string | null
          category: string
          company_id: string
          content: string
          created_at?: string
          id?: string
          member_id: string
          operator_note?: string | null
          page_url?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          shot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewport?: string | null
        }
        Update: {
          app_version?: string | null
          category?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          member_id?: string
          operator_note?: string | null
          page_url?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          shot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_logs_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      feedback_surveys: {
        Row: {
          company_id: string
          company_size: string
          created_at: string
          credits_granted: number
          display_consent: boolean
          id: string
          industry: string
          is_displayed: boolean
          is_featured: boolean
          job_role: string
          member_id: string | null
          rating: number
          review: string | null
          useful_feature: string
        }
        Insert: {
          company_id: string
          company_size: string
          created_at?: string
          credits_granted?: number
          display_consent?: boolean
          id?: string
          industry: string
          is_displayed?: boolean
          is_featured?: boolean
          job_role: string
          member_id?: string | null
          rating: number
          review?: string | null
          useful_feature: string
        }
        Update: {
          company_id?: string
          company_size?: string
          created_at?: string
          credits_granted?: number
          display_consent?: boolean
          id?: string
          industry?: string
          is_displayed?: boolean
          is_featured?: boolean
          job_role?: string
          member_id?: string | null
          rating?: number
          review?: string | null
          useful_feature?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_surveys_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      form_slot_requests: {
        Row: {
          company_id: string
          created_at: string
          done_at: string | null
          id: string
          member_id: string | null
          requested_by_name: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          done_at?: string | null
          id?: string
          member_id?: string | null
          requested_by_name?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          done_at?: string | null
          id?: string
          member_id?: string | null
          requested_by_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_slot_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_slot_requests_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      form_templates: {
        Row: {
          ai_extracted_schema: Json | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          schema: Json
          source_file_path: string | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_extracted_schema?: Json | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          schema: Json
          source_file_path?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          ai_extracted_schema?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          schema?: Json
          source_file_path?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      help_questions: {
        Row: {
          company_id: string
          count: number
          day: string
          member_id: string
        }
        Insert: {
          company_id: string
          count?: number
          day: string
          member_id: string
        }
        Update: {
          company_id?: string
          count?: number
          day?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_questions_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      hometax_uploads: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          header: Json
          id: string
          kind: string
          memo: string | null
          month: string
          preview: Json
          row_count: number
          uploaded_by_kind: string
          uploaded_by_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          header?: Json
          id?: string
          kind: string
          memo?: string | null
          month: string
          preview?: Json
          row_count?: number
          uploaded_by_kind?: string
          uploaded_by_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          header?: Json
          id?: string
          kind?: string
          memo?: string | null
          month?: string
          preview?: Json
          row_count?: number
          uploaded_by_kind?: string
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hometax_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kr_holidays: {
        Row: {
          created_at: string
          day: string
          name: string
        }
        Insert: {
          created_at?: string
          day: string
          name: string
        }
        Update: {
          created_at?: string
          day?: string
          name?: string
        }
        Relationships: []
      }
      meeting_rooms: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      member_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          company_id: string
          created_at: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          company_id: string
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          company_id?: string
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_bank_accounts_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      member_invitations: {
        Row: {
          accepted_member_id: string | null
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          invited_by_member_id: string
          last_sent_at: string | null
          name: string
          phone: string | null
          position: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_member_id?: string | null
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          invited_by_member_id: string
          last_sent_at?: string | null
          name: string
          phone?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_member_id?: string | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          invited_by_member_id?: string
          last_sent_at?: string | null
          name?: string
          phone?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_accepted_member_id_company_id_fkey"
            columns: ["accepted_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "member_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_invitations_department_id_company_id_fkey"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "member_invitations_invited_by_member_id_company_id_fkey"
            columns: ["invited_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      members: {
        Row: {
          approved_at: string | null
          auth_user_id: string
          chat_theme: string | null
          chat_visual_alert: boolean
          company_id: string
          created_at: string
          department_id: string | null
          email: string | null
          employee_number: string | null
          fuel_type: string | null
          hire_date: string | null
          id: string
          joined_via: string
          last_reminded_at: string | null
          meal_limit_override: number | null
          name: string
          optional_consent_at: string | null
          phone: string
          position: string | null
          privacy_agreed_at: string
          privacy_version: string | null
          receives_car_allowance: boolean
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          terms_agreed_at: string | null
          terms_version: string | null
          ui_theme: string | null
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          approved_at?: string | null
          auth_user_id: string
          chat_theme?: string | null
          chat_visual_alert?: boolean
          company_id: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_number?: string | null
          fuel_type?: string | null
          hire_date?: string | null
          id?: string
          joined_via?: string
          last_reminded_at?: string | null
          meal_limit_override?: number | null
          name: string
          optional_consent_at?: string | null
          phone: string
          position?: string | null
          privacy_agreed_at: string
          privacy_version?: string | null
          receives_car_allowance?: boolean
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          terms_agreed_at?: string | null
          terms_version?: string | null
          ui_theme?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          approved_at?: string | null
          auth_user_id?: string
          chat_theme?: string | null
          chat_visual_alert?: boolean
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_number?: string | null
          fuel_type?: string | null
          hire_date?: string | null
          id?: string
          joined_via?: string
          last_reminded_at?: string | null
          meal_limit_override?: number | null
          name?: string
          optional_consent_at?: string | null
          phone?: string
          position?: string | null
          privacy_agreed_at?: string
          privacy_version?: string | null
          receives_car_allowance?: boolean
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          terms_agreed_at?: string | null
          terms_version?: string | null
          ui_theme?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_department_id_company_id_fkey"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          closed_at: string | null
          closed_by_member_id: string | null
          company_id: string
          created_at: string
          id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by_member_id: string | null
          status: string
          updated_at: string
          year_month: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_member_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_member_id?: string | null
          status: string
          updated_at?: string
          year_month: string
        }
        Update: {
          closed_at?: string | null
          closed_by_member_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by_member_id?: string | null
          status?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_closed_by_member_id_company_id_fkey"
            columns: ["closed_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "monthly_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closings_reopened_by_member_id_company_id_fkey"
            columns: ["reopened_by_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          claim_id: string | null
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          invitation_id: string | null
          payload: Json
          provider: string
          provider_message_id: string | null
          recipient_member_id: string | null
          recipient_phone: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_code: string
          updated_at: string
        }
        Insert: {
          claim_id?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          payload?: Json
          provider: string
          provider_message_id?: string | null
          recipient_member_id?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_code: string
          updated_at?: string
        }
        Update: {
          claim_id?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          recipient_member_id?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_claim_id_company_id_fkey"
            columns: ["claim_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "notification_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_recipient_member_id_company_id_fkey"
            columns: ["recipient_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      oil_price_fetch_logs: {
        Row: {
          id: string
          log_date: string | null
          message: string | null
          ok: boolean
          ran_at: string
        }
        Insert: {
          id?: string
          log_date?: string | null
          message?: string | null
          ok: boolean
          ran_at?: string
        }
        Update: {
          id?: string
          log_date?: string | null
          message?: string | null
          ok?: boolean
          ran_at?: string
        }
        Relationships: []
      }
      oil_price_history: {
        Row: {
          diesel: number | null
          fetched_at: string
          gasoline: number | null
          log_date: string
          lpg: number | null
          source: string
        }
        Insert: {
          diesel?: number | null
          fetched_at?: string
          gasoline?: number | null
          log_date: string
          lpg?: number | null
          source?: string
        }
        Update: {
          diesel?: number | null
          fetched_at?: string
          gasoline?: number | null
          log_date?: string
          lpg?: number | null
          source?: string
        }
        Relationships: []
      }
      perf_events: {
        Row: {
          action: string | null
          build: string | null
          company_id: string | null
          conn: string | null
          created_at: string
          created_by: string
          device: string
          id: number
          metric: string
          nav_type: string | null
          route: string
          value: number
        }
        Insert: {
          action?: string | null
          build?: string | null
          company_id?: string | null
          conn?: string | null
          created_at?: string
          created_by: string
          device: string
          id?: never
          metric: string
          nav_type?: string | null
          route: string
          value: number
        }
        Update: {
          action?: string | null
          build?: string | null
          company_id?: string | null
          conn?: string | null
          created_at?: string
          created_by?: string
          device?: string
          id?: never
          metric?: string
          nav_type?: string | null
          route?: string
          value?: number
        }
        Relationships: []
      }
      push_app_tokens: {
        Row: {
          app_version: string | null
          company_id: string
          created_at: string
          id: string
          last_sent_at: string | null
          member_id: string
          platform: string
          token: string
        }
        Insert: {
          app_version?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          member_id: string
          platform?: string
          token: string
        }
        Update: {
          app_version?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          member_id?: string
          platform?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_app_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_app_tokens_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      push_logs: {
        Row: {
          company_id: string | null
          created_at: string
          devices: number
          id: string
          kind: string
          member_id: string | null
          ref: string
          sent_on: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          devices?: number
          id?: string
          kind: string
          member_id?: string | null
          ref?: string
          sent_on?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          devices?: number
          id?: string
          kind?: string
          member_id?: string | null
          ref?: string
          sent_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          company_id: string
          created_at: string
          endpoint: string
          id: string
          last_sent_at: string | null
          member_id: string
          p256dh: string
          user_agent: string | null
          vibrate: boolean
        }
        Insert: {
          auth: string
          company_id: string
          created_at?: string
          endpoint: string
          id?: string
          last_sent_at?: string | null
          member_id: string
          p256dh: string
          user_agent?: string | null
          vibrate?: boolean
        }
        Update: {
          auth?: string
          company_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_sent_at?: string | null
          member_id?: string
          p256dh?: string
          user_agent?: string | null
          vibrate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_member_id_company_id_fkey"
            columns: ["member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      receipt_usage_records: {
        Row: {
          ai_parsed_payload: Json | null
          archived_receipt_path: string | null
          archived_thumb_path: string | null
          claim_id: string
          claim_status: string | null
          claim_title: string | null
          company_id: string
          created_at: string
          credited_at: string
          id: string
          item_deleted_at: string | null
          item_id: string
          item_snapshot: Json | null
          ledger_id: string | null
          member_id: string | null
          member_name: string | null
          parse_status: string | null
          parsed_at: string | null
          photo_purge_after: string | null
          photo_purged_at: string | null
          receipt_path: string | null
          thumb_path: string | null
        }
        Insert: {
          ai_parsed_payload?: Json | null
          archived_receipt_path?: string | null
          archived_thumb_path?: string | null
          claim_id: string
          claim_status?: string | null
          claim_title?: string | null
          company_id: string
          created_at?: string
          credited_at: string
          id?: string
          item_deleted_at?: string | null
          item_id: string
          item_snapshot?: Json | null
          ledger_id?: string | null
          member_id?: string | null
          member_name?: string | null
          parse_status?: string | null
          parsed_at?: string | null
          photo_purge_after?: string | null
          photo_purged_at?: string | null
          receipt_path?: string | null
          thumb_path?: string | null
        }
        Update: {
          ai_parsed_payload?: Json | null
          archived_receipt_path?: string | null
          archived_thumb_path?: string | null
          claim_id?: string
          claim_status?: string | null
          claim_title?: string | null
          company_id?: string
          created_at?: string
          credited_at?: string
          id?: string
          item_deleted_at?: string | null
          item_id?: string
          item_snapshot?: Json | null
          ledger_id?: string | null
          member_id?: string | null
          member_name?: string | null
          parse_status?: string | null
          parsed_at?: string | null
          photo_purge_after?: string | null
          photo_purged_at?: string | null
          receipt_path?: string | null
          thumb_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_usage_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_payments: {
        Row: {
          amount: number
          assignee_member_id: string
          billing_day: number
          billing_month: number | null
          company_id: string
          corporate_card_id: string | null
          created_at: string
          cycle: Database["public"]["Enums"]["recurring_cycle"]
          id: string
          is_active: boolean
          memo: string | null
          merchant_keyword: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          service_name: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          assignee_member_id: string
          billing_day: number
          billing_month?: number | null
          company_id: string
          corporate_card_id?: string | null
          created_at?: string
          cycle?: Database["public"]["Enums"]["recurring_cycle"]
          id?: string
          is_active?: boolean
          memo?: string | null
          merchant_keyword?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          service_name: string
          starts_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assignee_member_id?: string
          billing_day?: number
          billing_month?: number | null
          company_id?: string
          corporate_card_id?: string | null
          created_at?: string
          cycle?: Database["public"]["Enums"]["recurring_cycle"]
          id?: string
          is_active?: boolean
          memo?: string | null
          merchant_keyword?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          service_name?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_payments_assignee_member_id_company_id_fkey"
            columns: ["assignee_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "recurring_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_payments_corporate_card_id_company_id_fkey"
            columns: ["corporate_card_id", "company_id"]
            isOneToOne: false
            referencedRelation: "corporate_cards"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      tax_export_downloads: {
        Row: {
          actor_kind: string
          actor_name: string | null
          closed: boolean
          company_id: string
          created_at: string
          id: string
          kind: string
          month: string
          office_name: string | null
          row_count: number
          template_name: string | null
        }
        Insert: {
          actor_kind: string
          actor_name?: string | null
          closed?: boolean
          company_id: string
          created_at?: string
          id?: string
          kind: string
          month: string
          office_name?: string | null
          row_count?: number
          template_name?: string | null
        }
        Update: {
          actor_kind?: string
          actor_name?: string | null
          closed?: boolean
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          month?: string
          office_name?: string | null
          row_count?: number
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_export_downloads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_office_members: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          office_id: string
          phone: string | null
          privacy_agreed_at: string
          privacy_version: string | null
          role: string
          status: string
          terms_agreed_at: string
          terms_version: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          office_id: string
          phone?: string | null
          privacy_agreed_at: string
          privacy_version?: string | null
          role: string
          status?: string
          terms_agreed_at: string
          terms_version?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          office_id?: string
          phone?: string | null
          privacy_agreed_at?: string
          privacy_version?: string | null
          role?: string
          status?: string
          terms_agreed_at?: string
          terms_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "tax_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_office_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_sent_at: string | null
          office_member_id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_sent_at?: string | null
          office_member_id: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_sent_at?: string | null
          office_member_id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_office_push_subscriptions_office_member_id_fkey"
            columns: ["office_member_id"]
            isOneToOne: false
            referencedRelation: "tax_office_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_office_requests: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by_name: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          item_label: string | null
          month: string
          office_id: string | null
          office_name: string | null
          origin: string
          requested_by_name: string | null
          resolved_at: string | null
          status: string
          unread_for: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by_name?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label?: string | null
          month: string
          office_id?: string | null
          office_name?: string | null
          origin?: string
          requested_by_name?: string | null
          resolved_at?: string | null
          status?: string
          unread_for?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by_name?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_label?: string | null
          month?: string
          office_id?: string | null
          office_name?: string | null
          origin?: string
          requested_by_name?: string | null
          resolved_at?: string | null
          status?: string
          unread_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_office_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_office_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_office_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "tax_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_office_templates: {
        Row: {
          columns: Json
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          header_row: number
          id: string
          name: string
          office_id: string
          sheet_name: string | null
          target: string
          updated_at: string
        }
        Insert: {
          columns: Json
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          header_row?: number
          id?: string
          name: string
          office_id: string
          sheet_name?: string | null
          target?: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          header_row?: number
          id?: string
          name?: string
          office_id?: string
          sheet_name?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_office_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tax_office_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_office_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "tax_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_offices: {
        Row: {
          business_number: string
          business_status: string
          contact_email: string
          created_at: string
          default_mappings: Json | null
          default_saved_at: string | null
          default_source_name: string | null
          default_titles: Json | null
          id: string
          invite_code: string
          main_template_id: string | null
          name: string
        }
        Insert: {
          business_number: string
          business_status?: string
          contact_email: string
          created_at?: string
          default_mappings?: Json | null
          default_saved_at?: string | null
          default_source_name?: string | null
          default_titles?: Json | null
          id?: string
          invite_code: string
          main_template_id?: string | null
          name: string
        }
        Update: {
          business_number?: string
          business_status?: string
          contact_email?: string
          created_at?: string
          default_mappings?: Json | null
          default_saved_at?: string | null
          default_source_name?: string | null
          default_titles?: Json | null
          id?: string
          invite_code?: string
          main_template_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_offices_main_template_id_fkey"
            columns: ["main_template_id"]
            isOneToOne: false
            referencedRelation: "tax_office_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_files: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          mime: string | null
          name: string
          owner_member_id: string
          path: string
          scope: string
          scope_changed_at: string | null
          size: number
          source_message_id: string | null
          source_room_id: string | null
          thumb_path: string | null
          thumb_size: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind: string
          mime?: string | null
          name: string
          owner_member_id: string
          path: string
          scope?: string
          scope_changed_at?: string | null
          size: number
          source_message_id?: string | null
          source_room_id?: string | null
          thumb_path?: string | null
          thumb_size?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          owner_member_id?: string
          path?: string
          scope?: string
          scope_changed_at?: string | null
          size?: number
          source_message_id?: string | null
          source_room_id?: string | null
          thumb_path?: string | null
          thumb_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "vault_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_files_owner_member_id_company_id_fkey"
            columns: ["owner_member_id", "company_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_account_holder: string
          p_account_number: string
          p_bank_name: string
          p_department_id: string
          p_employee_number: string
          p_name: string
          p_optional_agreed: boolean
          p_phone: string
          p_position: string
          p_privacy_agreed: boolean
          p_terms_agreed: boolean
          p_token: string
          p_vehicle_number: string
        }
        Returns: string
      }
      ack_item_category: {
        Args: { p_ack?: boolean; p_item_id: string }
        Returns: undefined
      }
      add_accounting_format_request: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_memo: string
          p_program: string
        }
        Returns: string
      }
      add_hometax_upload: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_header: Json
          p_kind: string
          p_memo: string
          p_month: string
          p_preview: Json
          p_row_count: number
        }
        Returns: string
      }
      add_hometax_upload_office: {
        Args: {
          p_company_id: string
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_header: Json
          p_kind: string
          p_memo: string
          p_month: string
          p_preview: Json
          p_row_count: number
        }
        Returns: string
      }
      admin_dashboard: { Args: { p_month: string }; Returns: Json }
      answer_tax_office_request: {
        Args: { p_answer: string; p_id: string }
        Returns: undefined
      }
      app_admin_company_overview: {
        Args: { p_month: string }
        Returns: {
          billing_status: string
          business_number: string
          company_id: string
          created_at: string
          credits_granted: number
          credits_used: number
          last_receipt_at: string
          members_approved: number
          members_pending: number
          name: string
          receipts_deleted: number
          receipts_month: number
          receipts_total: number
        }[]
      }
      apply_receipt_parse: {
        Args: { p_item_id: string; p_ok: boolean; p_payload?: Json }
        Returns: undefined
      }
      apply_route_distance: {
        Args: {
          p_duration_s: number
          p_end_lat: number
          p_end_lng: number
          p_item_id: string
          p_one_way_m: number
          p_start_lat: number
          p_start_lng: number
        }
        Returns: boolean
      }
      apply_tax_office_default_titles: {
        Args: { p_company_ids: string[] }
        Returns: Json
      }
      approve_claim: {
        Args: { p_claim_id: string; p_comment?: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      approve_member: { Args: { p_member_id: string }; Returns: undefined }
      assign_tax_office_agent: {
        Args: { p_company_id: string; p_member_id: string }
        Returns: undefined
      }
      attach_item_evidence: {
        Args: { p_is_pdf?: boolean; p_item_id: string; p_thumb_ext?: string }
        Returns: Json
      }
      attach_odometer_photo: {
        Args: { p_item_id: string; p_which: string }
        Returns: string
      }
      attendance_admin_view: { Args: never; Returns: Json }
      attendance_day_admin: { Args: { p_date: string }; Returns: Json }
      attendance_leave_admin: { Args: { p_year: number }; Returns: Json }
      attendance_leave_cancel: {
        Args: { p_id: string; p_reason: string }
        Returns: string
      }
      attendance_leave_confirm: { Args: { p_items: Json }; Returns: number }
      attendance_leave_create: { Args: { p: Json }; Returns: Json }
      attendance_leave_decide: {
        Args: { p_approve: boolean; p_id: string; p_reason: string }
        Returns: Json
      }
      attendance_leave_file_add: {
        Args: {
          p_consent: boolean
          p_leave: string
          p_mime: string
          p_name: string
          p_path: string
          p_size: number
        }
        Returns: Json
      }
      attendance_leave_file_remove: {
        Args: { p_file: string }
        Returns: string
      }
      attendance_leave_settings_save: {
        Args: { p_hourly: boolean; p_rounding: string }
        Returns: undefined
      }
      attendance_leave_shortage_save: {
        Args: { p_mode: string }
        Returns: undefined
      }
      attendance_leave_type_save: { Args: { p: Json }; Returns: string }
      attendance_leave_types_list: { Args: never; Returns: Json }
      attendance_leaves_admin: { Args: never; Returns: Json }
      attendance_log_attempt: {
        Args: {
          p_code: string
          p_company: string
          p_ip: string
          p_member: string
          p_terminal: string
          p_ua: string
        }
        Returns: undefined
      }
      attendance_member_hire_date_set: {
        Args: { p_date: string; p_member: string; p_reason: string }
        Returns: undefined
      }
      attendance_member_month: {
        Args: { p_member: string; p_month: string }
        Returns: Json
      }
      attendance_pair_code_create: {
        Args: { p_code_hash: string; p_name: string }
        Returns: string
      }
      attendance_pending_count: { Args: never; Returns: number }
      attendance_punch: {
        Args: {
          p_company: string
          p_confirm_out: boolean
          p_member: string
          p_terminal: string
        }
        Returns: Json
      }
      attendance_request_cancel: { Args: { p_id: string }; Returns: undefined }
      attendance_request_create: {
        Args: {
          p_date: string
          p_in: string
          p_kind: string
          p_out: string
          p_reason: string
        }
        Returns: Json
      }
      attendance_request_decide: {
        Args: { p_approve: boolean; p_id: string; p_reason: string }
        Returns: Json
      }
      attendance_requests_admin: { Args: never; Returns: Json }
      attendance_set_enabled: { Args: { p_enabled: boolean }; Returns: boolean }
      attendance_settings_save: { Args: { p: Json }; Returns: Json }
      attendance_terminal_auth: { Args: { p_key_hash: string }; Returns: Json }
      attendance_terminal_pair: {
        Args: { p_code_hash: string; p_ip: string; p_key_hash: string }
        Returns: Json
      }
      attendance_terminal_rename: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      attendance_terminal_revoke: { Args: { p_id: string }; Returns: undefined }
      bus_alert_notify: {
        Args: {
          p_body: string
          p_kind: string
          p_member: string
          p_veh: string
        }
        Returns: boolean
      }
      bus_alert_off: { Args: never; Returns: undefined }
      bus_alert_set: {
        Args: {
          p_ars: string
          p_route_id: string
          p_route_no: string
          p_station_name: string
        }
        Returns: Json
      }
      bus_alert_track: {
        Args: { p_member: string; p_veh: string }
        Returns: undefined
      }
      bus_alerts_cleanup: { Args: never; Returns: number }
      bus_api_take: { Args: { p_n?: number }; Returns: boolean }
      bus_arrivals_put: {
        Args: { p_ars: string; p_routes: Json; p_station: string }
        Returns: undefined
      }
      bus_company_nearby: { Args: never; Returns: Json }
      business_verify_mode: { Args: never; Returns: string }
      calendar_busy: {
        Args: { p_ends: string; p_exclude?: string; p_starts: string }
        Returns: string[]
      }
      calendar_create_claim: { Args: { p_event_id: string }; Returns: string }
      calendar_delete_event: { Args: { p_id: string }; Returns: undefined }
      calendar_directory: { Args: never; Returns: Json }
      calendar_event: { Args: { p_id: string }; Returns: Json }
      calendar_event_claims: { Args: { p_event_id: string }; Returns: Json }
      calendar_event_file_add: {
        Args: {
          p_event: string
          p_mime: string
          p_name: string
          p_path: string
        }
        Returns: Json
      }
      calendar_event_file_delete: { Args: { p_id: string }; Returns: string }
      calendar_events_range: {
        Args: { p_from: string; p_members: string[]; p_to: string }
        Returns: Json
      }
      calendar_leaves_range: {
        Args: { p_from: string; p_members: string[]; p_to: string }
        Returns: Json
      }
      calendar_my_trip_events: { Args: never; Returns: Json }
      calendar_respond: {
        Args: { p_id: string; p_response: string }
        Returns: undefined
      }
      calendar_room_bookings: {
        Args: { p_ends: string; p_starts: string }
        Returns: Json
      }
      calendar_room_delete: { Args: { p_id: string }; Returns: undefined }
      calendar_room_reorder: { Args: { p_ids: string[] }; Returns: undefined }
      calendar_room_save: {
        Args: { p_id: string; p_name: string }
        Returns: string
      }
      calendar_rooms: { Args: never; Returns: Json }
      calendar_save_event: { Args: { p: Json; p_id: string }; Returns: string }
      calendar_save_prefs: {
        Args: { p_member_ids: string[]; p_show_deadlines: boolean }
        Returns: undefined
      }
      calendar_set_enabled: { Args: { p_enabled: boolean }; Returns: boolean }
      chat_assistant_room: { Args: never; Returns: string }
      chat_claim_push: { Args: { p_id: string }; Returns: Json }
      chat_create_group: {
        Args: { p_member_ids: string[]; p_title?: string }
        Returns: string
      }
      chat_delete_message: { Args: { p_id: string }; Returns: string }
      chat_files_due: {
        Args: { p_limit?: number }
        Returns: {
          message_id: string
          paths: string[]
        }[]
      }
      chat_files_mark_purged: { Args: { p_ids: string[] }; Returns: number }
      chat_invite: {
        Args: { p_member_ids: string[]; p_room: string }
        Returns: undefined
      }
      chat_leave: { Args: { p_room: string }; Returns: undefined }
      chat_mark_read: { Args: { p_room: string }; Returns: undefined }
      chat_member_directory: { Args: never; Returns: Json }
      chat_messages_page: {
        Args: {
          p_after?: string
          p_before?: string
          p_limit?: number
          p_room: string
        }
        Returns: Json
      }
      chat_my_threads: { Args: never; Returns: Json }
      chat_my_threads_new: { Args: never; Returns: number }
      chat_notice_push_due: { Args: never; Returns: Json }
      chat_open_claim: { Args: { p_claim: string }; Returns: string }
      chat_open_direct: { Args: { p_member: string }; Returns: string }
      chat_post_notices: {
        Args: {
          p_body: string
          p_company: string
          p_link: string
          p_members: string[]
        }
        Returns: number
      }
      chat_rename: {
        Args: { p_room: string; p_title: string }
        Returns: undefined
      }
      chat_retention_status: { Args: never; Returns: Json }
      chat_room_detail: { Args: { p_room: string }; Returns: Json }
      chat_room_list: { Args: never; Returns: Json }
      chat_send: {
        Args: {
          p_attachment?: Json
          p_body?: string
          p_id: string
          p_kind: string
          p_room: string
          p_thread?: string
        }
        Returns: Json
      }
      chat_set_attachment_days: { Args: { p_days: number }; Returns: number }
      chat_storage_status: { Args: never; Returns: Json }
      chat_thread_close: {
        Args: { p_summary: string; p_thread: string }
        Returns: Json
      }
      chat_thread_detail: { Args: { p_thread: string }; Returns: Json }
      chat_thread_list: { Args: { p_room: string }; Returns: Json }
      chat_thread_mark_read: { Args: { p_thread: string }; Returns: undefined }
      chat_thread_messages: {
        Args: {
          p_after?: string
          p_before?: string
          p_limit?: number
          p_thread: string
        }
        Returns: Json
      }
      chat_thread_open: {
        Args: { p_root: string; p_title: string }
        Returns: Json
      }
      chat_thread_reopen: { Args: { p_thread: string }; Returns: Json }
      chat_unread_total: { Args: never; Returns: number }
      check_claim_for_submit: { Args: { p_claim_id: string }; Returns: Json }
      claim_duplicate_receipts: { Args: { p_claim_id: string }; Returns: Json }
      claim_link_calendar_event: {
        Args: { p_claim: string; p_event: string }
        Returns: Json
      }
      clear_company_tax_office: { Args: never; Returns: undefined }
      clear_form_template: { Args: never; Returns: undefined }
      close_tax_month: { Args: { p_month: string }; Returns: Json }
      close_tax_office: { Args: { p_confirm_name: string }; Returns: string[] }
      closing_admin_targets: { Args: { p_today?: string }; Returns: Json }
      closing_calendar: { Args: { p_month: string }; Returns: Json }
      company_form_check: { Args: { p_message: string }; Returns: Json }
      company_form_delete: { Args: { p_id: string }; Returns: string }
      company_form_due: { Args: never; Returns: Json }
      company_form_edit: { Args: { p_group: string }; Returns: string }
      company_form_publish: { Args: { p_id: string }; Returns: Json }
      company_form_read_begin: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      company_form_read_done: {
        Args: { p_fields: Json; p_id: string; p_name: string; p_sheets: Json }
        Returns: undefined
      }
      company_form_save: {
        Args: { p_fields: Json; p_id: string; p_name: string; p_sheets: Json }
        Returns: undefined
      }
      company_form_slots: { Args: never; Returns: Json }
      company_form_start: {
        Args: {
          p_group: string
          p_id: string
          p_mime: string
          p_name: string
          p_path: string
          p_source_name: string
        }
        Returns: Json
      }
      company_location_save: {
        Args: {
          p_address: string
          p_found: string
          p_jibun?: string
          p_lat: number
          p_lng: number
          p_region: string
          p_zonecode?: string
        }
        Returns: Json
      }
      company_set_tax_request_status: {
        Args: { p_id: string; p_resolved: boolean }
        Returns: undefined
      }
      connect_tax_office_by_code: { Args: { p_code: string }; Returns: string }
      consume_receipt_credit: {
        Args: {
          p_event_amount: number
          p_event_enabled: boolean
          p_item_id: string
          p_member_id: string
        }
        Returns: Json
      }
      create_company: {
        Args: {
          p_business_number: string
          p_company_name: string
          p_departments: string[]
          p_my_department: string
          p_my_name: string
          p_my_phone: string
          p_my_position: string
          p_privacy_agreed: boolean
          p_terms_agreed: boolean
        }
        Returns: string
      }
      create_company_tax_request: {
        Args: { p_body: string; p_item_id: string; p_month: string }
        Returns: string
      }
      create_own_car_item: { Args: { p_claim_id: string }; Returns: string }
      create_receipt_item: {
        Args: { p_claim_id: string; p_is_pdf?: boolean; p_thumb_ext?: string }
        Returns: Json
      }
      create_recurring_claim_from_card: {
        Args: {
          p_amount: number
          p_date: string
          p_last4: string
          p_merchant: string
          p_recurring_id: string
        }
        Returns: string
      }
      create_tax_office_request: {
        Args: {
          p_body: string
          p_company_id: string
          p_item_id: string
          p_month: string
        }
        Returns: string
      }
      credit_usage: { Args: { p_month: string }; Returns: Json }
      deactivate_member: { Args: { p_member_id: string }; Returns: undefined }
      delete_hometax_upload: { Args: { p_id: string }; Returns: string }
      delete_hometax_upload_office: { Args: { p_id: string }; Returns: string }
      delete_tax_office_template: { Args: { p_id: string }; Returns: string }
      detach_item_evidence: { Args: { p_item_id: string }; Returns: Json }
      detach_odometer_photo: {
        Args: { p_item_id: string; p_which: string }
        Returns: string
      }
      doc_convert_begin: {
        Args: {
          p_id: string
          p_member: string
          p_message: string
          p_mime: string
          p_name: string
          p_pages: number
          p_path: string
        }
        Returns: Json
      }
      doc_convert_check: { Args: { p_message: string }; Returns: Json }
      doc_convert_confirm: {
        Args: { p_id: string; p_scope: string }
        Returns: undefined
      }
      doc_convert_delete: { Args: { p_id: string }; Returns: string }
      doc_convert_due: { Args: never; Returns: Json }
      doc_convert_fail: { Args: { p_id: string }; Returns: string }
      doc_convert_ready: {
        Args: { p_id: string; p_sheets: Json }
        Returns: undefined
      }
      doc_convert_save: {
        Args: { p_id: string; p_sheets: Json }
        Returns: undefined
      }
      feedback_due: {
        Args: never
        Returns: {
          id: string
          shot_path: string
        }[]
      }
      feedback_submit: {
        Args: {
          p_app_version: string
          p_category: string
          p_content: string
          p_id: string
          p_page_url: string
          p_shot_path: string
          p_user_agent: string
          p_viewport: string
        }
        Returns: string
      }
      feedback_today_count: { Args: never; Returns: number }
      form_slot_grant: {
        Args: { p_add: number; p_company: string }
        Returns: number
      }
      form_slot_request: { Args: never; Returns: undefined }
      generate_recurring_claims: { Args: { p_today?: string }; Returns: Json }
      get_invitation_detail: { Args: { p_token: string }; Returns: Json }
      get_invitation_public: { Args: { p_token: string }; Returns: Json }
      get_invite_company: { Args: { p_code: string }; Returns: string }
      get_invite_departments: {
        Args: { p_code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_tax_office_by_code: { Args: { p_code: string }; Returns: string }
      help_take: { Args: never; Returns: number }
      join_company: {
        Args: {
          p_account_holder: string
          p_account_number: string
          p_bank_name: string
          p_code: string
          p_department_id: string
          p_employee_number: string
          p_name: string
          p_optional_agreed: boolean
          p_phone: string
          p_position: string
          p_privacy_agreed: boolean
          p_terms_agreed: boolean
          p_vehicle_number: string
        }
        Returns: string
      }
      join_tax_office: {
        Args: {
          p_code: string
          p_my_name: string
          p_my_phone: string
          p_privacy_agreed: boolean
          p_terms_agreed: boolean
        }
        Returns: string
      }
      leave_files_due: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          path: string
        }[]
      }
      leave_files_mark_purged: { Args: { p_ids: string[] }; Returns: number }
      leave_tax_office: { Args: never; Returns: undefined }
      log_tax_export: {
        Args: {
          p_closed: boolean
          p_company_id: string
          p_kind: string
          p_month: string
          p_row_count: number
          p_template_name: string
        }
        Returns: undefined
      }
      mark_claims_paid: { Args: { p_claim_ids: string[] }; Returns: number }
      mark_tax_requests_seen: {
        Args: { p_company_id: string }
        Returns: number
      }
      meeting_files_due: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          path: string
        }[]
      }
      meeting_files_mark_purged: { Args: { p_ids: string[] }; Returns: number }
      meeting_files_orphans: { Args: { p_limit?: number }; Returns: string[] }
      member_deactivation_check: {
        Args: { p_member_id: string }
        Returns: Json
      }
      move_item_to_new_claim: { Args: { p_item_id: string }; Returns: Json }
      my_attendance_month: { Args: { p_month: string }; Returns: Json }
      my_attendance_today: { Args: never; Returns: Json }
      my_company_tax_office: { Args: never; Returns: Json }
      my_company_tax_office_code: { Args: never; Returns: string }
      my_company_tax_templates: {
        Args: never
        Returns: {
          id: string
          name: string
          office_name: string
          target: string
        }[]
      }
      my_employee_summary: { Args: never; Returns: Json }
      my_feature_enabled: { Args: { p_feature: string }; Returns: boolean }
      my_hire_date: { Args: never; Returns: string }
      my_membership: { Args: never; Returns: Json }
      my_tax_office: { Args: never; Returns: Json }
      my_vacation: { Args: { p_year: number }; Returns: Json }
      office_answer_tax_request: {
        Args: { p_answer: string; p_id: string }
        Returns: undefined
      }
      override_item_account_title: {
        Args: { p_account_title_id: string; p_item_id: string }
        Returns: undefined
      }
      push_approval_targets: {
        Args: { p_hours?: number; p_now?: string }
        Returns: Json
      }
      push_deadline_targets: { Args: { p_today?: string }; Returns: Json }
      reactivate_member: { Args: { p_member_id: string }; Returns: undefined }
      record_perf_events: { Args: { p_events: Json }; Returns: number }
      recurring_personal_due: { Args: { p_today?: string }; Returns: Json }
      refresh_claim_totals: { Args: { p_claim_id: string }; Returns: Json }
      regenerate_invite_code: { Args: never; Returns: string }
      regenerate_tax_office_code: { Args: never; Returns: string }
      register_tax_office: {
        Args: {
          p_business_number: string
          p_my_name: string
          p_my_phone: string
          p_name: string
          p_privacy_agreed: boolean
          p_terms_agreed: boolean
        }
        Returns: string
      }
      reject_claim: {
        Args: {
          p_claim_id: string
          p_flagged_item_ids?: string[]
          p_reason: string
        }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      reject_member: { Args: { p_member_id: string }; Returns: undefined }
      release_tax_office_client: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      reminder_candidates: {
        Args: never
        Returns: {
          department: string
          has_phone: boolean
          member_id: string
          name: string
          open_claims: number
          reminded_today: boolean
        }[]
      }
      reopen_tax_month: {
        Args: { p_month: string; p_reason: string }
        Returns: undefined
      }
      request_item_tax_review: {
        Args: { p_item_id: string; p_memo: string }
        Returns: undefined
      }
      save_approval_line: {
        Args: { p_approver_ids: string[]; p_department_id: string }
        Returns: string
      }
      save_card_reconciliation: {
        Args: {
          p_counts: Json
          p_file_name: string
          p_from: string
          p_issues: Json
          p_month: string
          p_to: string
        }
        Returns: string
      }
      save_company_referral: {
        Args: {
          p_kind: string
          p_referrer_company_id: string
          p_referrer_name: string
          p_referrer_phone: string
        }
        Returns: undefined
      }
      save_form_template: {
        Args: {
          p_ai_extracted?: Json
          p_schema: Json
          p_source_file_path?: string
        }
        Returns: string
      }
      save_tax_office_default_titles: {
        Args: { p_company_id: string }
        Returns: Json
      }
      save_tax_office_template: {
        Args: {
          p_columns: Json
          p_file_name: string
          p_file_path: string
          p_header_row: number
          p_id: string
          p_name: string
          p_sheet_name: string
          p_target: string
        }
        Returns: string
      }
      search_referral_companies: {
        Args: { p_query: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      set_card_issue_status: {
        Args: { p_issue_id: string; p_memo: string; p_status: string }
        Returns: Json
      }
      set_claim_category: {
        Args: {
          p_attendees?: string
          p_category: Database["public"]["Enums"]["expense_category"]
          p_claim_id: string
          p_client_name?: string
          p_condolence_target?: string
          p_headcount?: number
          p_meeting_purpose?: string
          p_purchase_items?: string
          p_purchase_purpose?: string
          p_purchase_type?: Database["public"]["Enums"]["purchase_type"]
          p_trip_transport?: Database["public"]["Enums"]["trip_transport"]
          p_vehicle_id?: string
        }
        Returns: Json
      }
      set_company_card_via_hometax: {
        Args: { p_company_id: string; p_value: boolean }
        Returns: undefined
      }
      set_company_fuel_mode: { Args: { p_mode: string }; Returns: undefined }
      set_company_per_diem: {
        Args: { p_amount: number; p_enabled: boolean }
        Returns: undefined
      }
      set_company_tax_office: {
        Args: {
          p_agent_email: string
          p_agent_name: string
          p_agent_phone: string
          p_office_email: string
          p_office_name: string
        }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_member_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: undefined
      }
      set_my_fuel_type: { Args: { p_fuel_type: string }; Returns: undefined }
      set_my_hire_date: { Args: { p_date: string }; Returns: undefined }
      set_own_car_route: {
        Args: {
          p_end: Json
          p_item_id: string
          p_manual_one_way_km?: number
          p_round_trip: boolean
          p_start: Json
        }
        Returns: undefined
      }
      set_payout_proof: {
        Args: { p_claim_ids: string[]; p_name: string; p_path: string }
        Returns: number
      }
      set_tax_office_main_template: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      set_tax_office_member_status: {
        Args: { p_member_id: string; p_status: string }
        Returns: undefined
      }
      set_tax_office_request_status: {
        Args: { p_id: string; p_resolved: boolean }
        Returns: undefined
      }
      storage_total_bytes: { Args: never; Returns: number }
      submit_claim: {
        Args: { p_claim_id: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      submit_feedback_survey: {
        Args: {
          p_company_size: string
          p_display_consent: boolean
          p_industry: string
          p_job_role: string
          p_rating: number
          p_review: string
          p_useful_feature: string
        }
        Returns: number
      }
      substitute_card_evidence: {
        Args: {
          p_amount: number
          p_date: string
          p_item_id: string
          p_last4: string
          p_merchant: string
        }
        Returns: undefined
      }
      tax_export_options: { Args: { p_company_id: string }; Returns: Json }
      tax_month_export: { Args: { p_month: string }; Returns: Json }
      tax_month_items: {
        Args: { p_month: string }
        Returns: {
          closed: boolean
          item_id: string
          kind: string
          seq: number
        }[]
      }
      tax_office_client_status: { Args: { p_month: string }; Returns: Json }
      tax_office_clients: {
        Args: never
        Returns: {
          agent_email: string
          agent_name: string
          assigned_member_id: string
          assigned_name: string
          business_number: string
          company_id: string
          company_name: string
          linked_at: string
        }[]
      }
      tax_office_connect_info: { Args: { p_code: string }; Returns: Json }
      tax_office_default_titles: { Args: never; Returns: Json }
      tax_office_main_template_id: { Args: never; Returns: string }
      tax_office_member_list: {
        Args: never
        Returns: {
          assigned_count: number
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          role: string
          status: string
        }[]
      }
      tax_office_month_export: {
        Args: { p_company_id: string; p_month: string }
        Returns: Json
      }
      tax_office_notice_targets: {
        Args: { p_company_id: string }
        Returns: Json
      }
      tax_office_override_item_account_title: {
        Args: { p_account_title_id: string; p_item_id: string }
        Returns: Json
      }
      tax_office_template_list: {
        Args: never
        Returns: {
          columns: Json
          file_name: string
          header_row: number
          id: string
          name: string
          sheet_name: string
          target: string
          updated_at: string
        }[]
      }
      tax_template_for_export: {
        Args: { p_company_id: string; p_template_id: string }
        Returns: Json
      }
      transfer_super_admin: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      transfer_tax_office_admin: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      update_company_settings: {
        Args: {
          p_business_number: string
          p_claim_deadline_days: number
          p_claim_deadline_type: Database["public"]["Enums"]["claim_deadline_type"]
          p_fuel_enabled?: boolean
          p_fuel_rate_per_km: number
          p_meal_limit_enabled?: boolean
          p_meal_limit_mode: Database["public"]["Enums"]["meal_limit_mode"]
          p_meal_limit_per_person: number
          p_name: string
          p_odometer_photo_required?: boolean
        }
        Returns: undefined
      }
      update_member: {
        Args: {
          p_department_id: string
          p_employee_number: string
          p_meal_limit_override?: number
          p_member_id: string
          p_name: string
          p_phone: string
          p_position: string
          p_receives_car_allowance?: boolean
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_account_holder: string
          p_account_number: string
          p_bank_name: string
          p_employee_number: string
          p_name: string
          p_optional_agreed?: boolean
          p_phone: string
          p_position: string
          p_vehicle_number: string
        }
        Returns: undefined
      }
      vault_add: {
        Args: {
          p_member: string
          p_message: string
          p_path: string
          p_scope: string
          p_thumb_path: string
          p_thumb_size: number
        }
        Returns: string
      }
      vault_delete: { Args: { p_id: string }; Returns: Json }
      vault_files_remove: { Args: { p_ids: string[] }; Returns: number }
      vault_keep_check: { Args: { p_message: string }; Returns: Json }
      vault_leaver_files_due: { Args: never; Returns: Json }
      vault_member_usage: { Args: never; Returns: Json }
      vault_set_scope: {
        Args: { p_id: string; p_scope: string }
        Returns: undefined
      }
      vault_status: { Args: never; Returns: Json }
    }
    Enums: {
      announcement_scope: "platform" | "company"
      approval_step_kind: "review" | "final"
      approval_step_status:
        | "waiting"
        | "pending"
        | "approved"
        | "rejected"
        | "skipped"
        | "canceled"
      billing_status: "free_trial" | "active"
      claim_deadline_type:
        | "none"
        | "end_of_month"
        | "days_after"
        | "next_month_day"
      claim_status: "draft" | "submitted" | "approved" | "rejected" | "paid"
      distance_source: "api" | "manual"
      evidence_kind:
        | "receipt"
        | "invoice"
        | "app_history"
        | "card_history"
        | "invitation"
        | "other"
        | "none"
      evidence_type:
        | "card_slip"
        | "cash_receipt"
        | "tax_invoice"
        | "simple_receipt"
        | "other"
      expense_category:
        | "meal"
        | "trip"
        | "meeting"
        | "purchase"
        | "team_dinner"
        | "condolence"
        | "seminar"
        | "books"
        | "training"
        | "company_car"
        | "saas"
      invitation_status: "invited" | "accepted" | "canceled"
      meal_limit_mode: "split" | "notify"
      member_role: "super_admin" | "admin" | "employee"
      member_status: "pending" | "approved" | "inactive"
      notification_status: "queued" | "sent" | "failed"
      parse_status: "none" | "parsing" | "success" | "failed"
      payment_method: "corporate_card" | "personal_card"
      purchase_type: "pantry" | "office_supplies" | "small_equipment"
      recurring_cycle: "monthly" | "yearly"
      trip_transport: "own_car" | "public_transport" | "company_car"
      trip_type:
        | "meal"
        | "public_transport"
        | "taxi"
        | "toll_parking"
        | "lodging"
        | "own_car"
        | "other"
        | "car_fuel"
        | "car_toll"
        | "per_diem"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      announcement_scope: ["platform", "company"],
      approval_step_kind: ["review", "final"],
      approval_step_status: [
        "waiting",
        "pending",
        "approved",
        "rejected",
        "skipped",
        "canceled",
      ],
      billing_status: ["free_trial", "active"],
      claim_deadline_type: [
        "none",
        "end_of_month",
        "days_after",
        "next_month_day",
      ],
      claim_status: ["draft", "submitted", "approved", "rejected", "paid"],
      distance_source: ["api", "manual"],
      evidence_kind: [
        "receipt",
        "invoice",
        "app_history",
        "card_history",
        "invitation",
        "other",
        "none",
      ],
      evidence_type: [
        "card_slip",
        "cash_receipt",
        "tax_invoice",
        "simple_receipt",
        "other",
      ],
      expense_category: [
        "meal",
        "trip",
        "meeting",
        "purchase",
        "team_dinner",
        "condolence",
        "seminar",
        "books",
        "training",
        "company_car",
        "saas",
      ],
      invitation_status: ["invited", "accepted", "canceled"],
      meal_limit_mode: ["split", "notify"],
      member_role: ["super_admin", "admin", "employee"],
      member_status: ["pending", "approved", "inactive"],
      notification_status: ["queued", "sent", "failed"],
      parse_status: ["none", "parsing", "success", "failed"],
      payment_method: ["corporate_card", "personal_card"],
      purchase_type: ["pantry", "office_supplies", "small_equipment"],
      recurring_cycle: ["monthly", "yearly"],
      trip_transport: ["own_car", "public_transport", "company_car"],
      trip_type: [
        "meal",
        "public_transport",
        "taxi",
        "toll_parking",
        "lodging",
        "own_car",
        "other",
        "car_fuel",
        "car_toll",
        "per_diem",
      ],
    },
  },
} as const
