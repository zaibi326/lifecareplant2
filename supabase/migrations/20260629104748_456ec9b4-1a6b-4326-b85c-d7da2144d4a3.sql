CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'INV-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated, service_role;