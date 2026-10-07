-- Form fields previously added by a browser-side exec_sql call belong in a
-- reviewed migration. No change to RLS or administrative permissions.
BEGIN;
ALTER TABLE public."Style"
  ADD COLUMN IF NOT EXISTS subcategory text DEFAULT '',
  ADD COLUMN IF NOT EXISTS produits_utilises jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS outils_utilises jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS type_cheveux text DEFAULT '',
  ADD COLUMN IF NOT EXISTS type_peau text DEFAULT '',
  ADD COLUMN IF NOT EXISTS type_prestation text DEFAULT '',
  ADD COLUMN IF NOT EXISTS temps_moyen text DEFAULT '',
  ADD COLUMN IF NOT EXISTS niveau_difficulte text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mots_cles jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public."ImmobilierListing"
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;
COMMIT;
