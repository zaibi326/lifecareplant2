-- Part 4: Commercial Production, Finance, Customer/Supplier Upgrades & AI Assistant
-- Fully additive migration. Does not alter or drop existing tables or columns.

-- 1. PRODUCTION TABLE ADDITIONS
ALTER TABLE public.production
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'Morning',
  ADD COLUMN IF NOT EXISTS expected_gas_consumed NUMERIC,
  ADD COLUMN IF NOT EXISTS gas_loss NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS efficiency_percentage NUMERIC DEFAULT 100;

-- 2. CUSTOMERS TABLE ADDITIONS
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_notes TEXT;

-- 3. SUPPLIERS TABLE ADDITIONS
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- Indexes for production batches and dates
CREATE INDEX IF NOT EXISTS idx_production_batch ON public.production(batch_number);
CREATE INDEX IF NOT EXISTS idx_production_shift ON public.production(shift);
