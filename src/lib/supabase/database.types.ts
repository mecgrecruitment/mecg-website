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
      application_documents: {
        Row: {
          application_id: string | null
          created_at: string
          cycle_id: string
          declared_size: number
          deleted_at: string | null
          id: string
          kind: string
          object_path: string
          original_filename: string
          owner_user_id: string
          page_count: number | null
          ready_at: string | null
          rejection_reason: string | null
          sha256: string | null
          status: string
          superseded_at: string | null
          verified_size: number | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          cycle_id: string
          declared_size: number
          deleted_at?: string | null
          id?: string
          kind?: string
          object_path: string
          original_filename: string
          owner_user_id: string
          page_count?: number | null
          ready_at?: string | null
          rejection_reason?: string | null
          sha256?: string | null
          status?: string
          superseded_at?: string | null
          verified_size?: number | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          cycle_id?: string
          declared_size?: number
          deleted_at?: string | null
          id?: string
          kind?: string
          object_path?: string
          original_filename?: string
          owner_user_id?: string
          page_count?: number | null
          ready_at?: string | null
          rejection_reason?: string | null
          sha256?: string | null
          status?: string
          superseded_at?: string | null
          verified_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_portal_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "application_questions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
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
      applications: {
        Row: {
          created_at: string
          cycle_id: string
          draft_payload: Json | null
          id: string
          offer_responded_at: string | null
          offer_response: string | null
          pnm_id: string
          process_survey_submitted_at: string | null
          resume_storage_path: string | null
          status: Database["rush"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          draft_payload?: Json | null
          id?: string
          offer_responded_at?: string | null
          offer_response?: string | null
          pnm_id: string
          process_survey_submitted_at?: string | null
          resume_storage_path?: string | null
          status?: Database["rush"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          draft_payload?: Json | null
          id?: string
          offer_responded_at?: string | null
          offer_response?: string | null
          pnm_id?: string
          process_survey_submitted_at?: string | null
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
        ]
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
      buddy_bookings: {
        Row: {
          application_id: string
          created_at: string
          id: string
          slot_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          slot_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_bookings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "buddy_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_slots: {
        Row: {
          created_at: string
          cycle_id: string
          ends_at: string
          id: string
          member_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          ends_at: string
          id?: string
          member_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          ends_at?: string
          id?: string
          member_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_slots_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_slots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_group_members: {
        Row: {
          application_id: string
          group_id: string
        }
        Insert: {
          application_id: string
          group_id: string
        }
        Update: {
          application_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_group_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "case_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      case_groups: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          name: string
          prompt: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          name: string
          prompt?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          name?: string
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_groups_cycle_id_fkey"
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
          communication_preview: string | null
          created_at: string
          created_by_id: string
          cycle_id: string
          id: string
          locked_at: string | null
          outcome: Database["rush"]["Enums"]["decision_outcome"]
          reason: string
          released_at: string | null
          status: Database["rush"]["Enums"]["decision_status"]
          supersedes_id: string | null
        }
        Insert: {
          application_id: string
          communication_preview?: string | null
          created_at?: string
          created_by_id: string
          cycle_id: string
          id?: string
          locked_at?: string | null
          outcome: Database["rush"]["Enums"]["decision_outcome"]
          reason: string
          released_at?: string | null
          status?: Database["rush"]["Enums"]["decision_status"]
          supersedes_id?: string | null
        }
        Update: {
          application_id?: string
          communication_preview?: string | null
          created_at?: string
          created_by_id?: string
          cycle_id?: string
          id?: string
          locked_at?: string | null
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
      event_impressions: {
        Row: {
          application_id: string
          created_at: string
          event_id: string
          id: string
          member_id: string
          note: string
          score: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_id: string
          id?: string
          member_id: string
          note?: string
          score: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string
          note?: string
          score?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_impressions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impressions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slots: {
        Row: {
          capacity: number
          ends_at: string
          event_id: string
          id: string
          starts_at: string
        }
        Insert: {
          capacity?: number
          ends_at: string
          event_id: string
          id?: string
          starts_at: string
        }
        Update: {
          capacity?: number
          ends_at?: string
          event_id?: string
          id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          member_grading: boolean
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
          member_grading?: boolean
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
          member_grading?: boolean
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
      interest_signups: {
        Row: {
          class_year: string | null
          created_at: string
          cycle_id: string
          email: string
          how_heard: string | null
          id: string
          name: string
          uniqname: string | null
        }
        Insert: {
          class_year?: string | null
          created_at?: string
          cycle_id: string
          email: string
          how_heard?: string | null
          id?: string
          name: string
          uniqname?: string | null
        }
        Update: {
          class_year?: string | null
          created_at?: string
          cycle_id?: string
          email?: string
          how_heard?: string | null
          id?: string
          name?: string
          uniqname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interest_signups_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_checkins: {
        Row: {
          checked_in_at: string
          event_id: string
          id: string
          member_id: string
        }
        Insert: {
          checked_in_at?: string
          event_id: string
          id?: string
          member_id: string
        }
        Update: {
          checked_in_at?: string
          event_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          accessibility_notes: string | null
          auth_user_id: string | null
          class_year: string | null
          college: string | null
          contact: string
          created_at: string
          grad_term: string | null
          id: string
          linkedin_url: string | null
          major: string | null
          name: string
          normalized_contact: string
          phone: string | null
          preferred_name: string | null
          uniqname: string | null
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          auth_user_id?: string | null
          class_year?: string | null
          college?: string | null
          contact: string
          created_at?: string
          grad_term?: string | null
          id?: string
          linkedin_url?: string | null
          major?: string | null
          name: string
          normalized_contact: string
          phone?: string | null
          preferred_name?: string | null
          uniqname?: string | null
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          auth_user_id?: string | null
          class_year?: string | null
          college?: string | null
          contact?: string
          created_at?: string
          grad_term?: string | null
          id?: string
          linkedin_url?: string | null
          major?: string | null
          name?: string
          normalized_contact?: string
          phone?: string | null
          preferred_name?: string | null
          uniqname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      process_surveys: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          note: string | null
          rating: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          note?: string | null
          rating: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          note?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_surveys_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          application_id: string | null
          created_at: string
          cycle_id: string | null
          delivered: boolean
          id: string
          kind: string
          recipient: string
          subject: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          cycle_id?: string | null
          delivered?: boolean
          id?: string
          kind: string
          recipient: string
          subject: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          cycle_id?: string | null
          delivered?: boolean
          id?: string
          kind?: string
          recipient?: string
          subject?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          display_name: string
          grad_term: string | null
          id: string
          major: string | null
          position_title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          display_name: string
          grad_term?: string | null
          id: string
          major?: string | null
          position_title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          display_name?: string
          grad_term?: string | null
          id?: string
          major?: string | null
          position_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
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
      screening_assignments: {
        Row: {
          created_at: string
          id: string
          packet_id: string
          reviewer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          packet_id: string
          reviewer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          packet_id?: string
          reviewer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_assignments_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "screening_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_assignments_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_batches: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          frozen_at: string | null
          id: string
          published_at: string | null
          reviews_per_application: number
          rubric_id: string
          seed_commitment: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          frozen_at?: string | null
          id?: string
          published_at?: string | null
          reviews_per_application?: number
          rubric_id: string
          seed_commitment?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          frozen_at?: string | null
          id?: string
          published_at?: string | null
          reviews_per_application?: number
          rubric_id?: string
          seed_commitment?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_batches_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: true
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_batches_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_distribution_runs: {
        Row: {
          assignment_count: number
          batch_id: string
          created_at: string
          created_by: string
          id: string
          seed_commitment: string
          summary: Json
        }
        Insert: {
          assignment_count: number
          batch_id: string
          created_at?: string
          created_by: string
          id?: string
          seed_commitment: string
          summary: Json
        }
        Update: {
          assignment_count?: number
          batch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          seed_commitment?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "screening_distribution_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "screening_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_distribution_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_packets: {
        Row: {
          application_id: string
          approved_at: string | null
          approved_by: string | null
          batch_id: string
          candidate_code: string
          content: Json
          content_hash: string
          created_at: string
          id: string
          redaction_status: string
        }
        Insert: {
          application_id: string
          approved_at?: string | null
          approved_by?: string | null
          batch_id: string
          candidate_code: string
          content: Json
          content_hash: string
          created_at?: string
          id?: string
          redaction_status?: string
        }
        Update: {
          application_id?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string
          candidate_code?: string
          content?: Json
          content_hash?: string
          created_at?: string
          id?: string
          redaction_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_packets_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_packets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_packets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "screening_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_ratings: {
        Row: {
          criterion_id: string
          note: string | null
          review_id: string
          score: number
        }
        Insert: {
          criterion_id: string
          note?: string | null
          review_id: string
          score: number
        }
        Update: {
          criterion_id?: string
          note?: string | null
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_ratings_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "screening_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_reviewers: {
        Row: {
          active: boolean
          batch_id: string
          capacity: number
          reviewer_id: string
        }
        Insert: {
          active?: boolean
          batch_id: string
          capacity?: number
          reviewer_id: string
        }
        Update: {
          active?: boolean
          batch_id?: string
          capacity?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_reviewers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "screening_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_reviewers_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_reviews: {
        Row: {
          assignment_id: string
          evidence: string
          id: string
          recommendation: string
          reviewer_id: string
          score: number
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          evidence: string
          id?: string
          recommendation: string
          reviewer_id: string
          score: number
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          evidence?: string
          id?: string
          recommendation?: string
          reviewer_id?: string
          score?: number
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "screening_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_rsvps: {
        Row: {
          application_id: string
          created_at: string
          id: string
          slot_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          slot_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_rsvps_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_rsvps_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "event_slots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actor_can_read_colleague_profile: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      actor_has_application_conflict: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      actor_has_application_in_cycle: {
        Args: { target_cycle_id: string }
        Returns: boolean
      }
      actor_is_assigned_evaluator: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      actor_manages_application_cycle: {
        Args: { target_application_id: string }
        Returns: boolean
      }
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
          offer_response: string
          released_at: string
          released_outcome: Database["rush"]["Enums"]["decision_outcome"]
          responses: Json
          survey_submitted: boolean
        }[]
      }
      applicant_schedule: { Args: never; Returns: Json }
      application_portal_allows: { Args: { actor: string }; Returns: boolean }
      approve_decision: {
        Args: { target_decision_id: string }
        Returns: {
          approvals: number
          locked: boolean
        }[]
      }
      approve_screening_packet: {
        Args: { approved: boolean; target_packet_id: string }
        Returns: undefined
      }
      assign_case_group: {
        Args: { target_application_id: string; target_group_id: string }
        Returns: undefined
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
      authorize_resume_access: {
        Args: { target_application_id: string }
        Returns: string
      }
      begin_resume_upload: {
        Args: { upload_filename: string; upload_size: number }
        Returns: Json
      }
      board_can_view_resume: { Args: { target_path: string }; Returns: boolean }
      book_buddy_slot: { Args: { target_slot_id: string }; Returns: string }
      can_start_application: { Args: never; Returns: boolean }
      clone_cycle: {
        Args: { source_cycle_id: string; cycle_name: string }
        Returns: string
      }
      cycle_directory: { Args: { target_cycle_id: string }; Returns: Json }
      cycle_application_questions: { Args: { target_cycle_id: string }; Returns: Json }
      cycle_rubrics: { Args: { target_cycle_id: string }; Returns: Json }
      check_in: { Args: { raw_token: string }; Returns: boolean }
      check_rate_limit: { Args: { p_bucket: string }; Returns: boolean }
      commit_screening_assignments: {
        Args: {
          commitment: string
          proposal: Json
          summary: Json
          target_batch_id: string
        }
        Returns: number
      }
      create_buddy_slot: {
        Args: {
          slot_ends_at: string
          slot_starts_at: string
          target_cycle_id: string
        }
        Returns: string
      }
      create_case_group: {
        Args: {
          group_name: string
          group_prompt?: string
          target_cycle_id: string
        }
        Returns: string
      }
      create_cycle: { Args: { cycle_name: string }; Returns: string }
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
      create_event_slot: {
        Args: {
          slot_capacity?: number
          slot_ends_at: string
          slot_starts_at: string
          target_event_id: string
        }
        Returns: string
      }
      create_resume_upload: { Args: never; Returns: string }
      create_screening_batch: {
        Args: { reviewer_ids: string[]; target_cycle_id: string }
        Returns: string
      }
      declare_conflict: {
        Args: { conflict_reason: string; target_application_id: string }
        Returns: undefined
      }
      delete_case_group: {
        Args: { target_group_id: string }
        Returns: undefined
      }
      event_cycle_id: { Args: { target_event_id: string }; Returns: string }
      event_for_token: {
        Args: { raw_token: string }
        Returns: {
          id: string
          is_open: boolean
          name: string
          starts_at: string
        }[]
      }
      event_grading_roster: {
        Args: { target_event_id: string }
        Returns: {
          applicant_name: string
          application_id: string
          impression_id: string
          note: string
          score: number
          tags: string[]
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
      finalize_resume_upload: {
        Args: {
          actual_size: number
          content_sha256: string
          detected_page_count: number
          target_document_id: string
        }
        Returns: Json
      }
      freeze_screening_batch: {
        Args: { target_batch_id: string }
        Returns: undefined
      }
      grant_membership: {
        Args: {
          target_cycle_id: string
          target_role: Database["rush"]["Enums"]["member_role"]
          target_user_id: string
        }
        Returns: string
      }
      has_cycle_capability: {
        Args: { capability: string; target_cycle_id: string }
        Returns: boolean
      }
      has_cycle_role: {
        Args: {
          allowed_roles: Database["rush"]["Enums"]["member_role"][]
          target_cycle_id: string
        }
        Returns: boolean
      }
      intake_schema: { Args: never; Returns: Json }
      is_active_screening_reviewer: {
        Args: { target_cycle_id: string }
        Returns: boolean
      }
      is_applicant: { Args: never; Returns: boolean }
      is_eligible_screening_reviewer: {
        Args: { target_cycle_id: string; target_user_id: string }
        Returns: boolean
      }
      member_applicants: {
        Args: { target_cycle_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      my_grading_events: {
        Args: never
        Returns: {
          event_id: string
          event_name: string
          grading_open: boolean
          starts_at: string
        }[]
      }
      my_ready_resume: { Args: { target_path?: string }; Returns: Json }
      my_screening_queue: {
        Args: { target_cycle_id: string }
        Returns: {
          assignment_id: string
          assignment_status: string
          candidate_code: string
        }[]
      }
      owns_application: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      pending_resume_upload: {
        Args: { target_document_id: string }
        Returns: Json
      }
      prune_rate_limits: { Args: never; Returns: undefined }
      public_recruitment: { Args: never; Returns: Json }
      recuse_screening_assignment: {
        Args: { recusal_reason: string; target_assignment_id: string }
        Returns: undefined
      }
      reject_resume_upload: {
        Args: { rejection: string; target_document_id: string }
        Returns: string
      }
      release_decision: {
        Args: { target_decision_id: string }
        Returns: undefined
      }
      respond_to_offer: {
        Args: { accept: boolean; target_application_id: string }
        Returns: undefined
      }
      resume_upload_locked: { Args: { target_path: string }; Returns: boolean }
      retire_pending_resume_upload: {
        Args: { document_id: string }
        Returns: boolean
      }
      rotate_event_token: { Args: { target_event_id: string }; Returns: string }
      rsvp_slot: { Args: { target_slot_id: string }; Returns: string }
      save_application_draft: { Args: { payload: Json }; Returns: string }
      screening_admin_overview: {
        Args: { target_cycle_id: string }
        Returns: Json
      }
      screening_assignment_detail: {
        Args: { target_assignment_id: string }
        Returns: Json
      }
      screening_assignment_inputs: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      seed_cycle_questions: {
        Args: { target_cycle_id: string }
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
      set_application_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["application_status"]
          target_application_id: string
        }
        Returns: undefined
      }
      log_message: {
        Args: {
          target_application_id: string
          message_kind: string
          message_recipient: string
          message_subject: string
          was_delivered: boolean
        }
        Returns: string
      }
      my_member_record: { Args: { target_cycle_id: string }; Returns: Json }
      release_ready_decisions: { Args: { target_cycle_id: string }; Returns: Json }
      set_application_questions: {
        Args: { target_cycle_id: string; questions: Json }
        Returns: number
      }
      update_my_profile: {
        Args: {
          display_name: string
          grad_term: string
          major: string
          position_title: string
          bio: string
        }
        Returns: boolean
      }
      withdraw_application: { Args: { target_application_id: string }; Returns: boolean }
      set_rubric_criteria: {
        Args: { target_round_id: string; criteria: Json }
        Returns: string
      }
      set_cycle_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["cycle_status"]
          target_cycle_id: string
        }
        Returns: undefined
      }
      set_decision_preview: {
        Args: { preview_text: string; target_decision_id: string }
        Returns: undefined
      }
      set_event_grading: {
        Args: { enabled: boolean; target_event_id: string }
        Returns: undefined
      }
      set_membership_role: {
        Args: {
          target_cycle_id: string
          target_role: Database["rush"]["Enums"]["member_role"]
          target_user_id: string
        }
        Returns: string
      }
      set_round_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["round_status"]
          target_round_id: string
        }
        Returns: undefined
      }
      stale_pending_resume_uploads: {
        Args: { older_than?: string }
        Returns: {
          document_id: string
          object_path: string
        }[]
      }
      submit_application: {
        Args: {
          accessibility_notes?: string
          answers?: Json
          applicant_contact: string
          applicant_name: string
          class_year?: string
          college?: string
          consent?: boolean
          grad_term?: string
          linkedin_url?: string
          major?: string
          phone?: string
          preferred_name?: string
          resume_storage_path?: string
          uniqname?: string
        }
        Returns: Json
      }
      submit_application_self_test: {
        Args: { applicant_contact: string; applicant_name: string }
        Returns: string
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
      submit_event_impression: {
        Args: {
          impression_note: string
          impression_score: number
          impression_tags: string[]
          target_application_id: string
          target_event_id: string
        }
        Returns: string
      }
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
      submit_process_survey: {
        Args: {
          score: number
          survey_note?: string
          target_application_id: string
        }
        Returns: undefined
      }
      submit_screening_review: {
        Args: {
          ratings: Json
          review_evidence: string
          review_recommendation: string
          target_assignment_id: string
        }
        Returns: number
      }
      unassign_case_group: {
        Args: { target_application_id: string; target_group_id: string }
        Returns: undefined
      }
      update_screening_packet_content: {
        Args: { revised_content: Json; target_packet_id: string }
        Returns: undefined
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
      member_role:
        | "MEMBER"
        | "BOARD"
        | "PANEL"
        | "OWNER"
        | "RECRUITMENT_COMMITTEE"
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
      member_role: [
        "MEMBER",
        "BOARD",
        "PANEL",
        "OWNER",
        "RECRUITMENT_COMMITTEE",
      ],
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
