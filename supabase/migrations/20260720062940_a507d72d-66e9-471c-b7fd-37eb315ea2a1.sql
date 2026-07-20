
ALTER TABLE public.gas_purchases
  ADD COLUMN IF NOT EXISTS kg numeric,
  ADD COLUMN IF NOT EXISTS conversion_factor numeric,
  ADD COLUMN IF NOT EXISTS purchase_rate numeric,
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS tank_number text,
  ADD COLUMN IF NOT EXISTS remarks text;

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  type text,
  make_model text,
  driver_name text,
  driver_phone text,
  capacity_cylinders integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles app users all" ON public.vehicles FOR ALL TO authenticated USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
