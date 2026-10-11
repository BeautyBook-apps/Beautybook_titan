-- Champs utilisés par les annonces immobilières et la visite virtuelle.
-- Cette migration est additive : les annonces existantes sont conservées.
ALTER TABLE public."ImmobilierListing"
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '/MOIS',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS equip TEXT,
  ADD COLUMN IF NOT EXISTS extra TEXT,
  ADD COLUMN IF NOT EXISTS seats_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estimated_turnover NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_net_revenue NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_tour_id UUID;

UPDATE public."ImmobilierListing"
SET seats_count = COALESCE(seats_count, 1)
WHERE seats_count IS NULL;

CREATE INDEX IF NOT EXISTS immobilier_listing_virtual_tour_idx
  ON public."ImmobilierListing" (virtual_tour_id);
