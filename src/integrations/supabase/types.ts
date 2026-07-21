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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
          summary: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          summary?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          summary?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_title: string | null
          active: boolean
          bank_name: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_title?: string | null
          active?: boolean
          bank_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_title?: string | null
          active?: boolean
          bank_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      cash_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          direction: string
          id: string
          notes: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: string
          id?: string
          notes?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: string
          id?: string
          notes?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      customer_prices: {
        Row: {
          created_at: string
          customer_id: string
          cylinder_size_id: string
          gas_type_id: string
          id: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          cylinder_size_id: string
          gas_type_id: string
          id?: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          cylinder_size_id?: string
          gas_type_id?: string
          id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prices_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prices_gas_type_id_fkey"
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
          karaya_per_cylinder: number
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
          karaya_per_cylinder?: number
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
          karaya_per_cylinder?: number
          name?: string
          notes?: string | null
          opening_cylinders?: number
          opening_due?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cylinder_exchanges: {
        Row: {
          created_at: string
          created_by: string | null
          cylinder_size_id: string | null
          date: string
          empties_out: number
          filled_in: number
          gas_type_id: string | null
          id: string
          invoice_number: string | null
          remarks: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string | null
          date?: string
          empties_out?: number
          filled_in?: number
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          remarks?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string | null
          date?: string
          empties_out?: number
          filled_in?: number
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          remarks?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cylinder_exchanges_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_exchanges_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_exchanges_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
          driver_id: string | null
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
          vehicle_id: string | null
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
          driver_id?: string | null
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
          vehicle_id?: string | null
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
          driver_id?: string | null
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
          vehicle_id?: string | null
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
            foreignKeyName: "cylinder_movements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_movements_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      cylinder_purchases: {
        Row: {
          condition: string
          created_at: string
          created_by: string | null
          cylinder_size_id: string | null
          date: string
          gas_type_id: string | null
          id: string
          invoice_number: string | null
          outstanding: number
          payment: number
          purchase_cost: number
          quantity: number
          remarks: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          condition?: string
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string | null
          date?: string
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          outstanding?: number
          payment?: number
          purchase_cost?: number
          quantity?: number
          remarks?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string | null
          date?: string
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          outstanding?: number
          payment?: number
          purchase_cost?: number
          quantity?: number
          remarks?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cylinder_purchases_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_purchases_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cylinder_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      cylinder_sizes: {
        Row: {
          active: boolean
          capacity: number | null
          capacity_unit: string | null
          created_at: string
          id: string
          name: string
          volume_liters: number | null
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          capacity_unit?: string | null
          created_at?: string
          id?: string
          name: string
          volume_liters?: number | null
        }
        Update: {
          active?: boolean
          capacity?: number | null
          capacity_unit?: string | null
          created_at?: string
          id?: string
          name?: string
          volume_liters?: number | null
        }
        Relationships: []
      }
      delivery_expenses: {
        Row: {
          created_at: string
          cylinder_karaya: number
          date: string
          driver_id: string | null
          fuel: number
          id: string
          invoice_number: string | null
          labour: number
          loading: number
          miscellaneous: number
          notes: string | null
          toll_tax: number
          total: number
          updated_at: string
          vehicle_id: string | null
          vehicle_rent: number
        }
        Insert: {
          created_at?: string
          cylinder_karaya?: number
          date?: string
          driver_id?: string | null
          fuel?: number
          id?: string
          invoice_number?: string | null
          labour?: number
          loading?: number
          miscellaneous?: number
          notes?: string | null
          toll_tax?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_rent?: number
        }
        Update: {
          created_at?: string
          cylinder_karaya?: number
          date?: string
          driver_id?: string | null
          fuel?: number
          id?: string
          invoice_number?: string | null
          labour?: number
          loading?: number
          miscellaneous?: number
          notes?: string | null
          toll_tax?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_vehicle_id: string | null
          cnic: string | null
          created_at: string
          id: string
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_vehicle_id?: string | null
          cnic?: string | null
          created_at?: string
          id?: string
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_vehicle_id?: string | null
          cnic?: string | null
          created_at?: string
          id?: string
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          id: string
          join_date: string | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          join_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          join_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account: string | null
          amount: number
          bank_account_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          method: string | null
          notes: string | null
          payee: string | null
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          method?: string | null
          notes?: string | null
          payee?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          method?: string | null
          notes?: string | null
          payee?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_purchases: {
        Row: {
          amount: number | null
          bill_number: string | null
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          cubic_meter: number | null
          date: string
          gas_type_id: string | null
          id: string
          invoice_number: string | null
          kg: number | null
          notes: string | null
          purchase_rate: number | null
          quantity: number
          rate: number | null
          remarks: string | null
          supplier_id: string | null
          tank_number: string | null
          total_amount: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          bill_number?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          cubic_meter?: number | null
          date?: string
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          kg?: number | null
          notes?: string | null
          purchase_rate?: number | null
          quantity?: number
          rate?: number | null
          remarks?: string | null
          supplier_id?: string | null
          tank_number?: string | null
          total_amount?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          bill_number?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          cubic_meter?: number | null
          date?: string
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          kg?: number | null
          notes?: string | null
          purchase_rate?: number | null
          quantity?: number
          rate?: number | null
          remarks?: string | null
          supplier_id?: string | null
          tank_number?: string | null
          total_amount?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gas_purchases_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      local_fillings: {
        Row: {
          consumed_unit: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          cylinder_size_id: string | null
          date: string
          filling_rate: number
          gas_consumed: number
          gas_type_id: string | null
          id: string
          invoice_number: string | null
          outstanding: number
          payment: number
          quantity: number
          remarks: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          consumed_unit?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          cylinder_size_id?: string | null
          date?: string
          filling_rate?: number
          gas_consumed?: number
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          outstanding?: number
          payment?: number
          quantity?: number
          remarks?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          consumed_unit?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          cylinder_size_id?: string | null
          date?: string
          filling_rate?: number
          gas_consumed?: number
          gas_type_id?: string | null
          id?: string
          invoice_number?: string | null
          outstanding?: number
          payment?: number
          quantity?: number
          remarks?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_fillings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_fillings_cylinder_size_id_fkey"
            columns: ["cylinder_size_id"]
            isOneToOne: false
            referencedRelation: "cylinder_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_fillings_gas_type_id_fkey"
            columns: ["gas_type_id"]
            isOneToOne: false
            referencedRelation: "gas_types"
            referencedColumns: ["id"]
          },
        ]
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
          account: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          date: string
          id: string
          method: string
          notes: string | null
          payment_type: string | null
          reference_number: string | null
        }
        Insert: {
          account?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          payment_type?: string | null
          reference_number?: string | null
        }
        Update: {
          account?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          payment_type?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
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
          consumed_unit: string | null
          created_at: string
          created_by: string | null
          cylinder_size_id: string
          date: string
          gas_consumed: number | null
          gas_type_id: string
          id: string
          operator_name: string | null
          quantity: number
          remarks: string | null
        }
        Insert: {
          consumed_unit?: string | null
          created_at?: string
          created_by?: string | null
          cylinder_size_id: string
          date?: string
          gas_consumed?: number | null
          gas_type_id: string
          id?: string
          operator_name?: string | null
          quantity: number
          remarks?: string | null
        }
        Update: {
          consumed_unit?: string | null
          created_at?: string
          created_by?: string | null
          cylinder_size_id?: string
          date?: string
          gas_consumed?: number | null
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
          oxygen_conversion_factor: number | null
          plant_opening_stock: number
          tax_percent: number | null
          total_owned_cylinders: number | null
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
          oxygen_conversion_factor?: number | null
          plant_opening_stock?: number
          tax_percent?: number | null
          total_owned_cylinders?: number | null
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
          oxygen_conversion_factor?: number | null
          plant_opening_stock?: number
          tax_percent?: number | null
          total_owned_cylinders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          account: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          method: string | null
          notes: string | null
          payment_type: string | null
          reference_number: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_type?: string | null
          reference_number?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_type?: string | null
          reference_number?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
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
      vehicles: {
        Row: {
          active: boolean
          capacity_cylinders: number | null
          created_at: string
          default_driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          make_model: string | null
          notes: string | null
          per_trip_rent: number | null
          registration_number: string
          status: string | null
          type: string | null
          updated_at: string
          vehicle_name: string | null
        }
        Insert: {
          active?: boolean
          capacity_cylinders?: number | null
          created_at?: string
          default_driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          make_model?: string | null
          notes?: string | null
          per_trip_rent?: number | null
          registration_number: string
          status?: string | null
          type?: string | null
          updated_at?: string
          vehicle_name?: string | null
        }
        Update: {
          active?: boolean
          capacity_cylinders?: number | null
          created_at?: string
          default_driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          make_model?: string | null
          notes?: string | null
          per_trip_rent?: number | null
          registration_number?: string
          status?: string | null
          type?: string | null
          updated_at?: string
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
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
      is_app_user: { Args: { _user_id: string }; Returns: boolean }
      next_invoice_number: { Args: never; Returns: string }
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
