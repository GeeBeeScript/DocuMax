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
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
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
          updated_at?: string;
        };
        Update: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
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
      audit_action: "insert" | "update" | "delete";
      document_status:
        | "uploading"
        | "queued"
        | "extracting"
        | "analyzing"
        | "validating"
        | "needs_review"
        | "ready"
        | "failed";
      entity_kind: "property" | "job";
      entity_status: "active" | "archived";
      org_role: "owner" | "admin" | "reviewer" | "member" | "viewer";
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
      audit_action: ["insert", "update", "delete"],
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
      entity_kind: ["property", "job"],
      entity_status: ["active", "archived"],
      org_role: ["owner", "admin", "reviewer", "member", "viewer"],
    },
  },
} as const;
