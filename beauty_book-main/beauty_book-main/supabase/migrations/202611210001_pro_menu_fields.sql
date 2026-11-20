-- Persist professional menu and profile fields edited in ModifierProfilPro.
ALTER TABLE public."ProfilPro"
  ADD COLUMN IF NOT EXISTS commodites TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seats_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS menu_restaurant JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_bar JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_services JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
