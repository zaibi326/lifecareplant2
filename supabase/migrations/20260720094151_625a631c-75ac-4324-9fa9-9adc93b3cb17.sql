
-- vehicles new columns
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_name TEXT,
  ADD COLUMN IF NOT EXISTS per_trip_rent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_driver_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- drivers table
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage drivers" ON public.drivers FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- FK for vehicles.default_driver_id (after drivers table exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_default_driver_id_fkey') THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_default_driver_id_fkey
      FOREIGN KEY (default_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- cylinder_movements new columns
ALTER TABLE public.cylinder_movements
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- delivery_expenses table
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_expenses TO authenticated;
GRANT ALL ON public.delivery_expenses TO service_role;
ALTER TABLE public.delivery_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage delivery expenses" ON public.delivery_expenses FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid())) WITH CHECK (public.is_app_user(auth.uid()));
CREATE TRIGGER delivery_expenses_updated_at BEFORE UPDATE ON public.delivery_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
