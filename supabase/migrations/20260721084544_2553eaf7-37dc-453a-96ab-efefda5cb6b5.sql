
-- Bank accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  account_title TEXT,
  account_number TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Supplier payments
CREATE TABLE public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  method TEXT,
  account TEXT DEFAULT 'cash',
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage supplier_payments" ON public.supplier_payments FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_supplier_payments_updated BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Cash adjustments
CREATE TABLE public.cash_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT NOT NULL DEFAULT 'out',
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_adjustments TO authenticated;
GRANT ALL ON public.cash_adjustments TO service_role;
ALTER TABLE public.cash_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage cash_adjustments" ON public.cash_adjustments FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_cash_adjustments_updated BEFORE UPDATE ON public.cash_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Cylinder exchanges
CREATE TABLE public.cylinder_exchanges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  gas_type_id UUID REFERENCES public.gas_types(id) ON DELETE SET NULL,
  cylinder_size_id UUID REFERENCES public.cylinder_sizes(id) ON DELETE SET NULL,
  empties_out INTEGER NOT NULL DEFAULT 0,
  filled_in INTEGER NOT NULL DEFAULT 0,
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_exchanges TO authenticated;
GRANT ALL ON public.cylinder_exchanges TO service_role;
ALTER TABLE public.cylinder_exchanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage cylinder_exchanges" ON public.cylinder_exchanges FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_cylinder_exchanges_updated BEFORE UPDATE ON public.cylinder_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Cylinder purchases
CREATE TABLE public.cylinder_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  gas_type_id UUID REFERENCES public.gas_types(id) ON DELETE SET NULL,
  cylinder_size_id UUID REFERENCES public.cylinder_sizes(id) ON DELETE SET NULL,
  condition TEXT NOT NULL DEFAULT 'empty',
  quantity INTEGER NOT NULL DEFAULT 0,
  purchase_cost NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment NUMERIC NOT NULL DEFAULT 0,
  outstanding NUMERIC NOT NULL DEFAULT 0,
  invoice_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_purchases TO authenticated;
GRANT ALL ON public.cylinder_purchases TO service_role;
ALTER TABLE public.cylinder_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage cylinder_purchases" ON public.cylinder_purchases FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER trg_cylinder_purchases_updated BEFORE UPDATE ON public.cylinder_purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Missing columns on payments and expenses
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS account TEXT DEFAULT 'cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_type TEXT;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account TEXT DEFAULT 'cash';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
