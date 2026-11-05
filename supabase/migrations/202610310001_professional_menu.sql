-- Persist professional restaurant and bar menus used by the profile editor
-- and rendered by the client-facing professional view.
ALTER TABLE public."ProfilPro"
  ADD COLUMN IF NOT EXISTS menu_restaurant jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_bar jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_services jsonb NOT NULL DEFAULT '[]'::jsonb;

