CREATE TABLE IF NOT EXISTS public.parts_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('valve','spindle')),
  size text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, size)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_stock TO authenticated;
GRANT ALL ON public.parts_stock TO service_role;
ALTER TABLE public.parts_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all parts_stock" ON public.parts_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER parts_stock_updated_at BEFORE UPDATE ON public.parts_stock FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();