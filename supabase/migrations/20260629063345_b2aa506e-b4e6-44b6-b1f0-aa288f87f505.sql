CREATE TABLE IF NOT EXISTS public.part_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_sizes TO authenticated;
GRANT ALL ON public.part_sizes TO service_role;
ALTER TABLE public.part_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all part_sizes" ON public.part_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER part_sizes_updated_at BEFORE UPDATE ON public.part_sizes FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

INSERT INTO public.part_sizes (label, sort_order) VALUES
  ('1"', 10), ('1.15"', 20), ('1.30"', 30), ('1.45"', 40), ('2"', 50)
ON CONFLICT (label) DO NOTHING;