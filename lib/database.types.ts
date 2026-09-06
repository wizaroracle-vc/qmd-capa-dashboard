/**
 * Hand-authored Supabase schema types. Mirrors supabase/migrations/0001_initial_schema.sql.
 * Regenerate from a running Supabase instance with:  npm run db:types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamped = { created_at?: string; updated_at?: string };

export interface Database {
  public: {
    Tables: {
      locales: {
        Row: { id: string; name: string };
        Insert: { id: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; role: "LOCALE" | "QMD"; full_name: string };
        Insert: { id: string; role: "LOCALE" | "QMD"; full_name?: string };
        Update: { id?: string; role?: "LOCALE" | "QMD"; full_name?: string };
        Relationships: [];
      };
      locale_accounts: {
        Row: {
          locale_id: string;
          user_id: string;
          email: string;
          visible_password: string;
          enabled: boolean;
          updated_at: string;
        };
        Insert: {
          locale_id: string;
          user_id: string;
          email: string;
          visible_password?: string;
          enabled?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["locale_accounts"]["Insert"]>;
        Relationships: [];
      };
      months: {
        Row: {
          id: string;
          locale_id: string;
          year: number;
          month_num: number;
          label: string;
        };
        Insert: {
          id?: string;
          locale_id: string;
          year: number;
          month_num: number;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["months"]["Insert"]>;
        Relationships: [];
      };
      capa_plans: {
        Row: {
          id: string;
          capa_id: string;
          locale_id: string;
          month_id: string;
          year: number;
          month_num: number;
          department: string;
          date_created: string;
          source: string;
          prepared_by: string;
          stage: "draft" | "submitted" | "closed" | "monitoring" | "reopened";
          submitted_date: string;
          archived: boolean;
          verification: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["capa_plans"]["Row"],
          "id" | "created_at" | "updated_at"
        > &
          Timestamped & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["capa_plans"]["Insert"]
        >;
        Relationships: [];
      };
      capa_sets: {
        Row: {
          id: string;
          plan_id: string;
          set_number: number;
          set_code: string;
          archived: boolean;
          issue: string;
          six_m: Json;
          vital_causes: Json;
          five_whys: Json;
        };
        Insert: Omit<
          Database["public"]["Tables"]["capa_sets"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["capa_sets"]["Insert"]>;
        Relationships: [];
      };
      action_items: {
        Row: {
          id: string;
          set_id: string;
          corrective_action: string;
          preventive_action: string;
          responsible_person: string;
          target_date: string;
          /** Added by migration 0002 — optional here so the app builds before it's applied. */
          started_date?: string;
          status: string;
          date_completed: string;
          verification: string;
          remarks: string;
          order_index: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["action_items"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["action_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      auth_role: { Args: Record<never, never>; Returns: string };
      auth_locale_id: { Args: Record<never, never>; Returns: string };
      is_qmd: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
