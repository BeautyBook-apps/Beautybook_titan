ALTER TABLE public."ImmobilierListing"
  ADD COLUMN IF NOT EXISTS estimated_turnover NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_net_revenue NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_tour_id UUID;

COMMENT ON COLUMN public."ImmobilierListing".estimated_turnover IS 'Chiffre d''affaires mensuel estimé affiché sur la fiche publique.';
COMMENT ON COLUMN public."ImmobilierListing".estimated_net_revenue IS 'Revenu net mensuel estimé affiché sur la fiche publique.';
COMMENT ON COLUMN public."ImmobilierListing".virtual_tour_id IS 'VisiteVirtuelle synchronisée avec la fiche immobilière.';
