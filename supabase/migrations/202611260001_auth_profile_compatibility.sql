-- Keep profile creation compatible with the deployed schema.
-- Some BeautyBook databases use role='client' while older local schemas use
-- role='user'. New auth rows must use the table default rather than forcing a
-- value that may violate the database CHECK constraint.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- If the hardened profile trigger is already installed, accept either
-- historical customer role while still rejecting privileged roles.
DROP POLICY IF EXISTS bb_profile_create ON public.profiles;
CREATE POLICY bb_profile_create ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role IN ('user', 'client'));

CREATE OR REPLACE FUNCTION public.bb_protect_profile() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'UPDATE' AND (
      NEW.role IS DISTINCT FROM OLD.role OR
      NEW.email IS DISTINCT FROM OLD.email OR
      NEW.id IS DISTINCT FROM OLD.id
    ) THEN
      RAISE EXCEPTION 'Profile identity and privileges are server-managed' USING ERRCODE='42501';
    END IF;
    IF TG_OP = 'INSERT' AND (
      NEW.role IS NULL OR NEW.role NOT IN ('user', 'client') OR
      NEW.email IS DISTINCT FROM auth.jwt()->>'email'
    ) THEN
      RAISE EXCEPTION 'Profile identity and privileges are server-managed' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
