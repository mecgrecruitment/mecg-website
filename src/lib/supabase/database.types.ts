export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          {
            foreignKeyName: "application_documents_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          word_limit: number | null
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
          word_limit?: number | null
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
          word_limit?: number | null
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
          question_word_limit: number | null
          response_text: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          question_key: string
          question_text: string
          question_word_limit?: number | null
          response_text: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          question_key?: string
          question_text?: string
          question_word_limit?: number | null
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
          headshot_storage_path: string | null
          id: string
          offer_expires_at: string | null
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
          headshot_storage_path?: string | null
          id?: string
          offer_expires_at?: string | null
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
          headshot_storage_path?: string | null
          id?: string
          offer_expires_at?: string | null
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
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_identities: {
        Row: {
          app_user_id: string
          created_at: string
          disabled_at: string | null
          issuer: string
          subject: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          disabled_at?: string | null
          issuer: string
          subject: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          disabled_at?: string | null
          issuer?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_identities_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_migration_ledger: {
        Row: {
          expected_email: string
          linked_at: string | null
          prepared_at: string
          provider_subject: string | null
          source_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          expected_email: string
          linked_at?: string | null
          prepared_at?: string
          provider_subject?: string | null
          source_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          expected_email?: string
          linked_at?: string | null
          prepared_at?: string
          provider_subject?: string | null
          source_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_migration_ledger_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clerk_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          issuer: string
          occurred_at: string
          outcome: string
          processed_at: string
          subject: string
        }
        Insert: {
          event_id: string
          event_type: string
          issuer: string
          occurred_at: string
          outcome: string
          processed_at?: string
          subject: string
        }
        Update: {
          event_id?: string
          event_type?: string
          issuer?: string
          occurred_at?: string
          outcome?: string
          processed_at?: string
          subject?: string
        }
        Relationships: []
      }
      clerk_webhook_identity_state: {
        Row: {
          issuer: string
          last_event_at: string
          last_event_id: string
          last_event_type: string
          subject: string
          updated_at: string
        }
        Insert: {
          issuer: string
          last_event_at: string
          last_event_id: string
          last_event_type: string
          subject: string
          updated_at?: string
        }
        Update: {
          issuer?: string
          last_event_at?: string
          last_event_id?: string
          last_event_type?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clerk_webhook_identity_state_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "clerk_webhook_events"
            referencedColumns: ["event_id"]
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
          checked_in_by: string | null
          checked_in_at: string
          checkin_method: string
          event_id: string
          id: string
          pnm_id: string
          reason_code: string | null
        }
        Insert: {
          checked_in_by?: string | null
          checked_in_at?: string
          checkin_method?: string
          event_id: string
          id?: string
          pnm_id: string
          reason_code?: string | null
        }
        Update: {
          checked_in_by?: string | null
          checked_in_at?: string
          checkin_method?: string
          event_id?: string
          id?: string
          pnm_id?: string
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          hash_derived: boolean
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
          hash_derived?: boolean
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
          hash_derived?: boolean
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
          {
            foreignKeyName: "event_impressions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      hash_votes: {
        Row: {
          application_id: string
          created_at: string
          cycle_id: string
          id: string
          note: string
          stage: string
          updated_at: string
          vote: string
          voter_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          cycle_id: string
          id?: string
          note?: string
          stage?: string
          updated_at?: string
          vote: string
          voter_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          note?: string
          stage?: string
          updated_at?: string
          vote?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hash_votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_votes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "member_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
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
        Relationships: [
          {
            foreignKeyName: "mutation_receipts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          application_id: string
          attempt_count: number
          created_at: string
          cycle_id: string
          decision_id: string | null
          event_id: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error_category: string | null
          max_attempts: number
          next_attempt_at: string
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template_key: string
          template_version: number
        }
        Insert: {
          application_id: string
          attempt_count?: number
          created_at?: string
          cycle_id: string
          decision_id?: string | null
          event_id?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          last_error_category?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template_key: string
          template_version?: number
        }
        Update: {
          application_id?: string
          attempt_count?: number
          created_at?: string
          cycle_id?: string
          decision_id?: string | null
          event_id?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          last_error_category?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pnms_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          primary_email: string | null
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
          primary_email?: string | null
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
          primary_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          project_id: string
          role_label: string
          user_id: string
        }
        Insert: {
          project_id: string
          role_label?: string
          user_id: string
        }
        Update: {
          project_id?: string
          role_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_label: string
          constraints: Json
          context: string
          created_at: string
          decision: string
          deliverables: Json
          handoff: string
          id: string
          industry: string
          is_public: boolean
          member_work: Json
          methods: Json
          semester: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          client_label?: string
          constraints?: Json
          context?: string
          created_at?: string
          decision?: string
          deliverables?: Json
          handoff?: string
          id?: string
          industry?: string
          is_public?: boolean
          member_work?: Json
          methods?: Json
          semester?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          client_label?: string
          constraints?: Json
          context?: string
          created_at?: string
          decision?: string
          deliverables?: Json
          handoff?: string
          id?: string
          industry?: string
          is_public?: boolean
          member_work?: Json
          methods?: Json
          semester?: string
          slug?: string
          sort_order?: number
          title?: string
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
      referrals: {
        Row: {
          created_at: string
          cycle_id: string
          email: string
          id: string
          name: string
          normalized_email: string
          reason: string
          referrer_id: string
          status: string
          updated_at: string
          year_major: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          email: string
          id?: string
          name: string
          normalized_email: string
          reason: string
          referrer_id: string
          status?: string
          updated_at?: string
          year_major?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          email?: string
          id?: string
          name?: string
          normalized_email?: string
          reason?: string
          referrer_id?: string
          status?: string
          updated_at?: string
          year_major?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rush_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders_sent: {
        Row: {
          id: string
          kind: string
          recipient_id: string
          sent_at: string
          subject_id: string
        }
        Insert: {
          id?: string
          kind: string
          recipient_id: string
          sent_at?: string
          subject_id: string
        }
        Update: {
          id?: string
          kind?: string
          recipient_id?: string
          sent_at?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_sent_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          minimum_observed_criteria: number
          round_id: string
          version: number
        }
        Insert: {
          created_at?: string
          frozen_at?: string | null
          id?: string
          minimum_observed_criteria?: number
          round_id: string
          version: number
        }
        Update: {
          created_at?: string
          frozen_at?: string | null
          id?: string
          minimum_observed_criteria?: number
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
          hash_quorum: number
          hash_stage: string | null
          id: string
          name: string
          opens_at: string | null
          status: Database["rush"]["Enums"]["cycle_status"]
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          hash_quorum?: number
          hash_stage?: string | null
          id?: string
          name: string
          opens_at?: string | null
          status?: Database["rush"]["Enums"]["cycle_status"]
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          hash_quorum?: number
          hash_stage?: string | null
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
      speed_dating_pair_claims: {
        Row: {
          claimed_at: string
          evaluator_id: string
          pair_id: string
          submitted_at: string | null
        }
        Insert: {
          claimed_at?: string
          evaluator_id: string
          pair_id: string
          submitted_at?: string | null
        }
        Update: {
          claimed_at?: string
          evaluator_id?: string
          pair_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speed_dating_pair_claims_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speed_dating_pair_claims_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "speed_dating_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_dating_pair_members: {
        Row: {
          application_id: string
          pair_id: string
          position: number
          round_id: string
        }
        Insert: {
          application_id: string
          pair_id: string
          position: number
          round_id: string
        }
        Update: {
          application_id?: string
          pair_id?: string
          position?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_dating_pair_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speed_dating_pair_members_pair_id_round_id_fkey"
            columns: ["pair_id", "round_id"]
            isOneToOne: false
            referencedRelation: "speed_dating_pairs"
            referencedColumns: ["id", "round_id"]
          },
        ]
      }
      speed_dating_pairs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          published_at: string | null
          round_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label: string
          published_at?: string | null
          round_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          published_at?: string | null
          round_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_dating_pairs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speed_dating_pairs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
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
      actor_id: { Args: never; Returns: string }
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
      anonymize_archived_applicants: { Args: never; Returns: number }
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
      applicant_prior_cycles: {
        Args: { target_application_id: string }
        Returns: Json
      }
      applicant_schedule: { Args: never; Returns: Json }
      application_portal_allows: { Args: { actor: string }; Returns: boolean }
      apply_hash_result: {
        Args: { target_application_id: string }
        Returns: string
      }
      apply_stage_hash_result: {
        Args: { target_application_id: string }
        Returns: string
      }
      apply_stage_hash_results: {
        Args: { target_cycle_id: string }
        Returns: number
      }
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
      attach_headshot: { Args: { target_path: string }; Returns: Json }
      attach_ready_resume: { Args: never; Returns: string }
      authorize_headshot_access: {
        Args: { target_application_id: string }
        Returns: string
      }
      authorize_resume_access: {
        Args: { target_application_id: string }
        Returns: string
      }
      begin_headshot_upload: { Args: { upload_extension?: string }; Returns: Json }
      begin_resume_upload: {
        Args: { upload_filename: string; upload_size: number }
        Returns: Json
      }
      board_can_view_resume: { Args: { target_path: string }; Returns: boolean }
      book_buddy_slot: { Args: { target_slot_id: string }; Returns: string }
      can_start_application: { Args: never; Returns: boolean }
      cancel_event: {
        Args: { cancellation_reason: string; target_event_id: string }
        Returns: undefined
      }
      cast_hash_vote: {
        Args: { target_application_id: string; vote_note: string; vote_value: string }
        Returns: boolean
      }
      check_in: { Args: { raw_token: string }; Returns: boolean }
      staff_assisted_check_in: {
        Args: {
          applicant_identifier: string
          reason_code: string
          target_event_id: string
        }
        Returns: Json
      }
      check_rate_limit: { Args: { p_bucket: string }; Returns: boolean }
      claim_notification: {
        Args: { target_notification_id: string }
        Returns: Json
      }
      claim_reminder: {
        Args: {
          recipient_id: string
          reminder_kind: string
          subject_id: string
        }
        Returns: boolean
      }
      discard_speed_dating_group: {
        Args: { target_pair_id: string }
        Returns: Json
      }
      clone_cycle: {
        Args: { cycle_name: string; source_cycle_id: string }
        Returns: string
      }
      commit_screening_assignments: {
        Args: {
          commitment: string
          proposal: Json
          summary: Json
          target_batch_id: string
        }
        Returns: number
      }
      complete_notification: {
        Args: {
          error_category?: string
          provider_id?: string
          should_retry?: boolean
          target_notification_id: string
          was_delivered: boolean
        }
        Returns: string
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
      cycle_application_questions: {
        Args: { target_cycle_id: string }
        Returns: Json
      }
      cycle_directory: { Args: { target_cycle_id: string }; Returns: Json }
      cycle_rubrics: { Args: { target_cycle_id: string }; Returns: Json }
      deactivate_cycle_membership: {
        Args: {
          revocation_reason: string
          target_cycle_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      decision_notification_id: {
        Args: { target_decision_id: string }
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
      disable_external_identity: {
        Args: { identity_issuer: string; identity_subject: string }
        Returns: boolean
      }
      ensure_external_identity: {
        Args: {
          existing_app_user_id?: string
          identity_display_name: string
          identity_email: string
          identity_issuer: string
          identity_subject: string
        }
        Returns: string
      }
      reconcile_clerk_webhook: {
        Args: {
          existing_app_user_id?: string | null
          identity_display_name?: string | null
          identity_email?: string | null
          identity_issuer: string
          identity_subject: string
          webhook_event_id: string
          webhook_event_type: string
          webhook_occurred_at: string
        }
        Returns: string
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
      form_case_groups: {
        Args: { group_size?: number; target_cycle_id: string }
        Returns: number
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
      hash_tally: {
        Args: { target_cycle_id: string }
        Returns: {
          application_id: string
          no_count: number
          outcome: string
          quorum: number
          total_votes: number
          unsure_count: number
          yes_count: number
        }[]
      }
      hash_ballot: {
        Args: { target_cycle_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      hash_notes: {
        Args: { target_cycle_id: string }
        Returns: {
          application_id: string
          note: string
        }[]
      }
      is_active_screening_reviewer: {
        Args: { target_cycle_id: string }
        Returns: boolean
      }
      is_applicant: { Args: never; Returns: boolean }
      is_eligible_screening_reviewer: {
        Args: { target_cycle_id: string; target_user_id: string }
        Returns: boolean
      }
      log_message: {
        Args: {
          message_kind: string
          message_recipient: string
          message_subject: string
          target_application_id: string
          was_delivered: boolean
        }
        Returns: string
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
      my_application_submission_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      my_headshot: { Args: Record<PropertyKey, never>; Returns: boolean }
      my_member_record: { Args: { target_cycle_id: string }; Returns: Json }
      my_offer_deadlines: { Args: never; Returns: Json }
      my_ready_resume: { Args: { target_path?: string }; Returns: Json }
      my_screening_queue: {
        Args: { target_cycle_id: string }
        Returns: {
          assignment_id: string
          assignment_status: string
          candidate_code: string
        }[]
      }
      my_speed_dating_pairs: {
        Args: { target_round_id: string }
        Returns: Json
      }
      my_speed_dating_roster: {
        Args: { target_round_id: string }
        Returns: Json
      }
      owns_application: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      pending_reminders: { Args: never; Returns: Json }
      pending_resume_upload: {
        Args: { target_document_id: string }
        Returns: Json
      }
      prepare_auth_migration: {
        Args: { expected_email: string; source_user_id: string }
        Returns: boolean
      }
      prune_rate_limits: { Args: never; Returns: undefined }
      public_projects: { Args: never; Returns: Json }
      public_recruitment: { Args: never; Returns: Json }
      reassign_evaluator: {
        Args: { replacement_evaluator_id: string; target_assignment_id: string }
        Returns: string
      }
      rate_speed_dating_applicant: {
        Args: {
          note: string
          score: number
          target_application_id: string
          target_round_id: string
          target_session: number
        }
        Returns: Json
      }
      start_speed_dating_group: {
        Args: {
          target_application_ids: string[]
          target_round_id: string
          target_session?: number
          target_table?: number
        }
        Returns: Json
      }
      submit_speed_dating_pair: {
        Args: { submitted_members: Json; target_pair_id: string }
        Returns: Json
      }
      speed_dating_pair_setup: {
        Args: { target_round_id: string }
        Returns: Json
      }
      speed_dating_results: {
        Args: { target_round_id: string }
        Returns: Json
      }
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
      release_ready_decisions: {
        Args: { target_cycle_id: string }
        Returns: Json
      }
      release_reminder: {
        Args: {
          recipient_id: string
          reminder_kind: string
          subject_id: string
        }
        Returns: undefined
      }
      respond_to_offer: {
        Args: { accept: boolean; target_application_id: string }
        Returns: undefined
      }
      restore_cycle_membership: {
        Args: { target_cycle_id: string; target_user_id: string }
        Returns: boolean
      }
      retire_pending_resume_upload: {
        Args: { document_id: string }
        Returns: boolean
      }
      retry_notification: {
        Args: { target_notification_id: string }
        Returns: undefined
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
      set_application_questions: {
        Args: { questions: Json; target_cycle_id: string }
        Returns: number
      }
      set_application_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["application_status"]
          target_application_id: string
        }
        Returns: undefined
      }
      open_hash_stage: {
        Args: { quorum: number; stage: string; target_cycle_id: string }
        Returns: undefined
      }
      close_hash_stage: {
        Args: { target_cycle_id: string }
        Returns: undefined
      }
      set_cycle_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["cycle_status"]
          target_cycle_id: string
        }
        Returns: undefined
      }
      set_cycle_application_window: {
        Args: {
          application_closes_at: string
          application_opens_at: string
          target_cycle_id: string
        }
        Returns: Json
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
      set_offer_deadline: {
        Args: { expires_at: string; target_application_id: string }
        Returns: boolean
      }
      set_project_staffing: {
        Args: { members: Json; target_project_id: string }
        Returns: number
      }
      set_referral_status: {
        Args: { next_status: string; target_referral_id: string }
        Returns: boolean
      }
      set_round_status: {
        Args: {
          next_status: Database["rush"]["Enums"]["round_status"]
          target_round_id: string
        }
        Returns: undefined
      }
      set_rubric_criteria: {
        Args: { criteria: Json; target_round_id: string }
        Returns: string
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
      submit_application_reliable: {
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
      submit_referral: {
        Args: {
          referral_email: string
          referral_name: string
          referral_reason: string
          referral_year_major: string
          target_cycle_id: string
        }
        Returns: string
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
      unassign_evaluator: {
        Args: { target_assignment_id: string }
        Returns: boolean
      }
      update_event: {
        Args: {
          closes_at: string
          event_ends_at: string
          event_kind: string
          event_location: string
          event_name: string
          event_starts_at: string
          event_visibility: string
          opens_at: string
          target_event_id: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          bio: string
          display_name: string
          grad_term: string
          major: string
          position_title: string
        }
        Returns: boolean
      }
      update_screening_packet_content: {
        Args: { revised_content: Json; target_packet_id: string }
        Returns: undefined
      }
      upsert_project: { Args: { project: Json }; Returns: string }
      verify_full_workflow: {
        Args: { applicant_id: string; owner_id: string; panel_id: string }
        Returns: undefined
      }
      withdraw_application: {
        Args: { target_application_id: string }
        Returns: boolean
      }
    }
    Enums: {
      application_status:
        | "DRAFT"
        | "SUBMITTED"
        | "NEEDS_INFO"
        | "ELIGIBLE"
        | "INVITED"
        | "GROUP_CASE"
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
        "GROUP_CASE",
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
