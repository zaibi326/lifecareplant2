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
      customer_opening_balances: {
        Row: {
          condition: Database["public"]["Enums"]["cylinder_condition"]
          created_at: string
          customer_id: string
          cylinder_size_id: string
          gas_type_id: string
          id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          condition?: Database["public"]["Enums"]["cylinder_condition"]
          created_at?: string
          customer_id: string
          cylinder_size_id: string
          gas_type_id: string
          id?: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["cylinder_condition"]
          created_at?: string
          customer_id?: string
          cylinder_size_id?: string
          gas_type_id?: string
          id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_opening_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_opening_balances_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_opening_balances_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          opening_cylinders: number
          opening_due: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_cylinders?: number
          opening_due?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_cylinders?: number
          opening_due?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cylinder_movements: {
        Row: {
          bill_number: string | null
          condition: Database["public"]["Enums"]["cylinder_condition"] | null
          created_at: string
          created_by: string | null
          customer_id: string
          cylinder_size_id: string
          date: string
          driver_name: string | null
          ecr_number: string | null
          extras: Json
          gas_type_id: string
          id: string
          invoice_number: string | null
          photo_urls: string[] | null
          quantity: number
          rate: number | null
          remarks: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["movement_type"]
          vehicle_number: string | null
        }
        Insert: {
          bill_number?: string | null
          condition?: Database["public"]["Enums"]["cylinder_condition"] | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          cylinder_size_id: string
          date?: string
          driver_name?: string | null
          ecr_number?: string | null
          extras?: Json
          gas_type_id: string
          id?: string
          invoice_number?: string | null
          photo_urls?: string[] | null
          quantity: number
          rate?: number | null
          remarks?: string | null
          total_amount?: number | null
          type: Database["public"]["Enums"]["movement_type"]
          vehicle_number?: string | null
        }
        Update: {
          bill_number?: string | null
          condition?: Database["public"]["Enums"]["cylinder_condition"] | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          cylinder_size_id?: string
          date?: string
          driver_name?: string | null
          ecr_number?: string | null
          extras?: Json
          gas_type_id?: string
          id?: string
          invoice_number?: string | null
          photo_urls?: string[] | null
          quantity?: number
          rate?: number | null
          remarks?: string | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["movement_type"]
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cylinder_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_movements_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_movements_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cylinder_sizes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          volume_liters: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          volume_liters?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          volume_liters?: number | null
        }
        Relationships: []
      }
      gas_types: {
        Row: {
          active: boolean
          code: string | null
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      part_sizes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      parts_stock: {
        Row: {
          created_at: string
          id: string
          kind: string
          quantity: number
          size: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          quantity?: number
          size: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          quantity?: number
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          date: string
          id: string
          method: string
          notes: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      production: {
        Row: {
          created_at: string
          created_by: string | null
          cylinder_size_id: string
          date: string
          gas_type_id: string
          id: string
          operator_name: string | null
          quantity: number
          remarks: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cylinder_size_id: string
          date?: string
          gas_type_id: string
          id?: string
          operator_name?: string | null
          quantity: number
          remarks?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string
          date?: string
          gas_type_id?: string
          id?: string
          operator_name?: string | null
          quantity?: number
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          company_address: string | null
          company_name: string | null
          company_phone: string | null
          currency: string | null
          id: number
          invoice_footer: string | null
          invoice_prefix: string | null
          tax_percent: number | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_name?: string | null
          company_phone?: string | null
          currency?: string | null
          id?: number
          invoice_footer?: string | null
          invoice_prefix?: string | null
          tax_percent?: number | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_name?: string | null
          company_phone?: string | null
          currency?: string | null
          id?: number
          invoice_footer?: string | null
          invoice_prefix?: string | null
          tax_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      cylinder_condition: "filled" | "empty" | "unknown"
      movement_type: "receive" | "deliver"
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
      app_role: ["admin", "staff"],
      cylinder_condition: ["filled", "empty", "unknown"],
      movement_type: ["receive", "deliver"],
    },
  },
} as const
