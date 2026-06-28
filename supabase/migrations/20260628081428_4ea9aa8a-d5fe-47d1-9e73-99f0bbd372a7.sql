
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','staff');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "user inserts own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

-- Auto create profile + first user becomes admin, others staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles(id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Gas types
CREATE TABLE public.gas_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  color TEXT DEFAULT '#2563eb',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gas_types TO authenticated;
GRANT ALL ON public.gas_types TO service_role;
ALTER TABLE public.gas_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all gas_types" ON public.gas_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cylinder sizes
CREATE TABLE public.cylinder_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  volume_liters NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_sizes TO authenticated;
GRANT ALL ON public.cylinder_sizes TO service_role;
ALTER TABLE public.cylinder_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sizes" ON public.cylinder_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  category TEXT,
  opening_cylinders INT NOT NULL DEFAULT 0,
  opening_due NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Movement type
CREATE TYPE public.movement_type AS ENUM ('receive','deliver');
CREATE TYPE public.cylinder_condition AS ENUM ('filled','empty','unknown');

-- Cylinder movements
CREATE TABLE public.cylinder_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.movement_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id) ON DELETE RESTRICT,
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  condition public.cylinder_condition DEFAULT 'unknown',
  rate NUMERIC,
  total_amount NUMERIC,
  vehicle_number TEXT,
  driver_name TEXT,
  remarks TEXT,
  photo_urls TEXT[],
  invoice_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cylinder_movements TO authenticated;
GRANT ALL ON public.cylinder_movements TO service_role;
ALTER TABLE public.cylinder_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all movements" ON public.cylinder_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_movements_customer ON public.cylinder_movements(customer_id);
CREATE INDEX idx_movements_date ON public.cylinder_movements(date);

-- Invoice number sequence + auto generation on deliver
CREATE SEQUENCE public.invoice_seq START 1001;
CREATE OR REPLACE FUNCTION public.tg_assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'deliver' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER movements_invoice BEFORE INSERT ON public.cylinder_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_assign_invoice_number();

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'Cash',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_payments_customer ON public.payments(customer_id);

-- Production
CREATE TABLE public.production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  gas_type_id UUID NOT NULL REFERENCES public.gas_types(id),
  cylinder_size_id UUID NOT NULL REFERENCES public.cylinder_sizes(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  operator_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production TO authenticated;
GRANT ALL ON public.production TO service_role;
ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all production" ON public.production FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings singleton
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT DEFAULT 'GasFlow Pro',
  company_address TEXT,
  company_phone TEXT,
  currency TEXT DEFAULT 'Rs',
  tax_percent NUMERIC DEFAULT 0,
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_footer TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write settings" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.settings(id) VALUES (1);

-- Seed gas types
INSERT INTO public.gas_types(name, code, color) VALUES
  ('Oxygen','OXY','#2563eb'),
  ('Argon','AR','#7c3aed'),
  ('CO2','CO2','#059669'),
  ('Nitrogen','N2','#0891b2'),
  ('DA','DA','#d97706'),
  ('LPG','LPG','#dc2626'),
  ('Helium','HE','#db2777'),
  ('Hydrogen','H2','#0ea5e9'),
  ('Acetylene','C2H2','#ea580c');

INSERT INTO public.cylinder_sizes(name, volume_liters) VALUES
  ('47L', 47),
  ('50L', 50),
  ('7m³', 7000),
  ('Small', 10),
  ('Large', 80);
