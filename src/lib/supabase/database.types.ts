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
      account_title_mappings: {
        Row: {
          account_title_id: string
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string
          created_at: string
          id: string
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
        }
        Insert: {
          account_title_id: string
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string
          created_at?: string
          id?: string
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
        }
        Update: {
          account_title_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          company_id?: string
          created_at?: string
          id?: string
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
      billing_plans: {
        Row: {
          code: string
          created_at: string
          id: string
          is_purchasable: boolean
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_purchasable?: boolean
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_purchasable?: boolean
          monthly_price?: number
          monthly_receipts?: number
          name?: string
          recommended_size?: string | null
          sort_order?: number
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
          fuel_enabled: boolean
          fuel_rate_per_km: number
          id: string
          invite_code: string
          last_event_bonus_at: string | null
          meal_limit_enabled: boolean
          meal_limit_mode: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person: number
          name: string
          odometer_photo_required: boolean
          policy_confirmed_at: string | null
          receipt_credits_granted: number
          receipt_credits_used: number
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
          fuel_enabled?: boolean
          fuel_rate_per_km?: number
          id?: string
          invite_code: string
          last_event_bonus_at?: string | null
          meal_limit_enabled?: boolean
          meal_limit_mode?: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person?: number
          name: string
          odometer_photo_required?: boolean
          policy_confirmed_at?: string | null
          receipt_credits_granted?: number
          receipt_credits_used?: number
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
          fuel_enabled?: boolean
          fuel_rate_per_km?: number
          id?: string
          invite_code?: string
          last_event_bonus_at?: string | null
          meal_limit_enabled?: boolean
          meal_limit_mode?: Database["public"]["Enums"]["meal_limit_mode"]
          meal_limit_per_person?: number
          name?: string
          odometer_photo_required?: boolean
          policy_confirmed_at?: string | null
          receipt_credits_granted?: number
          receipt_credits_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      corporate_cards: {
        Row: {
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
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delta: number
          id?: string
          item_id?: string | null
          member_id?: string | null
          reason: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delta?: number
          id?: string
          item_id?: string | null
          member_id?: string | null
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
      expense_claims: {
        Row: {
          approved_at: string | null
          company_id: string
          created_at: string
          current_round: number
          description: string | null
          form_template_id: string | null
          header_custom_payload: Json
          id: string
          is_business_trip: boolean
          item_count: number
          member_id: string
          paid_at: string | null
          paid_by_member_id: string | null
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
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          company_id: string
          created_at?: string
          current_round?: number
          description?: string | null
          form_template_id?: string | null
          header_custom_payload?: Json
          id?: string
          is_business_trip?: boolean
          item_count?: number
          member_id: string
          paid_at?: string | null
          paid_by_member_id?: string | null
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
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          company_id?: string
          created_at?: string
          current_round?: number
          description?: string | null
          form_template_id?: string | null
          header_custom_payload?: Json
          id?: string
          is_business_trip?: boolean
          item_count?: number
          member_id?: string
          paid_at?: string | null
          paid_by_member_id?: string | null
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
          updated_at?: string
        }
        Relationships: [
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
          applied_fuel_rate_per_km: number | null
          applied_meal_limit_mode:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person: number | null
          attendees: string | null
          card_last4: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          claim_id: string
          client_name: string | null
          closed_month: string | null
          company_id: string
          company_supported_amount: number | null
          corporate_card_id: string | null
          created_at: string
          credit_charged: boolean
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"] | null
          end_lat: number | null
          end_lng: number | null
          end_location: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"] | null
          expense_date: string | null
          headcount: number | null
          id: string
          is_round_trip: boolean | null
          item_custom_payload: Json
          merchant_business_number: string | null
          merchant_name: string | null
          parse_status: Database["public"]["Enums"]["parse_status"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount: number
          purpose: string | null
          receipt_path: string | null
          receipt_thumb_path: string | null
          sort_order: number
          start_lat: number | null
          start_lng: number | null
          start_location: string | null
          supply_amount: number | null
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
          applied_fuel_rate_per_km?: number | null
          applied_meal_limit_mode?:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person?: number | null
          attendees?: string | null
          card_last4?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          claim_id: string
          client_name?: string | null
          closed_month?: string | null
          company_id: string
          company_supported_amount?: number | null
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
          evidence_type?: Database["public"]["Enums"]["evidence_type"] | null
          expense_date?: string | null
          headcount?: number | null
          id?: string
          is_round_trip?: boolean | null
          item_custom_payload?: Json
          merchant_business_number?: string | null
          merchant_name?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount?: number
          purpose?: string | null
          receipt_path?: string | null
          receipt_thumb_path?: string | null
          sort_order?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          supply_amount?: number | null
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
          applied_fuel_rate_per_km?: number | null
          applied_meal_limit_mode?:
            | Database["public"]["Enums"]["meal_limit_mode"]
            | null
          applied_meal_limit_per_person?: number | null
          attendees?: string | null
          card_last4?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          claim_id?: string
          client_name?: string | null
          closed_month?: string | null
          company_id?: string
          company_supported_amount?: number | null
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
          evidence_type?: Database["public"]["Enums"]["evidence_type"] | null
          expense_date?: string | null
          headcount?: number | null
          id?: string
          is_round_trip?: boolean | null
          item_custom_payload?: Json
          merchant_business_number?: string | null
          merchant_name?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          personal_burden_amount?: number
          purpose?: string | null
          receipt_path?: string | null
          receipt_thumb_path?: string | null
          sort_order?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          supply_amount?: number | null
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
          company_id: string
          created_at: string
          department_id: string | null
          email: string | null
          employee_number: string | null
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
          company_id: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_number?: string | null
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
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_number?: string | null
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
      approve_claim: {
        Args: { p_claim_id: string; p_comment?: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      approve_member: { Args: { p_member_id: string }; Returns: undefined }
      business_verify_mode: { Args: never; Returns: string }
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
      deactivate_member: { Args: { p_member_id: string }; Returns: undefined }
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
      mark_claims_paid: { Args: { p_claim_ids: string[] }; Returns: number }
      member_deactivation_check: {
        Args: { p_member_id: string }
        Returns: Json
      }
      my_membership: { Args: never; Returns: Json }
      reactivate_member: { Args: { p_member_id: string }; Returns: undefined }
      regenerate_invite_code: { Args: never; Returns: string }
      reject_claim: {
        Args: {
          p_claim_id: string
          p_flagged_item_ids?: string[]
          p_reason: string
        }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      reject_member: { Args: { p_member_id: string }; Returns: undefined }
      set_member_role: {
        Args: {
          p_member_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: undefined
      }
      submit_claim: {
        Args: { p_claim_id: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      transfer_super_admin: {
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
          p_member_id: string
          p_name: string
          p_phone: string
          p_position: string
          p_receives_car_allowance?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
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
      evidence_type:
        | "card_slip"
        | "cash_receipt"
        | "tax_invoice"
        | "simple_receipt"
        | "other"
      expense_category: "meal" | "trip" | "meeting"
      invitation_status: "invited" | "accepted" | "canceled"
      meal_limit_mode: "split" | "notify"
      member_role: "super_admin" | "admin" | "employee"
      member_status: "pending" | "approved" | "inactive"
      notification_status: "queued" | "sent" | "failed"
      parse_status: "none" | "parsing" | "success" | "failed"
      payment_method: "corporate_card" | "personal_card"
      trip_type:
        | "meal"
        | "public_transport"
        | "taxi"
        | "toll_parking"
        | "lodging"
        | "own_car"
        | "other"
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
      evidence_type: [
        "card_slip",
        "cash_receipt",
        "tax_invoice",
        "simple_receipt",
        "other",
      ],
      expense_category: ["meal", "trip", "meeting"],
      invitation_status: ["invited", "accepted", "canceled"],
      meal_limit_mode: ["split", "notify"],
      member_role: ["super_admin", "admin", "employee"],
      member_status: ["pending", "approved", "inactive"],
      notification_status: ["queued", "sent", "failed"],
      parse_status: ["none", "parsing", "success", "failed"],
      payment_method: ["corporate_card", "personal_card"],
      trip_type: [
        "meal",
        "public_transport",
        "taxi",
        "toll_parking",
        "lodging",
        "own_car",
        "other",
      ],
    },
  },
} as const
