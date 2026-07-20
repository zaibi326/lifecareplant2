-- Phase 7: Vehicle rent, drivers, delivery expenses, rental settings.
-- Additive, backward compatible.

-- ============================================================
-- Vehicle master extensions (rent + fuel + default driver)
-- ============================================================
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_name TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS default_driver_id UUID,
  ADD COLUMN IF NOT EXISTS daily_rent NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC,
  ADD COLUMN IF NOT EXISTS per_trip_rent NUMERIC;

-- ============================================================
-- Drivers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  license_number TEXT,
  assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all drivers" ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Link vehicles.default_driver_id after drivers exists (deferred FK via constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vehicles_default_driver_fk'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_default_driver_fk
      FOREIGN KEY (default_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Delivery expenses (linked to a delivery invoice; also mirrored in expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_rent NUMERIC NOT NULL DEFAULT 0,
  fuel NUMERIC NOT NULL DEFAULT 0,
  labour NUMERIC NOT NULL DEFAULT 0,
  loading NUMERIC NOT NULL DEFAULT 0,
  toll_tax NUMERIC NOT NULL DEFAULT 0,
  miscellaneous NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_expenses TO authenticated;
GRANT ALL ON public.delivery_expenses TO service_role;
ALTER TABLE public.delivery_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all delivery_expenses" ON public.delivery_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_delivery_expenses_date ON public.delivery_expenses(date);

-- Tag movements with vehicle/driver ids (keeps text fields for backward compat).
ALTER TABLE public.cylinder_movements
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- ============================================================
-- Cylinder rental settings + per-customer rental config
-- ============================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS rental_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rental_period TEXT NOT NULL DEFAULT 'daily',   -- daily | weekly | monthly
  ADD COLUMN IF NOT EXISTS rental_rate NUMERIC NOT NULL DEFAULT 0;        -- default rate per cylinder per period

CREATE TABLE IF NOT EXISTS public.rental_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  gas_type_id UUID REFERENCES public.gas_types(id) ON DELETE CASCADE,
  cylinder_size_id UUID REFERENCES public.cylinder_sizes(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'daily',    -- daily | weekly | monthly
  rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_rates TO authenticated;
GRANT ALL ON public.rental_rates TO service_role;
ALTER TABLE public.rental_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all rental_rates" ON public.rental_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER rental_rates_updated_at BEFORE UPDATE ON public.rental_rates FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
