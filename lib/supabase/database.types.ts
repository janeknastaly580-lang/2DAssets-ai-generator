// Generated from Supabase project lhwvkhdsoozvsftwhcif (pnpm db:types). Do not edit by hand.
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
      asset_files: {
        Row: {
          asset_id: string
          checksum_sha256: string | null
          created_at: string
          engine_preset: string | null
          format: string
          id: string
          r2_key: string
          size_bytes: number
          variant: string | null
        }
        Insert: {
          asset_id: string
          checksum_sha256?: string | null
          created_at?: string
          engine_preset?: string | null
          format: string
          id?: string
          r2_key: string
          size_bytes: number
          variant?: string | null
        }
        Update: {
          asset_id?: string
          checksum_sha256?: string | null
          created_at?: string
          engine_preset?: string | null
          format?: string
          id?: string
          r2_key?: string
          size_bytes?: number
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_files_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          animated_preview_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          metadata: Json
          name: string
          parent_asset_id: string | null
          preview_key: string | null
          project_id: string
          prompt: string | null
          size_bytes: number
          slug: string
          source_job_id: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tags: string[]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          animated_preview_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          name: string
          parent_asset_id?: string | null
          preview_key?: string | null
          project_id: string
          prompt?: string | null
          size_bytes?: number
          slug: string
          source_job_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          animated_preview_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          parent_asset_id?: string | null
          preview_key?: string | null
          project_id?: string
          prompt?: string | null
          size_bytes?: number
          slug?: string
          source_job_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          ip: unknown
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          ip?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          ip?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          ip: unknown
          max_attempts: number
          purpose: Database["public"]["Enums"]["auth_code_purpose"]
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip?: unknown
          max_attempts?: number
          purpose: Database["public"]["Enums"]["auth_code_purpose"]
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip?: unknown
          max_attempts?: number
          purpose?: Database["public"]["Enums"]["auth_code_purpose"]
          user_id?: string | null
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          purchased_available: number
          reserved: number
          subscription_available: number
          subscription_expires_at: string | null
          trial_available: number
          trial_expires_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          purchased_available?: number
          reserved?: number
          subscription_available?: number
          subscription_expires_at?: string | null
          trial_available?: number
          trial_expires_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          purchased_available?: number
          reserved?: number
          subscription_available?: number
          subscription_expires_at?: string | null
          trial_available?: number
          trial_expires_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          actor_id: string | null
          bucket: Database["public"]["Enums"]["credit_bucket"] | null
          created_at: string
          delta: number
          description: string | null
          id: number
          job_id: string | null
          kind: Database["public"]["Enums"]["ledger_kind"]
          stripe_event_id: string | null
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          bucket?: Database["public"]["Enums"]["credit_bucket"] | null
          created_at?: string
          delta: number
          description?: string | null
          id?: never
          job_id?: string | null
          kind: Database["public"]["Enums"]["ledger_kind"]
          stripe_event_id?: string | null
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          bucket?: Database["public"]["Enums"]["credit_bucket"] | null
          created_at?: string
          delta?: number
          description?: string | null
          id?: never
          job_id?: string | null
          kind?: Database["public"]["Enums"]["ledger_kind"]
          stripe_event_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          created_at: string
          error: string | null
          expires_at: string | null
          id: string
          r2_key: string | null
          size_bytes: number | null
          spec: Json
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          expires_at?: string | null
          id?: string
          r2_key?: string | null
          size_bytes?: number | null
          spec: Json
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          expires_at?: string | null
          id?: string
          r2_key?: string | null
          size_bytes?: number | null
          spec?: Json
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          payload: Json
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      job_status_feed: {
        Row: {
          error_code: string | null
          job_id: string
          progress: number
          result_asset_ids: string[]
          status: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          error_code?: string | null
          job_id: string
          progress?: number
          result_asset_ids?: string[]
          status: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          error_code?: string | null
          job_id?: string
          progress?: number
          result_asset_ids?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_feed_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_feed_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          credits_charged: number | null
          credits_estimated: number
          credits_reserved: number
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          workflow_run_id: string | null
          input: Json
          moderation_model: string | null
          moderation_prompt_version: string | null
          progress: number
          project_id: string | null
          provider: string | null
          provider_calls: Json
          provider_cost_usd: number | null
          provider_job_id: string | null
          provider_model: string | null
          result_asset_ids: string[]
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          translated_prompt: Json | null
          translator_model: string | null
          translator_prompt_version: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_charged?: number | null
          credits_estimated: number
          credits_reserved?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          workflow_run_id?: string | null
          input: Json
          moderation_model?: string | null
          moderation_prompt_version?: string | null
          progress?: number
          project_id?: string | null
          provider?: string | null
          provider_calls?: Json
          provider_cost_usd?: number | null
          provider_job_id?: string | null
          provider_model?: string | null
          result_asset_ids?: string[]
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          translated_prompt?: Json | null
          translator_model?: string | null
          translator_prompt_version?: string | null
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_charged?: number | null
          credits_estimated?: number
          credits_reserved?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          workflow_run_id?: string | null
          input?: Json
          moderation_model?: string | null
          moderation_prompt_version?: string | null
          progress?: number
          project_id?: string | null
          provider?: string | null
          provider_calls?: Json
          provider_cost_usd?: number | null
          provider_job_id?: string | null
          provider_model?: string | null
          result_asset_ids?: string[]
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          translated_prompt?: Json | null
          translator_model?: string | null
          translator_prompt_version?: string | null
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_pricing: {
        Row: {
          credits: number
          enabled: boolean
          est_provider_cost_usd: number
          id: string
          params: Json
          pipeline: Database["public"]["Enums"]["asset_type"]
          provider: string
          provider_model: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credits: number
          enabled?: boolean
          est_provider_cost_usd: number
          id: string
          params?: Json
          pipeline: Database["public"]["Enums"]["asset_type"]
          provider: string
          provider_model: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credits?: number
          enabled?: boolean
          est_provider_cost_usd?: number
          id?: string
          params?: Json
          pipeline?: Database["public"]["Enums"]["asset_type"]
          provider?: string
          provider_model?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_pricing_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          category: string | null
          created_at: string
          id: string
          job_id: string | null
          model: string | null
          prompt_excerpt: string | null
          reason: string | null
          source: string
          user_id: string
          verdict: Database["public"]["Enums"]["moderation_verdict"]
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          model?: string | null
          prompt_excerpt?: string | null
          reason?: string | null
          source: string
          user_id: string
          verdict: Database["public"]["Enums"]["moderation_verdict"]
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          model?: string | null
          prompt_excerpt?: string | null
          reason?: string | null
          source?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["moderation_verdict"]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          ban_reason: string | null
          banned_at: string | null
          cookie_consent: Json | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          marketing_consent: boolean
          notification_prefs: Json
          role: Database["public"]["Enums"]["user_role"]
          tos_accepted_at: string | null
          tos_version: string | null
          trial_used_at: string | null
          updated_at: string
          violations_month: number
          violations_reset_at: string | null
        }
        Insert: {
          avatar_key?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          cookie_consent?: Json | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          marketing_consent?: boolean
          notification_prefs?: Json
          role?: Database["public"]["Enums"]["user_role"]
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_used_at?: string | null
          updated_at?: string
          violations_month?: number
          violations_reset_at?: string | null
        }
        Update: {
          avatar_key?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          cookie_consent?: Json | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          marketing_consent?: boolean
          notification_prefs?: Json
          role?: Database["public"]["Enums"]["user_role"]
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_used_at?: string | null
          updated_at?: string
          violations_month?: number
          violations_reset_at?: string | null
        }
        Relationships: []
      }
      project_references: {
        Row: {
          asset_id: string | null
          created_at: string
          created_by: string | null
          extracted_palette: Json | null
          id: string
          kind: Database["public"]["Enums"]["reference_kind"]
          label: string | null
          project_id: string
          r2_key: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          extracted_palette?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["reference_kind"]
          label?: string | null
          project_id: string
          r2_key: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          extracted_palette?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["reference_kind"]
          label?: string | null
          project_id?: string
          r2_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_scratch: boolean
          name: string
          slug: string
          style_guide: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_scratch?: boolean
          name: string
          slug: string
          style_guide?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_scratch?: boolean
          name?: string
          slug?: string
          style_guide?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_asset_fk"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          allow_download: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          revoked_at: string | null
          show_prompt: boolean
          target_id: string
          target_type: Database["public"]["Enums"]["share_target"]
          token_hash: string
          view_count: number
          workspace_id: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          show_prompt?: boolean
          target_id: string
          target_type: Database["public"]["Enums"]["share_target"]
          token_hash: string
          view_count?: number
          workspace_id: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          show_prompt?: boolean
          target_id?: string
          target_type?: Database["public"]["Enums"]["share_target"]
          token_hash?: string
          view_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          error: string | null
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          error?: string | null
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          error?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          completed: boolean
          created_at: string
          expires_at: string
          id: string
          mime: string
          r2_key: string
          size_bytes: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          mime: string
          r2_key: string
          size_bytes: number
          user_id: string
          workspace_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          mime?: string
          r2_key?: string
          size_bytes?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_until: string | null
          id: string
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          retention_days: number | null
          seats: number
          slug: string
          storage_quota_bytes: number
          storage_used_bytes: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_until?: string | null
          id?: string
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          retention_days?: number | null
          seats?: number
          slug: string
          storage_quota_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_until?: string | null
          id?: string
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          retention_days?: number | null
          seats?: number
          slug?: string
          storage_quota_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      jobs_public: {
        Row: {
          created_at: string | null
          credits_charged: number | null
          credits_estimated: number | null
          credits_reserved: number | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string | null
          input: Json | null
          progress: number | null
          project_id: string | null
          result_asset_ids: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          type: Database["public"]["Enums"]["asset_type"] | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_charged?: number | null
          credits_estimated?: number | null
          credits_reserved?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string | null
          input?: Json | null
          progress?: number | null
          project_id?: string | null
          result_asset_ids?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type?: Database["public"]["Enums"]["asset_type"] | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_charged?: number | null
          credits_estimated?: number | null
          credits_reserved?: number | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string | null
          input?: Json | null
          progress?: number | null
          project_id?: string | null
          result_asset_ids?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type?: Database["public"]["Enums"]["asset_type"] | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_storage: {
        Args: { p_delta: number; p_workspace: string }
        Returns: number
      }
      available_credits: {
        Args: { b: Database["public"]["Tables"]["credit_balances"]["Row"] }
        Returns: number
      }
      expire_credits: {
        Args: {
          p_bucket: Database["public"]["Enums"]["credit_bucket"]
          p_workspace: string
        }
        Returns: number
      }
      grant_credits: {
        Args: {
          p_actor?: string
          p_amount: number
          p_bucket: Database["public"]["Enums"]["credit_bucket"]
          p_description?: string
          p_expires_at?: string
          p_kind: Database["public"]["Enums"]["ledger_kind"]
          p_ref?: string
          p_workspace: string
        }
        Returns: boolean
      }
      increment_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: {
        Args: {
          min_role?: Database["public"]["Enums"]["member_role"]
          ws: string
        }
        Returns: boolean
      }
      member_role_rank: {
        Args: { r: Database["public"]["Enums"]["member_role"] }
        Returns: number
      }
      my_workspaces: {
        Args: never
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          grace_until: string
          id: string
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          role: Database["public"]["Enums"]["member_role"]
          slug: string
          storage_quota_bytes: number
          storage_used_bytes: number
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["workspace_type"]
        }[]
      }
      record_violation: { Args: { p_user: string }; Returns: number }
      release_reservation: { Args: { p_job: string }; Returns: undefined }
      reserve_credits: {
        Args: { p_amount: number; p_job: string; p_workspace: string }
        Returns: boolean
      }
      reset_subscription_credits: {
        Args: {
          p_amount: number
          p_expires_at: string
          p_ref?: string
          p_workspace: string
        }
        Returns: boolean
      }
      set_subscription_expiry: {
        Args: { p_expires_at: string; p_workspace: string }
        Returns: undefined
      }
      settle_job_credits: {
        Args: { p_actual: number; p_job: string }
        Returns: number
      }
      workspace_balance: {
        Args: { p_workspace: string }
        Returns: {
          available: number
          purchased_available: number
          reserved: number
          subscription_available: number
          subscription_expires_at: string
          trial_available: number
          trial_expires_at: string
        }[]
      }
    }
    Enums: {
      asset_status: "processing" | "ready" | "failed"
      asset_type:
        | "image"
        | "sprite_animation"
        | "model_3d"
        | "audio_sfx"
        | "audio_music"
        | "audio_voice"
      auth_code_purpose: "signup" | "password_reset"
      credit_bucket: "trial" | "subscription" | "purchased"
      job_status:
        | "queued"
        | "moderating"
        | "translating"
        | "generating"
        | "post_processing"
        | "uploading"
        | "completed"
        | "failed"
        | "rejected"
        | "cancelled"
      ledger_kind:
        | "subscription_grant"
        | "pack_purchase"
        | "trial_purchase"
        | "reservation"
        | "settlement"
        | "release"
        | "refund"
        | "admin_adjustment"
        | "expiry"
      member_role: "owner" | "admin" | "member" | "viewer"
      moderation_verdict: "allow" | "block"
      plan_tier: "none" | "trial" | "pro" | "studio"
      reference_kind: "style" | "character" | "palette"
      share_target: "asset" | "project"
      subscription_status:
        | "none"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
      user_role: "user" | "admin"
      workspace_type: "personal" | "team"
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
      asset_status: ["processing", "ready", "failed"],
      asset_type: [
        "image",
        "sprite_animation",
        "model_3d",
        "audio_sfx",
        "audio_music",
        "audio_voice",
      ],
      auth_code_purpose: ["signup", "password_reset"],
      credit_bucket: ["trial", "subscription", "purchased"],
      job_status: [
        "queued",
        "moderating",
        "translating",
        "generating",
        "post_processing",
        "uploading",
        "completed",
        "failed",
        "rejected",
        "cancelled",
      ],
      ledger_kind: [
        "subscription_grant",
        "pack_purchase",
        "trial_purchase",
        "reservation",
        "settlement",
        "release",
        "refund",
        "admin_adjustment",
        "expiry",
      ],
      member_role: ["owner", "admin", "member", "viewer"],
      moderation_verdict: ["allow", "block"],
      plan_tier: ["none", "trial", "pro", "studio"],
      reference_kind: ["style", "character", "palette"],
      share_target: ["asset", "project"],
      subscription_status: [
        "none",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
      ],
      user_role: ["user", "admin"],
      workspace_type: ["personal", "team"],
    },
  },
} as const
