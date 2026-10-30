-- Source unique des bundles affichés par l'application principale et le
-- panneau d'administration. La table était référencée par le code mais
-- n'était pas créée par les migrations du dépôt, ce qui provoquait une 404
-- PostgREST lorsque le front la consultait.
CREATE TABLE IF NOT EXISTS public."ServiceBundle" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  style_ids TEXT[] NOT NULL DEFAULT '{}',
  bundle_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_group BOOLEAN NOT NULL DEFAULT false,
  min_persons INTEGER NOT NULL DEFAULT 1,
  max_persons INTEGER NOT NULL DEFAULT 1,
  bundle_price_per_person NUMERIC(10,2),
  category TEXT DEFAULT 'autre',
  bonus TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID
);

ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS pro_email TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS service_ids TEXT[] DEFAULT '{}';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS style_ids TEXT[] DEFAULT '{}';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS bundle_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS min_persons INTEGER DEFAULT 1;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS max_persons INTEGER DEFAULT 1;
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS bundle_price_per_person NUMERIC(10,2);
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'autre';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS bonus TEXT DEFAULT '';
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS created_by_id UUID;

ALTER TABLE public."ServiceBundle" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ServiceBundle_public_read" ON public."ServiceBundle";
DROP POLICY IF EXISTS "ServiceBundle_all" ON public."ServiceBundle";
CREATE POLICY "ServiceBundle_all" ON public."ServiceBundle"
  FOR ALL USING (true) WITH CHECK (true);

-- Permet d'associer plusieurs publications Style à un bundle.
SELECT pg_notify('pgrst', 'reload schema');
