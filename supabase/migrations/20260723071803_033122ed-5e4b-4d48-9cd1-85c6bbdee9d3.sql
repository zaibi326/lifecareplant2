UPDATE public.cylinder_sizes
SET capacity = NULLIF(regexp_replace(name, '[^0-9.]', '', 'g'), '')::numeric,
    capacity_unit = CASE WHEN name ILIKE '%cft%' THEN 'cft' ELSE 'm3' END
WHERE capacity IS NULL;

UPDATE public.local_fillings lf
SET gas_consumed = CASE
  WHEN cs.capacity_unit = 'cft' THEN cs.capacity * lf.quantity * 0.0283168
  ELSE cs.capacity * lf.quantity
END,
consumed_unit = 'm3'
FROM public.cylinder_sizes cs
WHERE cs.id = lf.cylinder_size_id
  AND (lf.gas_consumed IS NULL OR lf.gas_consumed = 0)
  AND cs.capacity IS NOT NULL;