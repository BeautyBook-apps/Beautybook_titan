-- Compteurs réels des styles : likes depuis user_like et vues uniques.
CREATE TABLE IF NOT EXISTS public.user_like (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  user_avatar TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_like_unique
  ON public.user_like (user_email, target_id, target_type);

ALTER TABLE public."Style"
  ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.style_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  viewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (style_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS style_view_event_style_idx
  ON public.style_view_event (style_id);

ALTER TABLE public.style_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "style view events insert" ON public.style_view_event;
CREATE POLICY "style view events insert"
  ON public.style_view_event FOR INSERT
  WITH CHECK (viewer_key IS NOT NULL AND length(viewer_key) BETWEEN 8 AND 180);

DROP POLICY IF EXISTS "style view events owner read" ON public.style_view_event;
CREATE POLICY "style view events owner read"
  ON public.style_view_event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Style" s
      WHERE s.id::text = style_view_event.style_id
        AND (s.author_email = auth.jwt()->>'email' OR s.pro_email = auth.jwt()->>'email')
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.record_style_view(
  style_uuid TEXT,
  viewer_key_value TEXT,
  viewer_email_value TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
  next_count INTEGER;
BEGIN
  IF style_uuid IS NULL OR btrim(style_uuid) = ''
     OR viewer_key_value IS NULL OR length(btrim(viewer_key_value)) < 8 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."Style" s WHERE s.id::text = btrim(style_uuid)) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.style_view_event (style_id, viewer_key, viewer_email)
  VALUES (btrim(style_uuid), btrim(viewer_key_value), NULLIF(lower(btrim(viewer_email_value)), ''))
  ON CONFLICT (style_id, viewer_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE public."Style"
    SET views = COALESCE(views, 0) + 1,
        updated_at = COALESCE(updated_at, now())
    WHERE id::text = btrim(style_uuid);
  END IF;

  SELECT COALESCE(views, 0) INTO next_count
  FROM public."Style"
  WHERE id::text = btrim(style_uuid);
  RETURN COALESCE(next_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.record_style_view(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_style_view(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Recalcule les compteurs historiques avant d'installer le trigger.
UPDATE public."Style" s
SET likes = (
  SELECT COUNT(*)::INTEGER
  FROM public.user_like l
  WHERE l.target_type = 'style' AND l.target_id = s.id::text
);

CREATE OR REPLACE FUNCTION public.sync_style_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_style_id TEXT;
  target_type_value TEXT;
BEGIN
  target_style_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
  target_type_value := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_type ELSE NEW.target_type END;
  IF target_type_value = 'style' THEN
    UPDATE public."Style" s
    SET likes = (
      SELECT COUNT(*)::INTEGER
      FROM public.user_like l
      WHERE l.target_type = 'style' AND l.target_id = s.id::text
    )
    WHERE s.id::text = target_style_id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS style_likes_count_sync ON public.user_like;
CREATE TRIGGER style_likes_count_sync
AFTER INSERT OR DELETE ON public.user_like
FOR EACH ROW EXECUTE FUNCTION public.sync_style_likes_count();
