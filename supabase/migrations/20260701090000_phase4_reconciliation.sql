-- Phase 4: Stock reconciliation support
-- Adds a configurable total owned cylinder fleet count used to reconcile
-- Owned = Plant + Customers (difference should always be zero).
-- Additive, backward compatible.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS total_owned_cylinders NUMERIC NOT NULL DEFAULT 0;
