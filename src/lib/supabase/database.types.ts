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
  rush: {
    Tables: {
      applications: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          pnm_id: string
          resume_storage_path: string | null
          status: Database["rush"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          pnm_id: string
          resume_storage_path?: string | null
          status?: Database["rush"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          pnm_id?: string
          resume_storage_path?: string | null
          status?: Database["rush"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_pnm_id_fkey"
            columns: ["pnm_id"]
            isOneToOne: false
            referencedRelation: "pnms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_application_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "application_responses"
            referencedColumns: ["application_id"]
          },
        ]
      }
      application_questions: {
        Row: {
          cycle_id: string
          id: string
          input_type: string
          key: string
          options: Json
          prompt: string
          required: boolean
          sort_order: number
        }
        Insert: {
          cycle_id: string
          id?: string
          input_type?: string
          key: string
          options?: Json
          prompt: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          cycle_id?: string
          id?: string
          input_type?: string
          key?: string
          options?: Json
          prompt?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      application_responses: {
        Row: {
          application_id: string
          created_at: string
          id: string
          question_key: string
          question_text: string
          response_text: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          question_key: string
          question_text: string
          response_text: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          question_key?: string
          question_text?: string
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_slots: {
        Row: { cycle_id: string; ends_at: string; id: string; member_id: string; starts_at: string }
        Insert: { cycle_id: string; ends_at: string; id?: string; member_id: string; starts_at: string }
        Update: { cycle_id?: string; ends_at?: string; id?: string; member_id?: string; starts_at?: string }
        Relationships: []
      }
      case_groups: {
        Row: { cycle_id: string; id: string; name: string; prompt: string }
        Insert: { cycle_id: string; id?: string; name: string; prompt?: string }
        Update: { cycle_id?: string; id?: string; name?: string; prompt?: string }
        Relationships: []
      }
      case_group_members: {
        Row: { application_id: string; group_id: string }
        Insert: { application_id: string; group_id: string }
        Update: { application_id?: string; group_id?: string }
        Relationships: []
      }
      event_slots: {
        Row: { capacity: number; ends_at: string; event_id: string; id: string; starts_at: string }
        Insert: { capacity?: number; ends_at: string; event_id: string; id?: string; starts_at: string }
        Update: { capacity?: number; ends_at?: string; event_id?: string; id?: string; starts_at?: string }
        Relationships: []
      }
      interest_signups: {
        Row: { class_year: string | null; cycle_id: string; email: string; how_heard: string | null; id: string; name: string; uniqname: string | null }
        Insert: { class_year?: string | null; cycle_id: string; email: string; how_heard?: string | null; id?: string; name: string; uniqname?: string | null }
        Update: { class_year?: string | null; cycle_id?: string; email?: string; how_heard?: string | null; id?: string; name?: string; uniqname?: string | null }
        Relationships: []
      }
      slot_rsvps: {
        Row: { application_id: string; created_at: string; id: string; slot_id: string }
        Insert: { application_id: string; created_at?: string; id?: string; slot_id: string }
        Update: { application_id?: string; created_at?: string; id?: string; slot_id?: string }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          cycle_id: string | null
          id: number
          metadata: Json
          resource: string
          resource_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          cycle_id?: string | null
          id?: never
          metadata?: Json
          resource: string
          resource_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          cycle_id?: string | null
          id?: never
          metadata?: Json
          resource?: string
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          checked_in_at: string
          event_id: string
          id: string
          pnm_id: string
        }
        Insert: {
          checked_in_at?: string
          event_id: string
          id?: string
          pnm_id: string
        }
        Update: {
          checked_in_at?: string
          event_id?: string
          id?: string
          pnm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_pnm_id_fkey"
            columns: ["pnm_id"]
            isOneToOne: false
            referencedRelation: "pnms"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tokens: {
        Row: {
          application_id: string
          claimed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_digest: string
        }
        Insert: {
          application_id: string
          claimed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token_digest: string
        }
        Update: {
          application_id?: string
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_declarations: {
        Row: {
          application_id: string
          created_at: string
          declarer_id: string
          id: string
          reason: string
        }
        Insert: {
          application_id: string
          created_at?: string
          declarer_id: string
          id?: string
          reason: string
        }
        Update: {
          application_id?: string
          created_at?: string
          declarer_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflict_declarations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflict_declarations_declarer_id_fkey"
            columns: ["declarer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      criterion_ratings: {
        Row: {
          criterion_id: string
          evaluation_id: string
          id: string
          note: string | null
          score: number | null
        }
        Insert: {
          criterion_id: string
          evaluation_id: string
          id?: string
          note?: string | null
          score?: number | null
        }
        Update: {
          criterion_id?: string
          evaluation_id?: string
          id?: string
          note?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "criterion_ratings_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criterion_ratings_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_approvals: {
        Row: {
          approver_id: string
          created_at: string
          decision_id: string
          id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          decision_id: string
          id?: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          decision_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          application_id: string
          created_at: string
          created_by_id: string
          cycle_id: string
          id: string
          locked_at: string | null
          communication_preview: string | null
          outcome: Database["rush"]["Enums"]["decision_outcome"]
          reason: string
          released_at: string | null
          status: Database["rush"]["Enums"]["decision_status"]
          supersedes_id: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by_id: string
          cycle_id: string
          id?: string
          locked_at?: string | null
          communication_preview?: string | null
          outcome: Database["rush"]["Enums"]["decision_outcome"]
          reason: string
          released_at?: string | null
          status?: Database["rush"]["Enums"]["decision_status"]
          supersedes_id?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by_id?: string
          cycle_id?: string
          id?: string
          locked_at?: string | null
          communication_preview?: string | null
          outcome?: Database["rush"]["Enums"]["decision_outcome"]
          reason?: string
          released_at?: string | null
          status?: Database["rush"]["Enums"]["decision_status"]
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_assignments: {
        Row: {
          application_id: string
          created_at: string
          evaluator_id: string
          id: string
          round_id: string
          status: Database["rush"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          round_id: string
          status?: Database["rush"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          round_id?: string
          status?: Database["rush"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assignments_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assignments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          assignment_id: string
          created_at: string
          evaluator_id: string
          evidence: string | null
          id: string
          rubric_id: string
          status: Database["rush"]["Enums"]["evaluation_status"]
          submitted_at: string | null
          supersedes_id: string | null
          updated_at: string
          version: number
          voided_at: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          evaluator_id: string
          evidence?: string | null
          id?: string
          rubric_id: string
          status?: Database["rush"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: number
          voided_at?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          evaluator_id?: string
          evidence?: string | null
          id?: string
          rubric_id?: string
          status?: Database["rush"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          checkin_closes_at: string
          checkin_opens_at: string
          checkin_token_digest: string
          created_at: string
          cycle_id: string | null
          ends_at: string | null
          id: string
          kind: string
          location: string | null
          name: string
          starts_at: string
          status: Database["rush"]["Enums"]["event_status"]
          updated_at: string
          visibility: string
        }
        Insert: {
          checkin_closes_at: string
          checkin_opens_at: string
          checkin_token_digest: string
          created_at?: string
          cycle_id?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          name: string
          starts_at: string
          status?: Database["rush"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: string
        }
        Update: {
          checkin_closes_at?: string
          checkin_opens_at?: string
          checkin_token_digest?: string
          created_at?: string
          cycle_id?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          name?: string
          starts_at?: string
          status?: Database["rush"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          cycle_id: string
          id: string
          revoked_at: string | null
          role: Database["rush"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cycle_id: string
          id?: string
          revoked_at?: string | null
          role: Database["rush"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cycle_id?: string
          id?: string
          revoked_at?: string | null
          role?: Database["rush"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mutation_receipts: {
        Row: {
          actor_id: string
          created_at: string
          mutation_key: string
          operation: string
          result: Json
        }
        Insert: {
          actor_id: string
          created_at?: string
          mutation_key: string
          operation: string
          result?: Json
        }
        Update: {
          actor_id?: string
          created_at?: string
          mutation_key?: string
          operation?: string
          result?: Json
        }
        Relationships: []
      }
      pnms: {
        Row: {
          auth_user_id: string | null
          class_year: string | null
          contact: string
          created_at: string
          id: string
          linkedin_url: string | null
          major: string | null
          name: string
          normalized_contact: string
          phone: string | null
          preferred_name: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          class_year?: string | null
          contact: string
          created_at?: string
          id?: string
          linkedin_url?: string | null
          major?: string | null
          name: string
          normalized_contact: string
          phone?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          class_year?: string | null
          contact?: string
          created_at?: string
          id?: string
          linkedin_url?: string | null
          major?: string | null
          name?: string
          normalized_contact?: string
          phone?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          closes_at: string | null
          created_at: string
          cycle_id: string
          id: string
          kind: string
          name: string
          opens_at: string | null
          status: Database["rush"]["Enums"]["round_status"]
          updated_at: string
          weight: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          kind: string
          name: string
          opens_at?: string | null
          status?: Database["rush"]["Enums"]["round_status"]
          updated_at?: string
          weight: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          kind?: string
          name?: string
          opens_at?: string | null
          status?: Database["rush"]["Enums"]["round_status"]
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          description: string
          id: string
          key: string
          name: string
          position: number
          required: boolean
          rubric_id: string
          weight: number
        }
        Insert: {
          description?: string
          id?: string
          key: string
          name: string
          position: number
          required?: boolean
          rubric_id: string
          weight: number
        }
        Update: {
          description?: string
          id?: string
          key?: string
          name?: string
          position?: number
          required?: boolean
          rubric_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string
          frozen_at: string | null
          id: string
          round_id: string
          version: number
        }
        Insert: {
          created_at?: string
          frozen_at?: string | null
          id?: string
          round_id: string
          version: number
        }
        Update: {
          created_at?: string
          frozen_at?: string | null
          id?: string
          round_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rush_cycles: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          name: string
          opens_at: string | null
          status: Database["rush"]["Enums"]["cycle_status"]
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          name: string
          opens_at?: string | null
          status?: Database["rush"]["Enums"]["cycle_status"]
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          name?: string
          opens_at?: string | null
          status?: Database["rush"]["Enums"]["cycle_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_applicant: {
        Args: {
          applicant_contact: string
          applicant_name: string
          target_cycle_id: string
        }
        Returns: string
      }
      applicant_dashboard: {
        Args: never
        Returns: {
          applicant_name: string
          application_id: string
          cycle_name: string
          display_status: string
          has_resume: boolean
          released_at: string
          released_outcome: Database["rush"]["Enums"]["decision_outcome"]
          responses: Json
        }[]
      }
      approve_decision: {
        Args: { target_decision_id: string }
        Returns: {
          approvals: number
          locked: boolean
        }[]
      }
      assign_evaluator: {
        Args: {
          target_application_id: string
          target_cycle_id: string
          target_evaluator_id: string
          target_round_id: string
        }
        Returns: string
      }
      check_in: { Args: { raw_token: string }; Returns: boolean }
      create_cycle: { Args: { cycle_name: string }; Returns: string }
      create_resume_upload: { Args: never; Returns: string }
      intake_schema: { Args: never; Returns: Json }
      create_decision: {
        Args: {
          decision_reason: string
          target_application_id: string
          target_cycle_id: string
          target_outcome: Database["rush"]["Enums"]["decision_outcome"]
        }
        Returns: string
      }
      create_event: {
        Args: {
          closes_at: string
          event_ends_at?: string
          event_kind?: string
          event_location?: string
          event_name: string
          event_starts_at: string
          event_visibility?: string
          opens_at: string
          target_cycle_id: string
        }
        Returns: Json
      }
      public_recruitment: { Args: never; Returns: Json }
      submit_interest: {
        Args: {
          class_year?: string
          email: string
          full_name: string
          how_heard?: string
          uniqname?: string
        }
        Returns: string
      }
      save_application_draft: { Args: { payload: Json }; Returns: string }
      create_event_slot: {
        Args: {
          slot_capacity?: number
          slot_ends_at: string
          slot_starts_at: string
          target_event_id: string
        }
        Returns: string
      }
      rsvp_slot: { Args: { target_slot_id: string }; Returns: string }
      create_case_group: {
        Args: { group_name: string; group_prompt?: string; target_cycle_id: string }
        Returns: string
      }
      assign_case_group: {
        Args: { target_application_id: string; target_group_id: string }
        Returns: undefined
      }
      create_buddy_slot: {
        Args: { slot_ends_at: string; slot_starts_at: string; target_cycle_id: string }
        Returns: string
      }
      book_buddy_slot: { Args: { target_slot_id: string }; Returns: string }
      respond_to_offer: { Args: { accept: boolean }; Returns: undefined }
      set_decision_preview: {
        Args: { preview_text: string; target_decision_id: string }
        Returns: undefined
      }
      submit_process_survey: {
        Args: { score: number; survey_note?: string }
        Returns: undefined
      }
      set_applicant_profile: {
        Args: {
          accessibility_notes?: string
          college?: string
          grad_term?: string
          uniqname?: string
        }
        Returns: undefined
      }
      applicant_schedule: { Args: never; Returns: Json }
      declare_conflict: {
        Args: { conflict_reason: string; target_application_id: string }
        Returns: undefined
      }
      event_for_token: {
        Args: { raw_token: string }
        Returns: {
          id: string
          is_open: boolean
          name: string
          starts_at: string
        }[]
      }
      export_attendance: {
        Args: { target_cycle_id: string }
        Returns: {
          applicant_code: string
          events_attended: number
          name: string
          status: Database["rush"]["Enums"]["application_status"]
        }[]
      }
      grant_membership: {
        Args: {
          target_cycle_id: string
          target_role: Database["rush"]["Enums"]["member_role"]
          target_user_id: string
        }
        Returns: string
      }
      has_cycle_role: {
        Args: {
          allowed_roles: Database["rush"]["Enums"]["member_role"][]
          target_cycle_id: string
        }
        Returns: boolean
      }
      is_applicant: { Args: never; Returns: boolean }
      member_applicants: {
        Args: { target_cycle_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      owns_application: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      release_decision: {
        Args: { target_decision_id: string }
        Returns: undefined
      }
      rotate_event_token: { Args: { target_event_id: string }; Returns: string }
      set_cycle_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["cycle_status"]
          target_cycle_id: string
        }
        Returns: undefined
      }
      set_round_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["round_status"]
          target_round_id: string
        }
        Returns: undefined
      }
      submit_application: {
        Args: {
          answers?: Json
          applicant_contact: string
          applicant_name: string
          class_year?: string
          consent?: boolean
          linkedin_url?: string
          major?: string
          phone?: string
          preferred_name?: string
          resume_storage_path?: string
        }
        Returns: string
      }
      set_application_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["application_status"]
          target_application_id: string
        }
        Returns: undefined
      }
      submit_evaluation: {
        Args: {
          submitted_evidence?: string
          submitted_ratings: Json
          target_assignment_id: string
        }
        Returns: {
          evaluation_id: string
          score: number
        }[]
      }
      verify_full_workflow: {
        Args: { applicant_id: string; owner_id: string; panel_id: string }
        Returns: undefined
      }
    }
    Enums: {
      application_status:
        | "DRAFT"
        | "SUBMITTED"
        | "NEEDS_INFO"
        | "ELIGIBLE"
        | "INVITED"
        | "IN_PROCESS"
        | "FINAL_REVIEW"
        | "OFFERED"
        | "WAITLISTED"
        | "REJECTED"
        | "WITHDRAWN"
      assignment_status:
        | "ASSIGNED"
        | "IN_PROGRESS"
        | "SUBMITTED"
        | "LOCKED"
        | "RECUSED"
        | "MISSED"
      cycle_status:
        | "DRAFT"
        | "OPEN"
        | "IN_PROCESS"
        | "DECISION_LOCK"
        | "CLOSED"
        | "ARCHIVED"
      decision_outcome: "OFFER" | "WAITLIST" | "REJECT" | "PROCEDURAL_REVIEW"
      decision_status:
        | "PENDING"
        | "APPROVED"
        | "LOCKED"
        | "RELEASED"
        | "SUPERSEDED"
      evaluation_status:
        | "DRAFT"
        | "SUBMITTED"
        | "LOCKED"
        | "SUPERSEDED"
        | "VOID"
      event_status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED"
      member_role: "MEMBER" | "BOARD" | "PANEL" | "OWNER"
      round_status:
        | "DRAFT"
        | "PUBLISHED"
        | "ACTIVE"
        | "FROZEN"
        | "FINALIZED"
        | "ARCHIVED"
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
  rush: {
    Enums: {
      application_status: [
        "DRAFT",
        "SUBMITTED",
        "NEEDS_INFO",
        "ELIGIBLE",
        "INVITED",
        "IN_PROCESS",
        "FINAL_REVIEW",
        "OFFERED",
        "WAITLISTED",
        "REJECTED",
        "WITHDRAWN",
      ],
      assignment_status: [
        "ASSIGNED",
        "IN_PROGRESS",
        "SUBMITTED",
        "LOCKED",
        "RECUSED",
        "MISSED",
      ],
      cycle_status: [
        "DRAFT",
        "OPEN",
        "IN_PROCESS",
        "DECISION_LOCK",
        "CLOSED",
        "ARCHIVED",
      ],
      decision_outcome: ["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"],
      decision_status: [
        "PENDING",
        "APPROVED",
        "LOCKED",
        "RELEASED",
        "SUPERSEDED",
      ],
      evaluation_status: ["DRAFT", "SUBMITTED", "LOCKED", "SUPERSEDED", "VOID"],
      event_status: ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"],
      member_role: ["MEMBER", "BOARD", "PANEL", "OWNER"],
      round_status: [
        "DRAFT",
        "PUBLISHED",
        "ACTIVE",
        "FROZEN",
        "FINALIZED",
        "ARCHIVED",
      ],
    },
  },
} as const
