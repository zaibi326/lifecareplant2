
-- Local fillings
CREATE TABLE public.local_fillings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  gas_type_id UUID REFERENCES public.gas_types(id) ON DELETE SET NULL,
  cylinder_size_id UUID REFERENCES public.cylinder_sizes(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  filling_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  gas_consumed NUMERIC NOT NULL DEFAULT 0,
  consumed_unit TEXT DEFAULT 'm3',
  payment NUMERIC NOT NULL DEFAULT 0,
  outstanding NUMERIC NOT NULL DEFAULT 0,
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_fillings TO authenticated;
GRANT ALL ON public.local_fillings TO service_role;
ALTER TABLE public.local_fillings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage local_fillings" ON public.local_fillings FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_local_fillings_updated BEFORE UPDATE ON public.local_fillings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Expense categories
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage expense_categories" ON public.expense_categories FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Active flag on bank_accounts
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
