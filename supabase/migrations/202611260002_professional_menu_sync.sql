-- Keep the restaurant menu entered during Devenir Pro until it is promoted
-- to ProfilPro, so the onboarding flow and the profile editor share one shape.
ALTER TABLE public."DemandeProV2"
  ADD COLUMN IF NOT EXISTS menu_restaurant JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_bar JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."ProfilPro"
  ADD COLUMN IF NOT EXISTS menu_restaurant JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_bar JSONB NOT NULL DEFAULT '[]'::jsonb;
