export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      application_questions: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          input_type: string
          key: string
          prompt: string
          required: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          input_type?: string
          key: string
          prompt: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          input_type?: string
          key?: string
          prompt?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_questions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_responses: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          question_key: string
          question_text: string
          response_text: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          question_key: string
          question_text: string
          response_text: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          question_key?: string
          question_text?: string
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_responses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      apply_rate_limit: {
        Row: {
          count: number
          ip_hash: string
          window_start: string
        }
        Insert: {
          count?: number
          ip_hash: string
          window_start: string
        }
        Update: {
          count?: number
          ip_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          cycle_id: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          cycle_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          cycle_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          current_stage: Database["public"]["Enums"]["candidate_stage"]
          cycle_id: string
          deleted_at: string | null
          email: string
          full_name: string
          gpa: number | null
          id: string
          linkedin_url: string | null
          major: string | null
          per_cycle_seq: number
          phone: string | null
          preferred_name: string | null
          resume_storage_path: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
          year: string | null
        }
        Insert: {
          created_at?: string
          current_stage?: Database["public"]["Enums"]["candidate_stage"]
          cycle_id: string
          deleted_at?: string | null
          email: string
          full_name: string
          gpa?: number | null
          id?: string
          linkedin_url?: string | null
          major?: string | null
          per_cycle_seq: number
          phone?: string | null
          preferred_name?: string | null
          resume_storage_path?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          year?: string | null
        }
        Update: {
          created_at?: string
          current_stage?: Database["public"]["Enums"]["candidate_stage"]
          cycle_id?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          gpa?: number | null
          id?: string
          linkedin_url?: string | null
          major?: string | null
          per_cycle_seq?: number
          phone?: string | null
          preferred_name?: string | null
          resume_storage_path?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_flags: {
        Row: {
          candidate_id: string
          created_at: string
          description: string | null
          id: string
          is_excluded_from_agg: boolean
          member_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_excluded_from_agg?: boolean
          member_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_excluded_from_agg?: boolean
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coi_flags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coi_flags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coi_flags_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coi_flags_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          candidate_id: string
          created_at: string
          decided_by: string
          id: string
          rationale: string | null
          session_id: string
          value: Database["public"]["Enums"]["decision_value"]
          voter_tally: Json | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          decided_by: string
          id?: string
          rationale?: string | null
          session_id: string
          value: Database["public"]["Enums"]["decision_value"]
          voter_tally?: Json | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          decided_by?: string
          id?: string
          rationale?: string | null
          session_id?: string
          value?: Database["public"]["Enums"]["decision_value"]
          voter_tally?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluator_assignments: {
        Row: {
          candidate_id: string | null
          created_at: string
          cycle_id: string
          evaluator_id: string
          id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          cycle_id: string
          evaluator_id: string
          id?: string
          stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          cycle_id?: string
          evaluator_id?: string
          id?: string
          stage?: Database["public"]["Enums"]["candidate_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "evaluator_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_assignments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_assignments_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_assignments_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hash_session_participants: {
        Row: {
          created_at: string
          id: string
          member_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hash_session_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_session_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hash_sessions: {
        Row: {
          created_at: string
          cycle_id: string
          ended_at: string | null
          id: string
          is_active: boolean
          name: string
          quorum_threshold: number
          stage: Database["public"]["Enums"]["candidate_stage"]
          started_at: string | null
          started_by: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["hash_visibility"]
        }
        Insert: {
          created_at?: string
          cycle_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          quorum_threshold?: number
          stage: Database["public"]["Enums"]["candidate_stage"]
          started_at?: string | null
          started_by?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["hash_visibility"]
        }
        Update: {
          created_at?: string
          cycle_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          quorum_threshold?: number
          stage?: Database["public"]["Enums"]["candidate_stage"]
          started_at?: string | null
          started_by?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["hash_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "hash_sessions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hash_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_allowlist: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          notes: string | null
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invite_allowlist_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_allowlist_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          bio: string | null
          created_at: string
          current_company: string | null
          current_role_title: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_public: boolean
          linkedin_url: string | null
          major: string | null
          photo_storage_path: string | null
          placement_consent: boolean
          preferred_name: string | null
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          current_company?: string | null
          current_role_title?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_public?: boolean
          linkedin_url?: string | null
          major?: string | null
          photo_storage_path?: string | null
          placement_consent?: boolean
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          current_company?: string | null
          current_role_title?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_public?: boolean
          linkedin_url?: string | null
          major?: string | null
          photo_storage_path?: string | null
          placement_consent?: boolean
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          author_id: string
          body: string
          candidate_id: string
          created_at: string
          deleted_at: string | null
          id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          candidate_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          candidate_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          stage?: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_features: {
        Row: {
          company: string
          created_at: string
          cycle_id: string | null
          id: string
          is_featured: boolean
          logo_storage_path: string | null
          member_id: string | null
          quote: string | null
          role_title: string | null
          sort_order: number
          term: string | null
          updated_at: string
        }
        Insert: {
          company: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_featured?: boolean
          logo_storage_path?: string | null
          member_id?: string | null
          quote?: string | null
          role_title?: string | null
          sort_order?: number
          term?: string | null
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_featured?: boolean
          logo_storage_path?: string | null
          member_id?: string | null
          quote?: string | null
          role_title?: string | null
          sort_order?: number
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_features_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_features_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_features_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          candidate_id: string
          created_at: string
          evaluator_id: string
          id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at: string
          value: Database["public"]["Enums"]["reaction_value"]
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          value: Database["public"]["Enums"]["reaction_value"]
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          stage?: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          value?: Database["public"]["Enums"]["reaction_value"]
        }
        Relationships: [
          {
            foreignKeyName: "reactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_cycles: {
        Row: {
          applications_close_at: string | null
          applications_open_at: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          is_open_rush: boolean
          name: string
          updated_at: string
        }
        Insert: {
          applications_close_at?: string | null
          applications_open_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          is_open_rush?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          applications_close_at?: string | null
          applications_open_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_open_rush?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          max_score: number
          min_score: number
          name: string
          rubric_version_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_score?: number
          min_score?: number
          name: string
          rubric_version_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_score?: number
          min_score?: number
          name?: string
          rubric_version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_versions: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          id: string
          is_active: boolean
          label: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      score_submissions: {
        Row: {
          candidate_id: string
          created_at: string
          evaluator_id: string
          id: string
          rubric_version_id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          submitted_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          rubric_version_id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          submitted_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          rubric_version_id?: string
          stage?: Database["public"]["Enums"]["candidate_stage"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          candidate_id: string
          created_at: string
          evaluator_id: string
          id: string
          rubric_criterion_id: string
          rubric_version_id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at: string
          value: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          rubric_criterion_id: string
          rubric_version_id: string
          stage: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          value: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          rubric_criterion_id?: string
          rubric_version_id?: string
          stage?: Database["public"]["Enums"]["candidate_stage"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_rubric_criterion_id_fkey"
            columns: ["rubric_criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_transitions: {
        Row: {
          actor_id: string
          candidate_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["candidate_stage"] | null
          id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Insert: {
          actor_id: string
          candidate_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["candidate_stage"] | null
          id?: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Update: {
          actor_id?: string
          candidate_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["candidate_stage"] | null
          id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["candidate_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "stage_transitions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transitions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transitions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transitions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          session_id: string
          value: Database["public"]["Enums"]["vote_value"]
          voter_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          session_id: string
          value: Database["public"]["Enums"]["vote_value"]
          voter_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          session_id?: string
          value?: Database["public"]["Enums"]["vote_value"]
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_evaluator_stage_stats: {
        Row: {
          cycle_id: string | null
          evaluator_id: string | null
          mu: number | null
          n: number | null
          sigma: number | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_candidate_controversy: {
        Row: {
          candidate_id: string | null
          controversy: number | null
          cycle_id: string | null
          evaluator_max_normalized: number | null
          evaluator_min_normalized: number | null
          panel_composite_normalized: number | null
          panel_composite_raw: number | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      v_candidate_roster: {
        Row: {
          cycle_id: string | null
          display_code: string | null
          full_name: string | null
          id: string | null
          major: string | null
          status: string | null
          year: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_placement_public: {
        Row: {
          company: string | null
          id: string | null
          is_featured: boolean | null
          logo_storage_path: string | null
          member_name: string | null
          quote: string | null
          role_title: string | null
          sort_order: number | null
          term: string | null
        }
        Relationships: []
      }
      v_score_composite: {
        Row: {
          candidate_id: string | null
          composite_raw: number | null
          cycle_id: string | null
          evaluator_id: string | null
          rubric_version_id: string | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_score_composite_internal: {
        Row: {
          candidate_id: string | null
          composite_raw: number | null
          cycle_id: string | null
          evaluator_id: string | null
          rubric_version_id: string | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_score_normalized: {
        Row: {
          candidate_id: string | null
          composite_raw: number | null
          cycle_id: string | null
          evaluator_id: string | null
          panel_composite_normalized: number | null
          panel_composite_raw: number | null
          panel_evaluator_count: number | null
          stage: Database["public"]["Enums"]["candidate_stage"] | null
          z: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "recruitment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_submissions_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "v_team_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_team_public: {
        Row: {
          bio: string | null
          full_name: string | null
          id: string | null
          linkedin_url: string | null
          major: string | null
          photo_storage_path: string | null
          preferred_name: string | null
          role: Database["public"]["Enums"]["member_role"] | null
          year: string | null
        }
        Insert: {
          bio?: string | null
          full_name?: string | null
          id?: string | null
          linkedin_url?: string | null
          major?: string | null
          photo_storage_path?: string | null
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["member_role"] | null
          year?: string | null
        }
        Update: {
          bio?: string | null
          full_name?: string | null
          id?: string | null
          linkedin_url?: string | null
          major?: string | null
          photo_storage_path?: string | null
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["member_role"] | null
          year?: string | null
        }
        Relationships: []
      }
      vote_counts: {
        Row: {
          candidate_id: string | null
          count: number | null
          session_id: string | null
          value: Database["public"]["Enums"]["vote_value"] | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_candidate_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_member_id: { Args: never; Returns: string }
      current_member_role: {
        Args: never
        Returns: Database["public"]["Enums"]["member_role"]
      }
      has_submitted_for: {
        Args: {
          p_candidate_id: string
          p_stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Returns: boolean
      }
      is_board: { Args: never; Returns: boolean }
      is_committee_or_above: { Args: never; Returns: boolean }
      is_member_or_above: { Args: never; Returns: boolean }
      prune_apply_rate_limit: { Args: never; Returns: undefined }
      session_is_active: { Args: { p_session_id: string }; Returns: boolean }
      session_is_open: { Args: { p_session_id: string }; Returns: boolean }
      submit_application: {
        Args: {
          p_candidate_id: string
          p_cycle_id: string
          p_email: string
          p_full_name: string
          p_ip_hash: string
          p_linkedin_url: string
          p_major: string
          p_phone: string
          p_responses: Json
          p_resume_storage_path: string
          p_year: string
        }
        Returns: string
      }
    }
    Enums: {
      audit_action:
        | "candidate_created"
        | "candidate_stage_advanced"
        | "candidate_status_changed"
        | "score_saved"
        | "score_submitted"
        | "score_edit_reopened"
        | "note_created"
        | "note_updated"
        | "note_soft_deleted"
        | "reaction_set"
        | "coi_flagged"
        | "coi_exclusion_toggled"
        | "evaluator_assigned"
        | "hash_session_started"
        | "hash_session_ended"
        | "hash_visibility_changed"
        | "hash_participant_added"
        | "vote_cast"
        | "decision_recorded"
        | "rubric_version_created"
        | "rubric_version_activated"
        | "member_role_changed"
        | "member_soft_deleted"
        | "invite_created"
        | "invite_consumed"
        | "cycle_created"
        | "cycle_open_rush_toggled"
      candidate_stage:
        | "applied"
        | "speed_dating"
        | "group_case"
        | "interview"
        | "hash"
        | "decided"
      candidate_status:
        | "active"
        | "advanced"
        | "cut"
        | "waitlisted"
        | "withdrawn"
        | "accepted"
        | "rejected"
      decision_value: "accepted" | "rejected" | "waitlisted"
      hash_visibility: "anonymous" | "open"
      member_role: "board" | "recruitment_committee" | "general_member"
      reaction_value: "strong_yes" | "yes" | "no" | "strong_no"
      vote_value: "advance" | "cut" | "discuss"
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
      audit_action: [
        "candidate_created",
        "candidate_stage_advanced",
        "candidate_status_changed",
        "score_saved",
        "score_submitted",
        "score_edit_reopened",
        "note_created",
        "note_updated",
        "note_soft_deleted",
        "reaction_set",
        "coi_flagged",
        "coi_exclusion_toggled",
        "evaluator_assigned",
        "hash_session_started",
        "hash_session_ended",
        "hash_visibility_changed",
        "hash_participant_added",
        "vote_cast",
        "decision_recorded",
        "rubric_version_created",
        "rubric_version_activated",
        "member_role_changed",
        "member_soft_deleted",
        "invite_created",
        "invite_consumed",
        "cycle_created",
        "cycle_open_rush_toggled",
      ],
      candidate_stage: [
        "applied",
        "speed_dating",
        "group_case",
        "interview",
        "hash",
        "decided",
      ],
      candidate_status: [
        "active",
        "advanced",
        "cut",
        "waitlisted",
        "withdrawn",
        "accepted",
        "rejected",
      ],
      decision_value: ["accepted", "rejected", "waitlisted"],
      hash_visibility: ["anonymous", "open"],
      member_role: ["board", "recruitment_committee", "general_member"],
      reaction_value: ["strong_yes", "yes", "no", "strong_no"],
      vote_value: ["advance", "cut", "discuss"],
    },
  },
} as const

