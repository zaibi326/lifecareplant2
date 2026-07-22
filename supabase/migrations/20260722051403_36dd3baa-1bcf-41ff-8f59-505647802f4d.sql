ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS ntn_gst text,
  ADD COLUMN IF NOT EXISTS notes text;