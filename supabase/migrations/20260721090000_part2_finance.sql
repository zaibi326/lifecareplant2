-- Part 2: Finance, Payments, Ledgers & Business Dashboard
-- Fully additive. Does NOT alter/drop existing tables or columns, does NOT
-- change Part 1 business logic. Uses simple business language (no debit/credit).
--
-- Balances (cash in hand, bank balance, customer/supplier outstanding) are
-- computed in the app layer from these rows — matching the existing codebase
-- convention of deriving figures from source records rather than triggers.

-- ============================================================
-- 1. BANK ACCOUNTS
--    Multiple bank accounts, each with an opening balance. Current balance is
--    computed = opening + bank-in − bank-out (payments/expenses/supplier pays).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_title TEXT,
  account_number TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all bank_accounts" ON public.bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============================================================
-- 2. SUPPLIER PAYMENTS
--    Amounts we pay suppliers (cash or bank). type = payment | advance.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  account TEXT NOT NULL DEFAULT 'cash',        -- cash | bank
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL DEFAULT 'payment',-- payment | advance
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all supplier_payments" ON public.supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON public.supplier_payments(date);

-- ============================================================
-- 3. CUSTOMER PAYMENTS — extend existing table (backward compatible)
--    account: which pot the money lands in (cash | bank)
--    payment_type: payment | advance | partial | credit
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'payment';

-- Best-effort backfill of `account` from the legacy `method` text so old rows
-- classify correctly for cash/bank balances. Cash stays cash; everything else
-- (bank/cheque/online/transfer) is treated as bank money.
UPDATE public.payments
   SET account = CASE WHEN lower(coalesce(method,'')) IN ('cash') THEN 'cash' ELSE 'bank' END
 WHERE account IS NULL OR account = 'cash';

-- ============================================================
-- 4. CASH ADJUSTMENTS
--    Manual cash in/out that isn't a payment/expense: owner withdrawal,
--    cash injection, corrections. direction = in | out.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL DEFAULT 'out',   -- in | out
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_adjustments TO authenticated;
GRANT ALL ON public.cash_adjustments TO service_role;
ALTER TABLE public.cash_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cash_adjustments" ON public.cash_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cash_adjustments_date ON public.cash_adjustments(date);

-- ============================================================
-- 5. EXPENSES — account routing + custom categories
-- ============================================================
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'cash',   -- cash | bank
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all expense_categories" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the standard categories (skip if already present).
INSERT INTO public.expense_categories (name)
SELECT c FROM (VALUES
  ('Vehicle'), ('Fuel'), ('Electricity'), ('Salary'), ('Labour'),
  ('Loading'), ('Repairs'), ('Maintenance'), ('Office'), ('Internet'),
  ('Miscellaneous')
) AS t(c)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories ec WHERE ec.name = t.c);
