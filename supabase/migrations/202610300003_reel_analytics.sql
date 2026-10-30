-- Analytics publications : vues dédupliquées par session et par jour.
CREATE TABLE IF NOT EXISTS public.reel_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public."Reel"(id) ON DELETE CASCADE,
  viewer_email TEXT DEFAULT '',
  session_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reel_view_event_unique_daily
  ON public.reel_view_event (reel_id, session_key);
CREATE INDEX IF NOT EXISTS reel_view_event_reel_date
  ON public.reel_view_event (reel_id, created_at DESC);

ALTER TABLE public.reel_view_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reel_view_event insert authenticated" ON public.reel_view_event;
CREATE POLICY "reel_view_event insert authenticated"
  ON public.reel_view_event FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "reel_view_event owner read" ON public.reel_view_event;
CREATE POLICY "reel_view_event owner read"
  ON public.reel_view_event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Reel" r
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE r.id = reel_view_event.reel_id
        AND (r.created_by_id = auth.uid() OR r.author_email = p.email)
    )
  );

CREATE OR REPLACE FUNCTION public.record_reel_view(
  reel_uuid UUID,
  viewer_session TEXT,
  viewer_email_value TEXT DEFAULT ''
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_views INTEGER;
BEGIN
  IF reel_uuid IS NULL OR length(coalesce(viewer_session, '')) < 8 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.reel_view_event (reel_id, viewer_email, session_key)
  VALUES (reel_uuid, left(coalesce(viewer_email_value, ''), 320), left(viewer_session, 160))
  ON CONFLICT (reel_id, session_key) DO NOTHING;

  IF FOUND THEN
    UPDATE public."Reel"
    SET views = coalesce(views, 0) + 1,
        updated_at = now()
    WHERE id = reel_uuid;
  END IF;

  SELECT coalesce(views, 0) INTO current_views
  FROM public."Reel"
  WHERE id = reel_uuid;
  RETURN coalesce(current_views, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_reel_view(UUID, TEXT, TEXT) TO authenticated;
