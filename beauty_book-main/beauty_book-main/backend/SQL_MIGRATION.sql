CREATE TABLE IF NOT EXISTS public."Publication" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), author_email TEXT DEFAULT '', author_name TEXT DEFAULT '', author_avatar TEXT DEFAULT '', content TEXT DEFAULT '', images JSONB DEFAULT '[]'::jsonb, video_url TEXT DEFAULT '', type TEXT DEFAULT 'photo', status TEXT DEFAULT 'brouillon', likes INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0, tags JSONB DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."LiveSession" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), host_email TEXT DEFAULT '', host_name TEXT DEFAULT '', host_avatar TEXT DEFAULT '', title TEXT DEFAULT '', description TEXT DEFAULT '', category TEXT DEFAULT '', status TEXT DEFAULT 'offline', viewers_count INTEGER DEFAULT 0, viewers JSONB DEFAULT '[]'::jsonb, mux_stream_key TEXT DEFAULT '', mux_playback_id TEXT DEFAULT '', thumbnail_url TEXT DEFAULT '', started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."LiveMessage" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT DEFAULT '', user_email TEXT DEFAULT '', user_name TEXT DEFAULT '', user_avatar TEXT DEFAULT '', sender_email TEXT DEFAULT '', sender_name TEXT DEFAULT '', sender_avatar TEXT DEFAULT '', content TEXT DEFAULT '', type TEXT DEFAULT 'text', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."Annonce" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT DEFAULT '', description TEXT DEFAULT '', images JSONB DEFAULT '[]'::jsonb, type TEXT DEFAULT 'banner', target_url TEXT DEFAULT '', status TEXT DEFAULT 'brouillon', pro_email TEXT DEFAULT '', pro_name TEXT DEFAULT '', sponsor_name TEXT DEFAULT '', budget NUMERIC DEFAULT 0, start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."MembreEquipe" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pro_email TEXT DEFAULT '', membre_email TEXT DEFAULT '', membre_name TEXT DEFAULT '', membre_avatar TEXT DEFAULT '', name TEXT DEFAULT '', role TEXT DEFAULT '', specialites JSONB DEFAULT '[]'::jsonb, specialties JSONB DEFAULT '[]'::jsonb, experience TEXT DEFAULT '', days TEXT[] DEFAULT '{}', horaires JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."DemandeProV2" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', username TEXT DEFAULT '', nom TEXT DEFAULT '', prenom TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '', specialite TEXT DEFAULT '', experience TEXT DEFAULT '', description TEXT DEFAULT '', cv_url TEXT DEFAULT '', portfolio_urls JSONB DEFAULT '[]'::jsonb, status TEXT DEFAULT 'en_attente', admin_notes TEXT DEFAULT '', statut TEXT DEFAULT 'en_attente', siret TEXT DEFAULT '', salon_name TEXT DEFAULT '', bio TEXT DEFAULT '', type_activite TEXT DEFAULT '', years_experience INTEGER DEFAULT 0, services JSONB DEFAULT '[]'::jsonb, categories JSONB DEFAULT '[]'::jsonb, specialites_cheveux JSONB DEFAULT '[]'::jsonb, salon_photo TEXT DEFAULT '', portfolio JSONB DEFAULT '[]'::jsonb, email_pro TEXT DEFAULT '', doc_identite_recto TEXT DEFAULT '', doc_identite_verso TEXT DEFAULT '', doc_siret TEXT DEFAULT '', doc_assurance TEXT DEFAULT '', days JSONB DEFAULT '[]'::jsonb, time_slots JSONB DEFAULT '[]'::jsonb, commodites JSONB DEFAULT '[]'::jsonb, seats_count INTEGER DEFAULT 1, se_deplace BOOLEAN DEFAULT false, travail_nuit BOOLEAN DEFAULT false, visite_video_url TEXT DEFAULT '', diplomes JSONB DEFAULT '[]'::jsonb, has_diplome BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."DemandefFranchise" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', user_name TEXT DEFAULT '', full_name TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', city TEXT DEFAULT '', budget TEXT DEFAULT '', experience TEXT DEFAULT '', message TEXT DEFAULT '', status TEXT DEFAULT 'en_attente', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."CatalogueOption" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT DEFAULT '', description TEXT DEFAULT '', price NUMERIC DEFAULT 0, duration_min INTEGER DEFAULT 0, service_id TEXT DEFAULT '', pro_email TEXT DEFAULT '', category TEXT DEFAULT '', usage_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."AppConfig" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE DEFAULT '', value JSONB DEFAULT '{}'::jsonb, description TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS public."ImmobilierListing" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT DEFAULT '', description TEXT DEFAULT '', price NUMERIC DEFAULT 0, images JSONB DEFAULT '[]'::jsonb, address TEXT DEFAULT '', city TEXT DEFAULT '', type TEXT DEFAULT 'appartement', status TEXT DEFAULT 'disponible', pro_email TEXT DEFAULT '', bedrooms INTEGER DEFAULT 0, bathrooms INTEGER DEFAULT 0, area NUMERIC DEFAULT 0, features JSONB DEFAULT '[]'::jsonb, estimated_turnover NUMERIC(12,2) DEFAULT 0, estimated_net_revenue NUMERIC(12,2) DEFAULT 0, virtual_tour_id UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."PointsFidelite" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', points INTEGER DEFAULT 0, points_total INTEGER DEFAULT 0, total_earned INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, points_depenses INTEGER DEFAULT 0, level TEXT DEFAULT 'Bronze', niveau TEXT DEFAULT 'Bronze', history JSONB DEFAULT '[]'::jsonb, historique JSONB DEFAULT '[]'::jsonb, code_parrainage TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."PointsFidelitePro" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pro_email TEXT DEFAULT '', points_total INTEGER DEFAULT 0, points_depenses INTEGER DEFAULT 0, niveau TEXT DEFAULT 'Bronze', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."SoldeBeautyPay" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', balance NUMERIC DEFAULT 0, solde NUMERIC DEFAULT 0, currency TEXT DEFAULT 'EUR', transactions JSONB DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."VisiteVirtuelle" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pro_email TEXT DEFAULT '', title TEXT DEFAULT '', scenes JSONB DEFAULT '[]'::jsonb, status TEXT DEFAULT 'brouillon', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."CallSignal" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), call_id TEXT DEFAULT '', caller_email TEXT DEFAULT '', caller_name TEXT DEFAULT '', callee_email TEXT DEFAULT '', signal_type TEXT DEFAULT '', type TEXT DEFAULT '', signal_data TEXT DEFAULT '', payload TEXT DEFAULT '', status TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."CallLog" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), caller_email TEXT DEFAULT '', callee_email TEXT DEFAULT '', started_at TIMESTAMPTZ DEFAULT now(), ended_at TIMESTAMPTZ, duration INTEGER DEFAULT 0, status TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS public."RoutineBeaute" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', name TEXT DEFAULT '', emoji TEXT DEFAULT '', description TEXT DEFAULT '', steps JSONB DEFAULT '[]'::jsonb, tasks JSONB DEFAULT '[]'::jsonb, frequency TEXT DEFAULT 'quotidienne', status TEXT DEFAULT 'active', reminders JSONB DEFAULT '[]'::jsonb, reminder_active BOOLEAN DEFAULT false, category TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."CommentaireStyle" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), style_id TEXT DEFAULT '', user_email TEXT DEFAULT '', user_name TEXT DEFAULT '', user_avatar TEXT DEFAULT '', content TEXT DEFAULT '', likes INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."MariaConversation" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', title TEXT DEFAULT '', messages JSONB DEFAULT '[]'::jsonb, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

CREATE TABLE IF NOT EXISTS public."Repub" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', reel_id TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS public."Panier" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_email TEXT DEFAULT '', items JSONB DEFAULT '[]'::jsonb, total NUMERIC DEFAULT 0, status TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), created_by_id UUID);

ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS author_email TEXT DEFAULT '';
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT '';
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS author_avatar TEXT DEFAULT '';
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS service_id TEXT DEFAULT '';
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 0;
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT false;
ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS style TEXT DEFAULT '';
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS promo_price NUMERIC;
ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;
ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS old_price NUMERIC;
ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS external_url TEXT DEFAULT '';
ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS min_qty INTEGER DEFAULT 1;
ALTER TABLE public."Reel" ADD COLUMN IF NOT EXISTS pub_type TEXT DEFAULT 'reel';

ALTER TABLE public."Publication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LiveSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LiveMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Annonce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MembreEquipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandeProV2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandefFranchise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CatalogueOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImmobilierListing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PointsFidelite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PointsFidelitePro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SoldeBeautyPay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VisiteVirtuelle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CallSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CallLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoutineBeaute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommentaireStyle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MariaConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Repub" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Panier" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publication_all" ON public."Publication" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "LiveSession_all" ON public."LiveSession" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "LiveMessage_all" ON public."LiveMessage" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Annonce_all" ON public."Annonce" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "MembreEquipe_all" ON public."MembreEquipe" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "DemandeProV2_all" ON public."DemandeProV2" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "DemandefFranchise_all" ON public."DemandefFranchise" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "CatalogueOption_all" ON public."CatalogueOption" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "AppConfig_all" ON public."AppConfig" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ImmobilierListing_all" ON public."ImmobilierListing" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PointsFidelite_all" ON public."PointsFidelite" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PointsFidelitePro_all" ON public."PointsFidelitePro" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "SoldeBeautyPay_all" ON public."SoldeBeautyPay" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "VisiteVirtuelle_all" ON public."VisiteVirtuelle" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "CallSignal_all" ON public."CallSignal" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "CallLog_all" ON public."CallLog" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "RoutineBeaute_all" ON public."RoutineBeaute" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "CommentaireStyle_all" ON public."CommentaireStyle" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "MariaConversation_all" ON public."MariaConversation" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Repub_all" ON public."Repub" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Panier_all" ON public."Panier" FOR ALL USING (true) WITH CHECK (true);

-- The authenticated commerce API stores its cart in bb_carts. Keep this
-- idempotent so existing installations can apply the backend migration safely.
CREATE TABLE IF NOT EXISTS public.bb_carts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bb_carts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_carts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bb_carts TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
