-- Persist style engagement metrics used by the admin dashboard.
ALTER TABLE public."Style"
  ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;

UPDATE public."Style"
SET shares = 0
WHERE shares IS NULL;
