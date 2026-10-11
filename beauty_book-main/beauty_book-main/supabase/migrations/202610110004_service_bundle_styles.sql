-- Permet d'associer plusieurs publications Style à un bundle.
ALTER TABLE IF EXISTS public."ServiceBundle"
  ADD COLUMN IF NOT EXISTS style_ids TEXT[] DEFAULT '{}';
