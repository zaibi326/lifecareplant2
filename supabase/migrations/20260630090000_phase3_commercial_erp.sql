-- Phase 3: Commercial Gas Cylinder ERP backbone
-- Additive migration. Does NOT alter or drop existing tables/columns beyond
-- safe ADD COLUMN IF NOT EXISTS. Backward compatible.

-- ============================================================
-- Settings: Oxygen KG -> Cubic Meter conversion factor (editable)
-- ============================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS oxygen_conversion_factor NUMERIC NOT NULL DEFAULT 0.7383;

-- ============================================================
-- Cylinder sizes: gas capacity per cylinder (used to deduct bulk gas)
-- ============================================================
ALTER TABLE public.cylinder_sizes
  ADD COLUMN IF NOT EXISTS capacity NUMERIC,
  ADD COLUMN IF NOT EXISTS capacity_unit TEXT NOT NULL DEFAULT 'm3';

-- ============================================================
-- Production: store computed gas consumption per filling log
-- ============================================================
ALTER TABLE public.production
  ADD COLUMN IF NOT EXISTS gas_consumed NUMERIC,
  ADD COLUMN IF NOT EXISTS consumed_unit TEXT NOT NULL DEFAULT 'm3';

-- ============================================================
-- Suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  ntn_gst TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============================================================
-- Gas purchases (bulk gas received from suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gas_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),   -- original quantity as entered
  unit TEXT NOT NULL DEFAULT 'm3',                  -- 'kg' or 'm3'
  cubic_meter NUMERIC NOT NULL DEFAULT 0,           -- normalised to m3 (converted if kg)
  kg NUMERIC,                                        -- original kg when entered in kg
  conversion_factor NUMERIC,                         -- factor used for kg->m3
  purchase_rate NUMERIC,                             -- rate per unit
  total_amount NUMERIC,                              -- quantity * purchase_rate
  invoice_number TEXT,
  tank_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gas_purchases TO authenticated;
GRANT ALL ON public.gas_purchases TO service_role;
ALTER TABLE public.gas_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all gas_purchases" ON public.gas_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_gas_purchases_gas ON public.gas_purchases(gas_type_id);
CREATE INDEX IF NOT EXISTS idx_gas_purchases_supplier ON public.gas_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_gas_purchases_date ON public.gas_purchases(date);

-- ============================================================
-- Expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,   -- Electricity, Diesel, Labour, Repairs, Vehicle, Office, Miscellaneous
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payee TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- ============================================================
-- Seed sensible capacities for common cylinder sizes (only when NULL)
-- ============================================================
UPDATE public.cylinder_sizes SET capacity = 9.90,  capacity_unit = 'm3' WHERE name = '9.90'  AND capacity IS NULL;
UPDATE public.cylinder_sizes SET capacity = 6.35,  capacity_unit = 'm3' WHERE name = '6.35'  AND capacity IS NULL;
UPDATE public.cylinder_sizes SET capacity = 12.50, capacity_unit = 'm3' WHERE name = '12.50' AND capacity IS NULL;
