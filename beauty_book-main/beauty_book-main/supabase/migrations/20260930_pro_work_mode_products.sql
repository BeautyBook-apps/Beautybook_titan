-- Mode de travail + produits à commander (agent vocal : mèches, frais domicile)
-- À exécuter dans l'éditeur SQL Supabase.
ALTER TABLE public."ProfilPro"
  ADD COLUMN IF NOT EXISTS se_deplace BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS travail_nuit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS produits JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public."ProfilPro".produits IS 'Produits que le salon peut commander pour le client (nom, prix, délai de livraison) — annoncés par l''agent vocal.';
