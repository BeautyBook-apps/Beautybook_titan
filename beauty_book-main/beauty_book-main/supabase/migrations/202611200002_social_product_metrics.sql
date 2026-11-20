-- Durable, deduplicated view counts for Reels and shop products.
-- A viewer contributes at most one view per item and stable viewer session.

CREATE TABLE IF NOT EXISTS public.reel_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public."Reel"(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  viewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reel_id, session_key)
);

ALTER TABLE public.reel_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_view_event public read" ON public.reel_view_event;
CREATE POLICY "reel_view_event public read" ON public.reel_view_event FOR SELECT USING (true);
GRANT SELECT ON public.reel_view_event TO anon, authenticated;

DROP FUNCTION IF EXISTS public.record_reel_view(UUID, TEXT, TEXT);
CREATE FUNCTION public.record_reel_view(
  reel_uuid UUID,
  viewer_session TEXT,
  viewer_email_value TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_rows INTEGER;
  current_views INTEGER;
BEGIN
  INSERT INTO public.reel_view_event (reel_id, session_key, viewer_email)
  VALUES (reel_uuid, left(viewer_session, 160), nullif(lower(left(viewer_email_value, 320)), ''))
  ON CONFLICT (reel_id, session_key) DO NOTHING;
  GET DIAGNOSTICS inserted_rows = ROW_COUNT;

  IF inserted_rows > 0 THEN
    UPDATE public."Reel"
    SET views = COALESCE(views, 0) + 1
    WHERE id = reel_uuid
    RETURNING views INTO current_views;
  ELSE
    SELECT COALESCE(views, 0) INTO current_views
    FROM public."Reel" WHERE id = reel_uuid;
  END IF;

  RETURN COALESCE(current_views, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_reel_view(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.product_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  viewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, session_key)
);

CREATE INDEX IF NOT EXISTS product_view_event_product_id_idx
  ON public.product_view_event (product_id);
ALTER TABLE public.product_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_view_event public read" ON public.product_view_event;
CREATE POLICY "product_view_event public read" ON public.product_view_event FOR SELECT USING (true);
GRANT SELECT ON public.product_view_event TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_product_view(
  product_key TEXT,
  viewer_session_key TEXT,
  viewer_email_value TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_rows INTEGER;
  total_views INTEGER;
BEGIN
  INSERT INTO public.product_view_event (product_id, session_key, viewer_email)
  VALUES (left(product_key, 500), left(viewer_session_key, 160), nullif(lower(left(viewer_email_value, 320)), ''))
  ON CONFLICT (product_id, session_key) DO NOTHING;
  GET DIAGNOSTICS inserted_rows = ROW_COUNT;

  SELECT count(*)::INTEGER INTO total_views
  FROM public.product_view_event
  WHERE product_id = left(product_key, 500);
  RETURN COALESCE(total_views, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_product_view(TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
