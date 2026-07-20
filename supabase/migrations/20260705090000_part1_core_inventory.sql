-- Part 1: Core Inventory & Stock Automation
-- Adds the three workflows missing from the current ERP:
--   1. Local Gas Filling  (fill customer's own cylinders; bulk gas ↓, revenue ↑, NO stock change)
--   2. Supplier Cylinder Exchange (empties out / filled in; owned NO change, plant filled/empty adjust)
--   3. New Cylinder Purchase (owned ↑, plant stock ↑, supplier payable ↑)
-- Fully additive. Does NOT alter or drop any existing table/column. Backward compatible.

-- ============================================================
-- 1. LOCAL GAS FILLING
--    Customer brings own cylinders → plant fills them → customer takes them back.
--    Plant/customer/owned cylinder stock UNCHANGED. Only bulk gas is consumed.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.local_fillings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,  -- optional walk-in
  customer_name TEXT,                                                    -- fallback for walk-in
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id) ON DELETE RESTRICT,
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  filling_rate NUMERIC NOT NULL DEFAULT 0,        -- charge per cylinder
  total_amount NUMERIC NOT NULL DEFAULT 0,        -- quantity * filling_rate
  gas_consumed NUMERIC NOT NULL DEFAULT 0,        -- m3 deducted from bulk (quantity * size capacity)
  consumed_unit TEXT NOT NULL DEFAULT 'm3',
  payment NUMERIC NOT NULL DEFAULT 0,             -- amount received
  outstanding NUMERIC NOT NULL DEFAULT 0,         -- total_amount - payment
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_fillings TO authenticated;
GRANT ALL ON public.local_fillings TO service_role;
ALTER TABLE public.local_fillings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all local_fillings" ON public.local_fillings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_local_fillings_date ON public.local_fillings(date);
CREATE INDEX IF NOT EXISTS idx_local_fillings_customer ON public.local_fillings(customer_id);
CREATE INDEX IF NOT EXISTS idx_local_fillings_gas ON public.local_fillings(gas_type_id);

-- ============================================================
-- 2. SUPPLIER CYLINDER EXCHANGE
--    Supplier collects N empties and delivers N filled (same gas/size).
--    Owned cylinders NO change. Plant: empty ↓ by out_qty, filled ↑ by in_qty.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cylinder_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id) ON DELETE RESTRICT,
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE RESTRICT,
  empties_out NUMERIC NOT NULL DEFAULT 0,   -- empty cylinders handed to supplier
  filled_in NUMERIC NOT NULL DEFAULT 0,     -- filled cylinders received from supplier
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_exchanges TO authenticated;
GRANT ALL ON public.cylinder_exchanges TO service_role;
ALTER TABLE public.cylinder_exchanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cylinder_exchanges" ON public.cylinder_exchanges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cylinder_exchanges_date ON public.cylinder_exchanges(date);
CREATE INDEX IF NOT EXISTS idx_cylinder_exchanges_supplier ON public.cylinder_exchanges(supplier_id);

-- ============================================================
-- 3. NEW CYLINDER PURCHASE
--    Buying brand-new cylinders. Increases owned fleet + plant stock.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cylinder_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  gas_type_id UUID REFERENCES public.gas_types(id) ON DELETE SET NULL,
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  condition TEXT NOT NULL DEFAULT 'empty',   -- filled | empty | unknown
  purchase_cost NUMERIC NOT NULL DEFAULT 0,  -- cost per cylinder
  total_amount NUMERIC NOT NULL DEFAULT 0,   -- quantity * purchase_cost
  payment NUMERIC NOT NULL DEFAULT 0,
  outstanding NUMERIC NOT NULL DEFAULT 0,    -- payable to supplier
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_purchases TO authenticated;
GRANT ALL ON public.cylinder_purchases TO service_role;
ALTER TABLE public.cylinder_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cylinder_purchases" ON public.cylinder_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cylinder_purchases_date ON public.cylinder_purchases(date);
CREATE INDEX IF NOT EXISTS idx_cylinder_purchases_supplier ON public.cylinder_purchases(supplier_id);

-- ============================================================
-- Delivery ledger fields (Part 1 §1): capture filled/empty/unknown split,
-- payment and outstanding directly on the delivery movement. Additive so the
-- existing single-quantity flow keeps working (defaults preserve behaviour).
-- ============================================================
ALTER TABLE public.cylinder_movements
  ADD COLUMN IF NOT EXISTS filled_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS empty_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS unknown_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS payment NUMERIC,
  ADD COLUMN IF NOT EXISTS outstanding NUMERIC;
