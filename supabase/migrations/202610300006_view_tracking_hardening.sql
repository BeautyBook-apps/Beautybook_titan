-- Fiabilise le comptage des vues pour les visiteurs connectés et anonymes.
-- Un même profil/appareil ne compte qu'une fois par publication.

ALTER TABLE public."Reel"
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.reel_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public."Reel"(id) ON DELETE CASCADE,
  viewer_email TEXT DEFAULT '',
  session_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reel_view_event_unique_daily
  ON public.reel_view_event (reel_id, session_key);

ALTER TABLE public.reel_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel view events insert" ON public.reel_view_event;
CREATE POLICY "reel view events insert"
  ON public.reel_view_event FOR INSERT
  WITH CHECK (session_key IS NOT NULL AND length(session_key) BETWEEN 8 AND 160);

CREATE OR REPLACE FUNCTION public.record_reel_view(
  reel_uuid UUID,
  viewer_session TEXT,
  viewer_email_value TEXT DEFAULT ''
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
  IF reel_uuid IS NULL OR length(btrim(coalesce(viewer_session, ''))) < 8 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."Reel" r WHERE r.id = reel_uuid) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.reel_view_event (reel_id, viewer_email, session_key)
  VALUES (
    reel_uuid,
    left(coalesce(viewer_email_value, ''), 320),
    left(btrim(viewer_session), 160)
  )
  ON CONFLICT (reel_id, session_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE public."Reel"
    SET views = COALESCE(views, 0) + 1,
        updated_at = COALESCE(updated_at, now())
    WHERE id = reel_uuid;
  END IF;

  SELECT COALESCE(views, 0) INTO next_count
  FROM public."Reel"
  WHERE id = reel_uuid;
  RETURN COALESCE(next_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.record_reel_view(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_reel_view(UUID, TEXT, TEXT) TO anon, authenticated;

-- Garantit aussi la présence du compteur Style lorsque seule cette migration
-- est déployée sur une base existante.
ALTER TABLE public."Style"
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.style_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  viewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (style_id, viewer_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS style_view_event_unique_viewer
  ON public.style_view_event (style_id, viewer_key);

ALTER TABLE public.style_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "style view events insert" ON public.style_view_event;
CREATE POLICY "style view events insert"
  ON public.style_view_event FOR INSERT
  WITH CHECK (viewer_key IS NOT NULL AND length(viewer_key) BETWEEN 8 AND 180);

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
