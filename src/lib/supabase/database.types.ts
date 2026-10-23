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
          purchase_type: Database["public"]["Enums"]["purchase_type"] | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
        }
        Insert: {
          account_title_id: string
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string
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
      billing_plans: {
        Row: {
          annual_price: number | null
          code: string
          created_at: string
          id: string
          is_featured: boolean
          is_purchasable: boolean
          is_unlimited: boolean
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          annual_price?: number | null
          code: string
          created_at?: string
          id?: string
          is_featured?: boolean
          is_purchasable?: boolean
          is_unlimited?: boolean
          monthly_price: number
          monthly_receipts: number
          name: string
          recommended_size?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          annual_price?: number | null
          code?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          is_purchasable?: boolean
          is_unlimited?: boolean
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
          policy_confirmed_at?: string | null
          receipt_credits_granted?: number
          receipt_credits_used?: number
          updated_at?: string
        }
        Relationships: []
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
          attendees: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          client_name: string | null
          company_id: string
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
          category?: Database["public"]["Enums"]["expense_category"] | null
          client_name?: string | null
          company_id: string
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
          category?: Database["public"]["Enums"]["expense_category"] | null
          client_name?: string | null
          company_id?: string
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
          corporate_card_id: string | null
          created_at: string
          credit_charged: boolean
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"] | null
          end_lat: number | null
          end_lng: number | null
          end_location: string | null
          evidence_kind: Database["public"]["Enums"]["evidence_kind"] | null
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
          fuel_type: string | null
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
          fuel_type?: string | null
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
          fuel_type?: string | null
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
      admin_dashboard: { Args: { p_month: string }; Returns: Json }
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
      approve_claim: {
        Args: { p_claim_id: string; p_comment?: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      approve_member: { Args: { p_member_id: string }; Returns: undefined }
      attach_item_evidence: {
        Args: { p_is_pdf?: boolean; p_item_id: string; p_thumb_ext?: string }
        Returns: Json
      }
      business_verify_mode: { Args: never; Returns: string }
      check_claim_for_submit: { Args: { p_claim_id: string }; Returns: Json }
      claim_duplicate_receipts: { Args: { p_claim_id: string }; Returns: Json }
      close_tax_month: { Args: { p_month: string }; Returns: Json }
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
      create_own_car_item: { Args: { p_claim_id: string }; Returns: string }
      create_receipt_item: {
        Args: { p_claim_id: string; p_is_pdf?: boolean; p_thumb_ext?: string }
        Returns: Json
      }
      deactivate_member: { Args: { p_member_id: string }; Returns: undefined }
      detach_item_evidence: { Args: { p_item_id: string }; Returns: Json }
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
      move_item_to_new_claim: { Args: { p_item_id: string }; Returns: Json }
      my_employee_summary: { Args: never; Returns: Json }
      my_membership: { Args: never; Returns: Json }
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
      refresh_claim_totals: { Args: { p_claim_id: string }; Returns: Json }
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
      save_approval_line: {
        Args: { p_approver_ids: string[]; p_department_id: string }
        Returns: string
      }
      set_claim_category: {
        Args: {
          p_attendees?: string
          p_category: Database["public"]["Enums"]["expense_category"]
          p_claim_id: string
          p_client_name?: string
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
      set_company_fuel_mode: { Args: { p_mode: string }; Returns: undefined }
      set_member_role: {
        Args: {
          p_member_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: undefined
      }
      set_my_fuel_type: { Args: { p_fuel_type: string }; Returns: undefined }
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
      submit_claim: {
        Args: { p_claim_id: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
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
      ],
    },
  },
} as const
