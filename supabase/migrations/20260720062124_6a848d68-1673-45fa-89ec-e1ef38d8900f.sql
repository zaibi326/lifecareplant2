
-- Helper: is caller a staff or admin app user?
CREATE OR REPLACE FUNCTION public.is_app_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','staff')
  )
$$;

REVOKE ALL ON FUNCTION public.is_app_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_user(uuid) TO authenticated;

-- Fix trigger function search_path
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'deliver' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

-- Lock down SECURITY DEFINER functions from anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace permissive "always true" ALL policies with role-gated policies
DROP POLICY IF EXISTS "auth all customers" ON public.customers;
CREATE POLICY "staff manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "auth all movements" ON public.cylinder_movements;
CREATE POLICY "staff manage movements" ON public.cylinder_movements
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "auth all payments" ON public.payments;
CREATE POLICY "staff manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "auth all customer_opening_balances" ON public.customer_opening_balances;
CREATE POLICY "staff manage opening balances" ON public.customer_opening_balances
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "auth all production" ON public.production;
CREATE POLICY "staff manage production" ON public.production
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "auth all sizes" ON public.cylinder_sizes;
CREATE POLICY "staff read sizes" ON public.cylinder_sizes
  FOR SELECT TO authenticated
  USING (public.is_app_user(auth.uid()));
CREATE POLICY "admin write sizes" ON public.cylinder_sizes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "auth all gas_types" ON public.gas_types;
CREATE POLICY "staff read gas_types" ON public.gas_types
  FOR SELECT TO authenticated
  USING (public.is_app_user(auth.uid()));
CREATE POLICY "admin write gas_types" ON public.gas_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "auth all part_sizes" ON public.part_sizes;
CREATE POLICY "staff read part_sizes" ON public.part_sizes
  FOR SELECT TO authenticated
  USING (public.is_app_user(auth.uid()));
CREATE POLICY "admin write part_sizes" ON public.part_sizes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "auth all parts_stock" ON public.parts_stock;
CREATE POLICY "staff manage parts_stock" ON public.parts_stock
  FOR ALL TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

-- Profiles: own row or admin
DROP POLICY IF EXISTS "auth read profiles" ON public.profiles;
CREATE POLICY "read own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

-- User roles: own row or admin; admin-only writes
DROP POLICY IF EXISTS "auth read roles" ON public.user_roles;
CREATE POLICY "read own roles or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Movement photos: only owner can read
DROP POLICY IF EXISTS "auth read movement photos" ON storage.objects;
CREATE POLICY "read own movement photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'movement-photos' AND owner = auth.uid());
