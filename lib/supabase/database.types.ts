export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      allocations: {
        Row: {
          amount_cents: number | null;
          created_at: string;
          created_by: string | null;
          entity_id: string;
          id: string;
          line_item_id: string | null;
          method: Database["public"]["Enums"]["allocation_method"];
          org_id: string;
          percent_bp: number | null;
          record_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          entity_id: string;
          id?: string;
          line_item_id?: string | null;
          method: Database["public"]["Enums"]["allocation_method"];
          org_id: string;
          percent_bp?: number | null;
          record_id: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string;
          id?: string;
          line_item_id?: string | null;
          method?: Database["public"]["Enums"]["allocation_method"];
          org_id?: string;
          percent_bp?: number | null;
          record_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "line_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          diff: Json | null;
          id: number;
          org_id: string;
          row_id: string;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          org_id: string;
          row_id: string;
          table_name: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          org_id?: string;
          row_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_pages: {
        Row: {
          created_at: string;
          document_id: string;
          id: string;
          ocr_confidence: number | null;
          org_id: string;
          page_no: number;
          source: Database["public"]["Enums"]["page_source"];
          text: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document_id: string;
          id?: string;
          ocr_confidence?: number | null;
          org_id: string;
          page_no: number;
          source: Database["public"]["Enums"]["page_source"];
          text?: string;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          id?: string;
          ocr_confidence?: number | null;
          org_id?: string;
          page_no?: number;
          source?: Database["public"]["Enums"]["page_source"];
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_pages_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          entity_id?: string | null;
          error?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          org_id: string;
          page_count?: number | null;
          sha256?: string | null;
          size_bytes: number;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          entity_id?: string | null;
          error?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          org_id?: string;
          page_count?: number | null;
          sha256?: string | null;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      entities: {
        Row: {
          address: string | null;
          client_name: string | null;
          code: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["entity_kind"];
          meta: NonNullable<Json>;
          name: string;
          org_id: string;
          status: Database["public"]["Enums"]["entity_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          client_name?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["entity_kind"];
          meta?: NonNullable<Json>;
          name: string;
          org_id: string;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          client_name?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["entity_kind"];
          meta?: NonNullable<Json>;
          name?: string;
          org_id?: string;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entities_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      extractions: {
        Row: {
          attempts: number;
          created_at: string;
          document_id: string;
          fields: NonNullable<Json>;
          id: string;
          latency_ms: number;
          model: string;
          org_id: string;
          provider: string;
          raw: NonNullable<Json>;
          schema_version: number;
          tokens_in: number;
          tokens_out: number;
        };
        ComputedFields: never;
        Insert: {
          attempts: number;
          created_at?: string;
          document_id: string;
          fields: NonNullable<Json>;
          id?: string;
          latency_ms: number;
          model: string;
          org_id: string;
          provider: string;
          raw: NonNullable<Json>;
          schema_version: number;
          tokens_in?: number;
          tokens_out?: number;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          document_id?: string;
          fields?: NonNullable<Json>;
          id?: string;
          latency_ms?: number;
          model?: string;
          org_id?: string;
          provider?: string;
          raw?: NonNullable<Json>;
          schema_version?: number;
          tokens_in?: number;
          tokens_out?: number;
        };
        Relationships: [
          {
            foreignKeyName: "extractions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "extractions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      line_items: {
        Row: {
          amount_cents: number | null;
          category: Database["public"]["Enums"]["cost_category"] | null;
          confidence: number;
          created_at: string;
          description: string | null;
          id: string;
          org_id: string;
          position: number;
          quantity: number | null;
          record_id: string;
          unit_price_cents: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents?: number | null;
          category?: Database["public"]["Enums"]["cost_category"] | null;
          confidence: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          org_id: string;
          position: number;
          quantity?: number | null;
          record_id: string;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number | null;
          category?: Database["public"]["Enums"]["cost_category"] | null;
          confidence?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          org_id?: string;
          position?: number;
          quantity?: number | null;
          record_id?: string;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "line_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "line_items_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          auto_approve: boolean;
          brand_color: string | null;
          created_at: string;
          created_by: string | null;
          default_currency: string;
          entity_kind: Database["public"]["Enums"]["entity_kind"];
          id: string;
          logo_path: string | null;
          name: string;
          review_threshold: number;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          auto_approve?: boolean;
          brand_color?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          entity_kind: Database["public"]["Enums"]["entity_kind"];
          id?: string;
          logo_path?: string | null;
          name: string;
          review_threshold?: number;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          auto_approve?: boolean;
          brand_color?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          entity_kind?: Database["public"]["Enums"]["entity_kind"];
          id?: string;
          logo_path?: string | null;
          name?: string;
          review_threshold?: number;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          last_org_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          last_org_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          last_org_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_last_org_id_fkey";
            columns: ["last_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      records: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          category: Database["public"]["Enums"]["cost_category"] | null;
          created_at: string;
          currency: string | null;
          document_id: string | null;
          document_type: Database["public"]["Enums"]["document_type"] | null;
          due_date: string | null;
          entity_hint: string | null;
          entity_id: string | null;
          extraction_id: string | null;
          field_confidence: NonNullable<Json>;
          id: string;
          invoice_number: string | null;
          issue_date: string | null;
          min_confidence: number;
          org_id: string;
          status: Database["public"]["Enums"]["record_status"];
          subtotal_cents: number | null;
          supplier_name: string | null;
          supplier_tax_id: string | null;
          tax_cents: number | null;
          tax_rate: number | null;
          total_cents: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          category?: Database["public"]["Enums"]["cost_category"] | null;
          created_at?: string;
          currency?: string | null;
          document_id?: string | null;
          document_type?: Database["public"]["Enums"]["document_type"] | null;
          due_date?: string | null;
          entity_hint?: string | null;
          entity_id?: string | null;
          extraction_id?: string | null;
          field_confidence?: NonNullable<Json>;
          id?: string;
          invoice_number?: string | null;
          issue_date?: string | null;
          min_confidence: number;
          org_id: string;
          status?: Database["public"]["Enums"]["record_status"];
          subtotal_cents?: number | null;
          supplier_name?: string | null;
          supplier_tax_id?: string | null;
          tax_cents?: number | null;
          tax_rate?: number | null;
          total_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          category?: Database["public"]["Enums"]["cost_category"] | null;
          created_at?: string;
          currency?: string | null;
          document_id?: string | null;
          document_type?: Database["public"]["Enums"]["document_type"] | null;
          due_date?: string | null;
          entity_hint?: string | null;
          entity_id?: string | null;
          extraction_id?: string | null;
          field_confidence?: NonNullable<Json>;
          id?: string;
          invoice_number?: string | null;
          issue_date?: string | null;
          min_confidence?: number;
          org_id?: string;
          status?: Database["public"]["Enums"]["record_status"];
          subtotal_cents?: number | null;
          supplier_name?: string | null;
          supplier_tax_id?: string | null;
          tax_cents?: number | null;
          tax_rate?: number | null;
          total_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "records_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "records_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "records_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "records_extraction_id_fkey";
            columns: ["extraction_id"];
            isOneToOne: false;
            referencedRelation: "extractions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "records_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      review_actions: {
        Row: {
          action: Database["public"]["Enums"]["review_action_type"];
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          field: string | null;
          id: string;
          org_id: string;
          reason: string | null;
          record_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["review_action_type"];
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          field?: string | null;
          id?: string;
          org_id: string;
          reason?: string | null;
          record_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["review_action_type"];
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          field?: string | null;
          id?: string;
          org_id?: string;
          reason?: string | null;
          record_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_actions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_actions_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_issues: {
        Row: {
          code: string;
          created_at: string;
          details: NonNullable<Json>;
          field: string | null;
          id: string;
          message: string;
          org_id: string;
          record_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database["public"]["Enums"]["issue_severity"];
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          details?: NonNullable<Json>;
          field?: string | null;
          id?: string;
          message: string;
          org_id: string;
          record_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: Database["public"]["Enums"]["issue_severity"];
        };
        Update: {
          code?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          field?: string | null;
          id?: string;
          message?: string;
          org_id?: string;
          record_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database["public"]["Enums"]["issue_severity"];
        };
        Relationships: [
          {
            foreignKeyName: "validation_issues_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_issues_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_issues_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
      bulk_approve_clean: { Args: { p_records: string[] }; Returns: number };
      confirm_document_upload: {
        Args: { p_document: string };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_organization: {
        Args: { p_entity_kind: Database["public"]["Enums"]["entity_kind"]; p_name: string };
        Returns: {
          auto_approve: boolean;
          brand_color: string | null;
          created_at: string;
          created_by: string | null;
          default_currency: string;
          entity_kind: Database["public"]["Enums"]["entity_kind"];
          id: string;
          logo_path: string | null;
          name: string;
          review_threshold: number;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_org_role: { Args: { p_org: string; p_roles: string[] }; Returns: boolean };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          accepted: boolean;
          email: string;
          expired: boolean;
          org_name: string;
          role: Database["public"]["Enums"]["org_role"];
        }[];
      };
      is_org_member: { Args: { p_org: string }; Returns: boolean };
      record_min_confidence: {
        Args: { p_document_type: Database["public"]["Enums"]["document_type"]; p_field_confidence: Json };
        Returns: number;
      };
      replace_record_issues: {
        Args: { p_issues: Json; p_org: string; p_record: string };
        Returns: undefined;
      };
      retry_document: {
        Args: { p_document: string };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_record: {
        Args: {
          p_action: Database["public"]["Enums"]["review_action_type"];
          p_fields?: Json;
          p_issues?: Json;
          p_lines?: Json;
          p_reason?: string;
          p_record: string;
        };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          category: Database["public"]["Enums"]["cost_category"] | null;
          created_at: string;
          currency: string | null;
          document_id: string | null;
          document_type: Database["public"]["Enums"]["document_type"] | null;
          due_date: string | null;
          entity_hint: string | null;
          entity_id: string | null;
          extraction_id: string | null;
          field_confidence: NonNullable<Json>;
          id: string;
          invoice_number: string | null;
          issue_date: string | null;
          min_confidence: number;
          org_id: string;
          status: Database["public"]["Enums"]["record_status"];
          subtotal_cents: number | null;
          supplier_name: string | null;
          supplier_tax_id: string | null;
          tax_cents: number | null;
          tax_rate: number | null;
          total_cents: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "records";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_document_pages: {
        Args: {
          p_actor?: string;
          p_document: string;
          p_org: string;
          p_page_count: number;
          p_pages: Json;
          p_sha256?: string;
        };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_extraction: {
        Args: {
          p_actor?: string;
          p_document: string;
          p_extraction: Json;
          p_lines: Json;
          p_org: string;
          p_record: Json;
        };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_validation: {
        Args: {
          p_actor?: string;
          p_document: string;
          p_document_status: Database["public"]["Enums"]["document_status"];
          p_issues: Json;
          p_org: string;
          p_record_status: Database["public"]["Enums"]["record_status"];
        };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_allocations: {
        Args: {
          p_line_item: string;
          p_method: Database["public"]["Enums"]["allocation_method"];
          p_record: string;
          p_splits: Json;
        };
        Returns: number;
      };
      shares_org_with: { Args: { p_user: string }; Returns: boolean };
      slugify: { Args: { p_text: string }; Returns: string };
      storage_org_id: { Args: { p_name: string }; Returns: string };
      transition_document: {
        Args: {
          p_actor?: string;
          p_document: string;
          p_error?: string;
          p_from: Database["public"]["Enums"]["document_status"][];
          p_org: string;
          p_page_count?: number;
          p_to: Database["public"]["Enums"]["document_status"];
        };
        Returns: {
          attempts: number;
          created_at: string;
          entity_id: string | null;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          org_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      allocation_method: "percent" | "amount";
      audit_action: "insert" | "update" | "delete";
      cost_category:
        | "repairs_maintenance"
        | "materials"
        | "labor_subcontract"
        | "utilities"
        | "cleaning"
        | "landscaping"
        | "insurance"
        | "taxes_fees"
        | "professional_services"
        | "equipment_rental"
        | "travel_fuel"
        | "office_admin"
        | "other";
      document_status:
        | "uploading"
        | "queued"
        | "extracting"
        | "analyzing"
        | "validating"
        | "needs_review"
        | "ready"
        | "failed";
      document_type: "invoice" | "receipt" | "credit_note" | "quote" | "statement" | "other";
      entity_kind: "property" | "job";
      entity_status: "active" | "archived";
      issue_severity: "error" | "warning";
      org_role: "owner" | "admin" | "reviewer" | "member" | "viewer";
      page_source: "text_layer" | "ocr";
      record_status: "needs_review" | "approved" | "rejected";
      review_action_type: "approve" | "reject" | "correct" | "reopen";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      allocation_method: ["percent", "amount"],
      audit_action: ["insert", "update", "delete"],
      cost_category: [
        "repairs_maintenance",
        "materials",
        "labor_subcontract",
        "utilities",
        "cleaning",
        "landscaping",
        "insurance",
        "taxes_fees",
        "professional_services",
        "equipment_rental",
        "travel_fuel",
        "office_admin",
        "other",
      ],
      document_status: [
        "uploading",
        "queued",
        "extracting",
        "analyzing",
        "validating",
        "needs_review",
        "ready",
        "failed",
      ],
      document_type: ["invoice", "receipt", "credit_note", "quote", "statement", "other"],
      entity_kind: ["property", "job"],
      entity_status: ["active", "archived"],
      issue_severity: ["error", "warning"],
      org_role: ["owner", "admin", "reviewer", "member", "viewer"],
      page_source: ["text_layer", "ocr"],
      record_status: ["needs_review", "approved", "rejected"],
      review_action_type: ["approve", "reject", "correct", "reopen"],
    },
  },
} as const;
