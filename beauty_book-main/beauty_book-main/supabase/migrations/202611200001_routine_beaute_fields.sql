-- Add every field used by the beauty routine editor and dashboard.
-- Safe to run more than once against an existing Supabase project.
ALTER TABLE public."RoutineBeaute"
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'bg-blue-100',
  ADD COLUMN IF NOT EXISTS days_of_week JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
  ADD COLUMN IF NOT EXISTS time TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS objectif TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS objectif_duree_semaines INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS objectif_debut TEXT,
  ADD COLUMN IF NOT EXISTS sessions_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_faites INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_done_date TEXT;

NOTIFY pgrst, 'reload schema';
