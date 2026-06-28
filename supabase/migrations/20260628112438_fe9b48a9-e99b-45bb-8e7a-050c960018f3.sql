CREATE TABLE public.customer_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  gas_type_id uuid NOT NULL REFERENCES public.gas_types(id) ON DELETE RESTRICT,
  cylinder_size_id uuid NOT NULL REFERENCES public.cylinder_sizes(id) ON DELETE RESTRICT,
  condition public.cylinder_condition NOT NULL DEFAULT 'filled',
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, gas_type_id, cylinder_size_id, condition)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_opening_balances TO authenticated;
GRANT ALL ON public.customer_opening_balances TO service_role;

ALTER TABLE public.customer_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all customer_opening_balances"
  ON public.customer_opening_balances FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_customer_opening_balances_updated_at
  BEFORE UPDATE ON public.customer_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX idx_cob_customer ON public.customer_opening_balances(customer_id);