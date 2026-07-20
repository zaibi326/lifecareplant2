
-- Add missing columns
ALTER TABLE public.settings 
  ADD COLUMN IF NOT EXISTS oxygen_conversion_factor numeric DEFAULT 0.7383,
  ADD COLUMN IF NOT EXISTS total_owned_cylinders integer DEFAULT 0;

ALTER TABLE public.cylinder_sizes
  ADD COLUMN IF NOT EXISTS capacity numeric,
  ADD COLUMN IF NOT EXISTS capacity_unit text DEFAULT 'm3';

ALTER TABLE public.production
  ADD COLUMN IF NOT EXISTS gas_consumed numeric,
  ADD COLUMN IF NOT EXISTS consumed_unit text DEFAULT 'm3';

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  summary text,
  user_id uuid,
  user_email text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log app users read" ON public.audit_log FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));
CREATE POLICY "audit_log app users insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));

-- suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers app users all" ON public.suppliers FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));

-- gas_purchases
CREATE TABLE IF NOT EXISTS public.gas_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  gas_type_id uuid REFERENCES public.gas_types(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'm3',
  cubic_meter numeric,
  rate numeric,
  amount numeric,
  bill_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gas_purchases TO authenticated;
GRANT ALL ON public.gas_purchases TO service_role;
ALTER TABLE public.gas_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gas_purchases app users all" ON public.gas_purchases FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));

-- expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  category text,
  payee text,
  amount numeric NOT NULL DEFAULT 0,
  method text DEFAULT 'cash',
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses app users all" ON public.expenses FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));

-- employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  role text,
  salary numeric,
  join_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees app users all" ON public.employees FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));

-- customer_prices
CREATE TABLE IF NOT EXISTS public.customer_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  gas_type_id uuid NOT NULL REFERENCES public.gas_types(id) ON DELETE CASCADE,
  cylinder_size_id uuid NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, gas_type_id, cylinder_size_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_prices TO authenticated;
GRANT ALL ON public.customer_prices TO service_role;
ALTER TABLE public.customer_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_prices app users all" ON public.customer_prices FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
