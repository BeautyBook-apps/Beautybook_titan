-- Compteur de vues de profils professionnels : une vue unique par visiteur et profil.
ALTER TABLE public."ProfilPro"
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pro_profile_view_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_email TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  viewer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pro_email, viewer_key)
);

CREATE INDEX IF NOT EXISTS pro_profile_view_event_pro_email_idx
  ON public.pro_profile_view_event (pro_email);

ALTER TABLE public.pro_profile_view_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile view events insert" ON public.pro_profile_view_event;
CREATE POLICY "profile view events insert"
  ON public.pro_profile_view_event FOR INSERT
  WITH CHECK (viewer_key IS NOT NULL AND length(viewer_key) BETWEEN 8 AND 180);

DROP POLICY IF EXISTS "profile view events owner read" ON public.pro_profile_view_event;
CREATE POLICY "profile view events owner read"
  ON public.pro_profile_view_event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."ProfilPro" p
      WHERE p.user_email = pro_profile_view_event.pro_email
        AND p.user_email = auth.jwt()->>'email'
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.record_professional_profile_view(
  target_pro_email TEXT,
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
  IF target_pro_email IS NULL OR btrim(target_pro_email) = ''
     OR viewer_key_value IS NULL OR length(btrim(viewer_key_value)) < 8 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."ProfilPro" p
    WHERE lower(p.user_email) = lower(btrim(target_pro_email))
  ) OR lower(btrim(viewer_email_value)) = lower(btrim(target_pro_email)) THEN
    SELECT COALESCE(MAX(views), 0) INTO next_count
    FROM public."ProfilPro"
    WHERE lower(user_email) = lower(btrim(target_pro_email));
    RETURN next_count;
  END IF;

  -- Un visiteur ne peut pas générer deux vues pour le même profil.
  INSERT INTO public.pro_profile_view_event (pro_email, viewer_key, viewer_email)
  VALUES (lower(btrim(target_pro_email)), btrim(viewer_key_value), NULLIF(lower(btrim(viewer_email_value)), ''))
  ON CONFLICT (pro_email, viewer_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE public."ProfilPro"
      SET views = COALESCE(views, 0) + 1,
          updated_at = COALESCE(updated_at, now())
      WHERE lower(user_email) = lower(btrim(target_pro_email));
  END IF;

  SELECT COALESCE(MAX(views), 0) INTO next_count
  FROM public."ProfilPro"
  WHERE lower(user_email) = lower(btrim(target_pro_email));
  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_professional_profile_view(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_professional_profile_view(TEXT, TEXT, TEXT) TO anon, authenticated;
