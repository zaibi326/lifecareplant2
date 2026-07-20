-- Phase 6: Customer price lists + multi-branch scaffolding.
-- Additive, backward compatible.

-- ============================================================
-- Branches — scaffolding for multi-branch operations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Seed a default branch so existing data has a home.
INSERT INTO public.branches (name, code, is_default)
SELECT 'Main Plant', 'MAIN', true
WHERE NOT EXISTS (SELECT 1 FROM public.branches);

-- Add nullable branch_id to transactional tables (no backfill required; null = default branch).
ALTER TABLE public.cylinder_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payments          ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.gas_purchases     ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.production        ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.expenses          ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- ============================================================
-- Customer price list — per customer, gas + size specific rate
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id) ON DELETE CASCADE,
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE CASCADE,
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (customer_id, gas_type_id, cylinder_size_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_prices TO authenticated;
GRANT ALL ON public.customer_prices TO service_role;
ALTER TABLE public.customer_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customer_prices" ON public.customer_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER customer_prices_updated_at BEFORE UPDATE ON public.customer_prices FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE INDEX IF NOT EXISTS idx_customer_prices_customer ON public.customer_prices(customer_id);
