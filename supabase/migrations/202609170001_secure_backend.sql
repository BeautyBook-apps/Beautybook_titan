-- Apply to a backed-up staging database first. Existing data is preserved.
-- No existing profiles.role or user_metadata role is promoted to an administrator.
BEGIN;

CREATE TABLE IF NOT EXISTS public.bb_admin_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','administrator','moderator','support')),
  permissions text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bb_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, resource text NOT NULL, resource_id text,
  changes jsonb NOT NULL DEFAULT '{}', request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bb_audit_log_created ON public.bb_audit_log(created_at DESC);
CREATE TABLE IF NOT EXISTS public.bb_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic text NOT NULL, aggregate_id uuid,
  payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS bb_outbox_pending ON public.bb_outbox(next_attempt_at) WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS public.bb_booking_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bb_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id uuid NOT NULL REFERENCES public."ProfilPro"(id) ON DELETE CASCADE,
  reason text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bb_receptionist_settings (
  professional_id uuid PRIMARY KEY REFERENCES public."ProfilPro"(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false, website_enabled boolean NOT NULL DEFAULT false,
  phone_enabled boolean NOT NULL DEFAULT false, phone_number text UNIQUE,
  allowed_origins text[] NOT NULL DEFAULT '{}', handoff_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bb_seller_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK(low_stock_threshold >= 0),
  stripe_account_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bb_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public."Produit"(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL, reason text NOT NULL, stock_after integer NOT NULL CHECK(stock_after >= 0),
  request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(seller_id, request_key)
);
CREATE TABLE IF NOT EXISTS public.bb_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public."Commande"(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public."Produit"(id) ON DELETE SET NULL,
  product_name text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0), unit_price numeric(12,2) NOT NULL CHECK(unit_price >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','preparing','shipped','delivered','cancelled','refunded')),
  tracking_number text, carrier text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bb_order_lines_seller ON public.bb_order_lines(seller_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.bb_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','complete','failed')),
  last_error_code text, requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['bb_admin_memberships','bb_audit_log','bb_outbox','bb_booking_intents','bb_handoffs','bb_receptionist_settings','bb_seller_accounts','bb_inventory_movements','bb_order_lines','bb_deletion_jobs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
REVOKE UPDATE, DELETE ON public.bb_audit_log FROM service_role;

ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris';
ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS seats_count integer NOT NULL DEFAULT 1;
ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS pauses jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS duration_min integer;
ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS seller_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS pro_email text;
UPDATE public."ProfilPro" p SET owner_id = u.id FROM auth.users u WHERE lower(p.user_email) = lower(u.email) AND p.owner_id IS NULL;
UPDATE public."Service" s SET owner_id = u.id FROM auth.users u WHERE lower(s.pro_email) = lower(u.email) AND s.owner_id IS NULL;
UPDATE public."Produit" p SET seller_user_id = u.id FROM auth.users u WHERE lower(p.pro_email) = lower(u.email) AND p.seller_user_id IS NULL;

ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public."ProfilPro"(id) ON DELETE SET NULL;
ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS service_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS request_hash text;
UPDATE public."Reservation" r SET client_id = u.id FROM auth.users u WHERE lower(r.client_email) = lower(u.email) AND r.client_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bb_reservation_request ON public."Reservation"(client_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS bb_reservation_capacity ON public."Reservation"(pro_email, date) WHERE status IN ('en_attente','confirme');
CREATE INDEX IF NOT EXISTS bb_reservation_client ON public."Reservation"(client_id,date DESC);

-- Remove all permissive historical policies on critical tables. Policies are ORed by Postgres;
-- adding one restrictive-looking policy without removing the old ones does not secure a table.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','Reservation','SocialCredentials','SocialConnections','social_connection','social_interaction','VerificationCode') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname,p.schemaname,p.tablename);
  END LOOP;
END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
CREATE POLICY bb_profile_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY bb_profile_create ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND role IN ('user', 'client'));
CREATE POLICY bb_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE OR REPLACE FUNCTION public.bb_protect_profile() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email OR NEW.id IS DISTINCT FROM OLD.id) THEN
      RAISE EXCEPTION 'Profile identity and privileges are server-managed' USING ERRCODE='42501';
    END IF;
    IF TG_OP = 'INSERT' AND (NEW.role IS NULL OR NEW.role NOT IN ('user', 'client') OR NEW.email IS DISTINCT FROM auth.jwt()->>'email') THEN
      RAISE EXCEPTION 'Profile identity and privileges are server-managed' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bb_protect_profile ON public.profiles;
CREATE TRIGGER bb_protect_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.bb_protect_profile();

ALTER TABLE public."Reservation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Reservation" FROM anon, authenticated;
GRANT SELECT ON public."Reservation" TO authenticated;
CREATE POLICY bb_reservation_participant ON public."Reservation" FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR client_email = auth.jwt()->>'email' OR pro_email = auth.jwt()->>'email');

DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['SocialCredentials','SocialConnections','social_connection','social_interaction','VerificationCode'] LOOP
    IF to_regclass(format('public.%I',t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    END IF;
  END LOOP;
  -- No arbitrary SQL execution function may be exposed through the Data API.
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname IN ('exec_sql','execute_sql','run_sql') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
END $$;


-- Preserve other applications' storage policies. Restrictive policies prevent any
-- historical broad policy from bypassing ownership on the two BeautyBook buckets.
DO $$ DECLARE p record; BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'bb_storage_%' LOOP
   EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
  END LOOP;
  EXECUTE 'CREATE POLICY bb_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT USING (bucket_id NOT IN (''private-documents'',''private-images'') OR (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT WITH CHECK (bucket_id NOT IN (''uploads'',''private-documents'',''private-images'') OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1]=auth.uid()::text))';
  EXECUTE 'CREATE POLICY bb_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE USING (bucket_id NOT IN (''uploads'',''private-documents'',''private-images'') OR (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK (bucket_id NOT IN (''uploads'',''private-documents'',''private-images'') OR (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE USING (bucket_id NOT IN (''uploads'',''private-documents'',''private-images'') OR (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_public_read ON storage.objects FOR SELECT USING (bucket_id=''uploads'')';
  EXECUTE 'CREATE POLICY bb_storage_private_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN (''private-documents'',''private-images'') AND (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN (''uploads'',''private-documents'',''private-images'') AND (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_owner_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN (''uploads'',''private-documents'',''private-images'') AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK (bucket_id IN (''uploads'',''private-documents'',''private-images'') AND (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY bb_storage_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN (''uploads'',''private-documents'',''private-images'') AND (storage.foldername(name))[1]=auth.uid()::text)';
 END IF;
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public) VALUES('uploads','uploads',true),('private-documents','private-documents',false),('private-images','private-images',false)
   ON CONFLICT(id) DO UPDATE SET public=EXCLUDED.public;
 END IF;
END $$;
COMMIT;
