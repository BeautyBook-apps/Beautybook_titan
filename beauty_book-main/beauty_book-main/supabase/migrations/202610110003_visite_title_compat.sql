ALTER TABLE public."VisiteVirtuelle"
  ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE public."VisiteVirtuelle"
SET title = COALESCE(title, name)
WHERE title IS NULL;
