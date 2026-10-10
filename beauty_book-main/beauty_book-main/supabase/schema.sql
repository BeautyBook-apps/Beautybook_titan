-- ============================================================
-- BeautyBook — Schema Supabase complet
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : profiles (extension de auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'vendeur')),
  maria_name TEXT,
  maria_memory JSONB DEFAULT '{}'::jsonb,
  gender TEXT,
  beauty_interests JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: lecture publique" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles: modif soi-même" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: insertion auto" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger auto-création profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- TABLE : ProfilPro
-- ============================================================
CREATE TABLE IF NOT EXISTS public."ProfilPro" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  nom TEXT,
  prenom TEXT,
  salon_name TEXT,
  bio TEXT,
  specialites TEXT[],
  avatar_url TEXT,
  cover_url TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  status TEXT DEFAULT 'actif',
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  travail_nuit BOOLEAN DEFAULT false,
  horaires JSONB DEFAULT '{}'::jsonb,
  jours_repos TEXT[] DEFAULT '{}',
  conges JSONB DEFAULT '[]'::jsonb,
  team_emails TEXT[] DEFAULT '{}',
  latitude NUMERIC,
  longitude NUMERIC,
  _lat NUMERIC,
  _lng NUMERIC,
  abonnement TEXT DEFAULT 'gratuit',
  abonnement_expires_at TEXT,
  stripe_customer_id TEXT,
  categorie TEXT,
  tags TEXT[] DEFAULT '{}',
  galerie_urls TEXT[] DEFAULT '{}',
  presentation_video_url TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  services_count INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  ouverture JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."ProfilPro" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ProfilPro: lecture publique" ON public."ProfilPro" FOR SELECT USING (true);
CREATE POLICY "ProfilPro: modif propriétaire" ON public."ProfilPro" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ProfilPro: insertion auth" ON public."ProfilPro" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ProfilPro: suppression propriétaire" ON public."ProfilPro" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Service
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Service" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_email TEXT,
  name TEXT,
  title TEXT,
  description TEXT,
  price NUMERIC,
  duration_min INTEGER DEFAULT 60,
  category TEXT,
  subcategory TEXT,
  style TEXT,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'actif',
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  addons JSONB DEFAULT '[]'::jsonb,
  max_persons INTEGER DEFAULT 1,
  promo_price NUMERIC,
  promo_ends_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Service" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service: lecture publique" ON public."Service" FOR SELECT USING (true);
CREATE POLICY "Service: modif propriétaire" ON public."Service" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service: insertion auth" ON public."Service" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Service: suppression propriétaire" ON public."Service" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Reservation
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Reservation" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_email TEXT NOT NULL,
  client_name TEXT,
  pro_email TEXT NOT NULL,
  pro_name TEXT,
  service_id TEXT,
  service_name TEXT NOT NULL,
  service_price NUMERIC,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  end_time_slot TEXT,
  duration_min INTEGER DEFAULT 60,
  persons INTEGER DEFAULT 1,
  addons JSONB DEFAULT '[]'::jsonb,
  total_price NUMERIC,
  acompte_amount NUMERIC DEFAULT 0,
  payment_type TEXT DEFAULT 'surplace' CHECK (payment_type IN ('full','acompte','surplace')),
  crg_code TEXT,
  notes TEXT,
  status TEXT DEFAULT 'en_attente' CHECK (status IN ('en_attente','confirme','annule','termine','no_show')),
  payment_status TEXT DEFAULT 'non_paye' CHECK (payment_status IN ('non_paye','acompte_paye','paye','rembourse')),
  salon_name TEXT,
  salon_address TEXT,
  service_location TEXT DEFAULT 'salon',
  client_address TEXT DEFAULT '',
  client_postal_code TEXT DEFAULT '',
  client_city TEXT DEFAULT '',
  client_latitude NUMERIC,
  client_longitude NUMERIC,
  transport_fee NUMERIC DEFAULT 0,
  transport_distance_km NUMERIC DEFAULT 0,
  seats_total INTEGER,
  reminder_scheduled BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  completed_at TEXT,
  review_requested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Reservation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reservation: select" ON public."Reservation" FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    client_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
    pro_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
CREATE POLICY "Reservation: insertion auth" ON public."Reservation" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Reservation: update" ON public."Reservation" FOR UPDATE USING (
  client_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  pro_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Reservation: delete" ON public."Reservation" FOR DELETE USING (
  client_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  pro_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- TABLE : Avis
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Avis" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_email TEXT,
  auteur_name TEXT,
  auteur_avatar TEXT,
  cible_email TEXT,
  cible_name TEXT,
  type TEXT DEFAULT 'client_to_pro',
  rating NUMERIC,
  comment TEXT,
  service_name TEXT,
  reservation_id TEXT,
  images TEXT[] DEFAULT '{}',
  response TEXT,
  response_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Avis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avis: lecture publique" ON public."Avis" FOR SELECT USING (true);
CREATE POLICY "Avis: insertion auth" ON public."Avis" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Avis: modif propriétaire" ON public."Avis" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Avis: suppression propriétaire" ON public."Avis" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Style
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Style" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  description TEXT,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  video_url TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'publie',
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  author_email TEXT,
  author_name TEXT,
  author_avatar TEXT,
  pro_email TEXT,
  service_id TEXT,
  price NUMERIC,
  duration_min INTEGER,
  featured BOOLEAN DEFAULT false,
  is_sponsored BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Style" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Style: lecture publique" ON public."Style" FOR SELECT USING (true);
CREATE POLICY "Style: insertion auth" ON public."Style" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Style: modif propriétaire" ON public."Style" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Style: suppression propriétaire" ON public."Style" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Reel
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Reel" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  images TEXT[] DEFAULT '{}',
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'publie',
  pub_type TEXT DEFAULT 'reel',
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  author_email TEXT,
  author_name TEXT,
  author_avatar TEXT,
  is_sponsored BOOLEAN DEFAULT false,
  music_title TEXT,
  music_artist TEXT,
  music_url TEXT,
  sound TEXT,
  sound_preview_url TEXT,
  product_id TEXT,
  product_name TEXT,
  product_img TEXT,
  service_id TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Reel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reel: lecture publique" ON public."Reel" FOR SELECT USING (true);
CREATE POLICY "Reel: insertion auth" ON public."Reel" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Reel: modif propriétaire" ON public."Reel" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Reel: suppression propriétaire" ON public."Reel" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : CommentaireStyle
-- ============================================================
CREATE TABLE IF NOT EXISTS public."CommentaireStyle" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  style_id TEXT,
  user_email TEXT,
  user_name TEXT,
  user_avatar TEXT,
  content TEXT,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."CommentaireStyle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CommentaireStyle: lecture publique" ON public."CommentaireStyle" FOR SELECT USING (true);
CREATE POLICY "CommentaireStyle: insertion auth" ON public."CommentaireStyle" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "CommentaireStyle: modif propriétaire" ON public."CommentaireStyle" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "CommentaireStyle: suppression propriétaire" ON public."CommentaireStyle" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : MessageChat
-- ============================================================
CREATE TABLE IF NOT EXISTS public."MessageChat" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT,
  sender_email TEXT,
  sender_name TEXT,
  sender_avatar TEXT,
  receiver_email TEXT,
  receiver_name TEXT,
  content TEXT,
  type TEXT DEFAULT 'text',
  file_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  reservation_id TEXT,
  is_maria BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."MessageChat" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MessageChat: select" ON public."MessageChat" FOR SELECT USING (
  sender_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  receiver_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "MessageChat: insertion auth" ON public."MessageChat" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "MessageChat: modif propriétaire" ON public."MessageChat" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "MessageChat: suppression propriétaire" ON public."MessageChat" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Notification
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Notification" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  title TEXT,
  message TEXT,
  body TEXT,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  icon TEXT,
  action_url TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notification: select" ON public."Notification" FOR SELECT USING (
  user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Notification: insertion auth" ON public."Notification" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Notification: modif propriétaire" ON public."Notification" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Notification: suppression" ON public."Notification" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Produit
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Produit" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  description TEXT,
  price NUMERIC,
  old_price NUMERIC,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  category TEXT,
  brand TEXT,
  stock INTEGER DEFAULT 0,
  status TEXT DEFAULT 'actif',
  tags TEXT[] DEFAULT '{}',
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  shopify_id TEXT,
  featured BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'local',
  external_url TEXT,
  min_qty INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Produit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produit: lecture publique" ON public."Produit" FOR SELECT USING (true);
CREATE POLICY "Produit: insertion admin" ON public."Produit" FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Produit: modif admin" ON public."Produit" FOR UPDATE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Produit: suppression admin" ON public."Produit" FOR DELETE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Commande
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Commande" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_email TEXT,
  client_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  total_price NUMERIC,
  total NUMERIC,
  subtotal NUMERIC,
  shipping NUMERIC,
  status TEXT DEFAULT 'en_attente',
  payment_status TEXT DEFAULT 'non_paye',
  payment_method TEXT,
  payment_intent_id TEXT,
  shipping_address JSONB,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Commande" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commande: select" ON public."Commande" FOR SELECT USING (
  client_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Commande: insertion auth" ON public."Commande" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Commande: modif admin" ON public."Commande" FOR UPDATE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR auth.uid() = created_by_id);
CREATE POLICY "Commande: suppression admin" ON public."Commande" FOR DELETE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Annonce
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Annonce" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  description TEXT,
  image_url TEXT,
  type TEXT DEFAULT 'banner',
  target_url TEXT,
  status TEXT DEFAULT 'actif',
  pro_email TEXT,
  pro_name TEXT,
  sponsor_name TEXT,
  budget NUMERIC,
  start_date DATE,
  end_date DATE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Annonce" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Annonce: lecture publique" ON public."Annonce" FOR SELECT USING (true);
CREATE POLICY "Annonce: insertion auth" ON public."Annonce" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Annonce: modif propriétaire" ON public."Annonce" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Annonce: suppression propriétaire" ON public."Annonce" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : AppConfig
-- ============================================================
CREATE TABLE IF NOT EXISTS public."AppConfig" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."AppConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AppConfig: lecture publique" ON public."AppConfig" FOR SELECT USING (true);
CREATE POLICY "AppConfig: modif admin" ON public."AppConfig" FOR ALL USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : CallLog
-- ============================================================
CREATE TABLE IF NOT EXISTS public."CallLog" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_email TEXT,
  callee_email TEXT,
  caller_name TEXT,
  callee_name TEXT,
  status TEXT DEFAULT 'initiated',
  duration_sec INTEGER,
  started_at TEXT,
  ended_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."CallLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CallLog: select" ON public."CallLog" FOR SELECT USING (
  caller_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  callee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "CallLog: insertion auth" ON public."CallLog" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "CallLog: modif propriétaire" ON public."CallLog" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "CallLog: suppression propriétaire" ON public."CallLog" FOR DELETE USING (auth.uid() = created_by_id);

-- ============================================================
-- TABLE : CallSignal
-- ============================================================
CREATE TABLE IF NOT EXISTS public."CallSignal" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id TEXT,
  caller_email TEXT,
  caller_name TEXT,
  callee_email TEXT,
  signal_type TEXT,
  type TEXT,
  signal_data JSONB,
  payload TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."CallSignal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CallSignal: select" ON public."CallSignal" FOR SELECT USING (
  caller_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  callee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "CallSignal: insertion auth" ON public."CallSignal" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "CallSignal: modif propriétaire" ON public."CallSignal" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "CallSignal: suppression propriétaire" ON public."CallSignal" FOR DELETE USING (auth.uid() = created_by_id);

-- ============================================================
-- TABLE : CatalogueOption
-- ============================================================
CREATE TABLE IF NOT EXISTS public."CatalogueOption" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  description TEXT,
  price NUMERIC,
  duration_min INTEGER,
  service_id TEXT,
  pro_email TEXT,
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."CatalogueOption" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CatalogueOption: lecture publique" ON public."CatalogueOption" FOR SELECT USING (true);
CREATE POLICY "CatalogueOption: insertion auth" ON public."CatalogueOption" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "CatalogueOption: modif propriétaire" ON public."CatalogueOption" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "CatalogueOption: suppression propriétaire" ON public."CatalogueOption" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : DemandeProV2
-- ============================================================
CREATE TABLE IF NOT EXISTS public."DemandeProV2" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  username TEXT,
  nom TEXT,
  prenom TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  specialite TEXT,
  experience TEXT,
  description TEXT,
  cv_url TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'en_attente',
  admin_notes TEXT,
  statut TEXT DEFAULT 'en_attente',
  siret TEXT,
  salon_name TEXT,
  bio TEXT,
  type_activite TEXT,
  years_experience INTEGER DEFAULT 0,
  services JSONB DEFAULT '[]'::jsonb,
  categories JSONB DEFAULT '[]'::jsonb,
  specialites_cheveux JSONB DEFAULT '[]'::jsonb,
  salon_photo TEXT,
  portfolio JSONB DEFAULT '[]'::jsonb,
  email_pro TEXT,
  doc_identite_recto TEXT,
  doc_identite_verso TEXT,
  doc_siret TEXT,
  doc_assurance TEXT,
  days JSONB DEFAULT '[]'::jsonb,
  time_slots JSONB DEFAULT '[]'::jsonb,
  commodites JSONB DEFAULT '[]'::jsonb,
  seats_count INTEGER DEFAULT 1,
  se_deplace BOOLEAN DEFAULT false,
  travail_nuit BOOLEAN DEFAULT false,
  visite_video_url TEXT,
  diplomes JSONB DEFAULT '[]'::jsonb,
  has_diplome BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."DemandeProV2" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DemandeProV2: select" ON public."DemandeProV2" FOR SELECT USING (
  user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "DemandeProV2: insertion auth" ON public."DemandeProV2" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "DemandeProV2: modif admin" ON public."DemandeProV2" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "DemandeProV2: suppression admin" ON public."DemandeProV2" FOR DELETE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : DemandefFranchise
-- ============================================================
CREATE TABLE IF NOT EXISTS public."DemandefFranchise" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  user_name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  budget TEXT,
  experience TEXT,
  message TEXT,
  status TEXT DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."DemandefFranchise" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DemandefFranchise: select" ON public."DemandefFranchise" FOR SELECT USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "DemandefFranchise: insertion auth" ON public."DemandefFranchise" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "DemandefFranchise: modif admin" ON public."DemandefFranchise" FOR UPDATE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "DemandefFranchise: suppression admin" ON public."DemandefFranchise" FOR DELETE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : ImmobilierListing
-- ============================================================
CREATE TABLE IF NOT EXISTS public."ImmobilierListing" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  description TEXT,
  price NUMERIC,
  surface NUMERIC,
  rooms INTEGER,
  type TEXT,
  status TEXT DEFAULT 'actif',
  city TEXT,
  address TEXT,
  images TEXT[] DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  _lat NUMERIC,
  _lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."ImmobilierListing" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ImmobilierListing: lecture publique" ON public."ImmobilierListing" FOR SELECT USING (true);
CREATE POLICY "ImmobilierListing: insertion auth" ON public."ImmobilierListing" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ImmobilierListing: modif propriétaire" ON public."ImmobilierListing" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ImmobilierListing: suppression propriétaire" ON public."ImmobilierListing" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : LiveMessage
-- ============================================================
CREATE TABLE IF NOT EXISTS public."LiveMessage" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  user_email TEXT,
  user_name TEXT,
  user_avatar TEXT,
  sender_email TEXT,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  type TEXT DEFAULT 'message',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."LiveMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LiveMessage: lecture publique" ON public."LiveMessage" FOR SELECT USING (true);
CREATE POLICY "LiveMessage: insertion auth" ON public."LiveMessage" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "LiveMessage: modif propriétaire" ON public."LiveMessage" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "LiveMessage: suppression propriétaire" ON public."LiveMessage" FOR DELETE USING (auth.uid() = created_by_id);

-- ============================================================
-- TABLE : LiveSession
-- ============================================================
CREATE TABLE IF NOT EXISTS public."LiveSession" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_email TEXT,
  host_name TEXT,
  host_avatar TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'live',
  viewers_count INTEGER DEFAULT 0,
  viewers INTEGER DEFAULT 0,
  mux_stream_key TEXT,
  mux_playback_id TEXT,
  thumbnail_url TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."LiveSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LiveSession: lecture publique" ON public."LiveSession" FOR SELECT USING (true);
CREATE POLICY "LiveSession: insertion auth" ON public."LiveSession" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "LiveSession: modif propriétaire" ON public."LiveSession" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "LiveSession: suppression propriétaire" ON public."LiveSession" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : MariaConversation
-- ============================================================
CREATE TABLE IF NOT EXISTS public."MariaConversation" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."MariaConversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MariaConversation: select" ON public."MariaConversation" FOR SELECT USING (user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "MariaConversation: insertion auth" ON public."MariaConversation" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "MariaConversation: modif propriétaire" ON public."MariaConversation" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "MariaConversation: suppression propriétaire" ON public."MariaConversation" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : MembreEquipe
-- ============================================================
CREATE TABLE IF NOT EXISTS public."MembreEquipe" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_email TEXT,
  membre_email TEXT,
  membre_name TEXT,
  membre_avatar TEXT,
  name TEXT,
  role TEXT DEFAULT 'membre',
  specialites TEXT[],
  specialties TEXT[],
  experience TEXT,
  days TEXT[] DEFAULT '{}',
  horaires JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'actif',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."MembreEquipe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MembreEquipe: lecture publique" ON public."MembreEquipe" FOR SELECT USING (true);
CREATE POLICY "MembreEquipe: insertion auth" ON public."MembreEquipe" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "MembreEquipe: modif propriétaire" ON public."MembreEquipe" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "MembreEquipe: suppression propriétaire" ON public."MembreEquipe" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : PointsFidelite
-- ============================================================
CREATE TABLE IF NOT EXISTS public."PointsFidelite" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  points INTEGER DEFAULT 0,
  points_total INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  points_depenses INTEGER DEFAULT 0,
  level TEXT DEFAULT 'bronze',
  niveau TEXT DEFAULT 'Silver',
  history JSONB DEFAULT '[]'::jsonb,
  historique JSONB DEFAULT '[]'::jsonb,
  code_parrainage TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."PointsFidelite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PointsFidelite: select" ON public."PointsFidelite" FOR SELECT USING (user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "PointsFidelite: insertion auth" ON public."PointsFidelite" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "PointsFidelite: modif" ON public."PointsFidelite" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "PointsFidelite: suppression" ON public."PointsFidelite" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : PointsFidelitePro
-- ============================================================
CREATE TABLE IF NOT EXISTS public."PointsFidelitePro" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pro_email TEXT,
  points INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  level TEXT DEFAULT 'bronze',
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."PointsFidelitePro" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PointsFidelitePro: select" ON public."PointsFidelitePro" FOR SELECT USING (pro_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "PointsFidelitePro: insertion auth" ON public."PointsFidelitePro" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "PointsFidelitePro: modif" ON public."PointsFidelitePro" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "PointsFidelitePro: suppression" ON public."PointsFidelitePro" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Publication
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Publication" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_email TEXT,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT,
  images TEXT[] DEFAULT '{}',
  video_url TEXT,
  type TEXT DEFAULT 'post',
  status TEXT DEFAULT 'publie',
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Publication" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publication: lecture publique" ON public."Publication" FOR SELECT USING (true);
CREATE POLICY "Publication: insertion auth" ON public."Publication" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Publication: modif propriétaire" ON public."Publication" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Publication: suppression propriétaire" ON public."Publication" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : Repub
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Repub" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  user_name TEXT,
  reel_id TEXT,
  reel_title TEXT,
  reel_thumbnail TEXT,
  reel_images TEXT[] DEFAULT '{}',
  original_author TEXT,
  original_author_avatar TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."Repub" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Repub: lecture publique" ON public."Repub" FOR SELECT USING (true);
CREATE POLICY "Repub: insertion auth" ON public."Repub" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Repub: modif propriétaire" ON public."Repub" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "Repub: suppression propriétaire" ON public."Repub" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : RoutineBeaute
-- ============================================================
CREATE TABLE IF NOT EXISTS public."RoutineBeaute" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  name TEXT,
  emoji TEXT,
  description TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  frequency TEXT,
  status TEXT DEFAULT 'active',
  reminders JSONB DEFAULT '[]'::jsonb,
  reminder_active BOOLEAN DEFAULT false,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."RoutineBeaute" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RoutineBeaute: select" ON public."RoutineBeaute" FOR SELECT USING (user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "RoutineBeaute: insertion auth" ON public."RoutineBeaute" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "RoutineBeaute: modif propriétaire" ON public."RoutineBeaute" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "RoutineBeaute: suppression propriétaire" ON public."RoutineBeaute" FOR DELETE USING (auth.uid() = created_by_id);

-- ============================================================
-- TABLE : SoldeBeautyPay
-- ============================================================
CREATE TABLE IF NOT EXISTS public."SoldeBeautyPay" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  balance NUMERIC DEFAULT 0,
  solde NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  transactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."SoldeBeautyPay" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SoldeBeautyPay: select" ON public."SoldeBeautyPay" FOR SELECT USING (user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "SoldeBeautyPay: insertion auth" ON public."SoldeBeautyPay" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "SoldeBeautyPay: modif" ON public."SoldeBeautyPay" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "SoldeBeautyPay: suppression" ON public."SoldeBeautyPay" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : UserMemory
-- ============================================================
CREATE TABLE IF NOT EXISTS public."UserMemory" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  habits JSONB DEFAULT '[]'::jsonb,
  frequent_actions JSONB DEFAULT '{}'::jsonb,
  last_services TEXT[] DEFAULT '{}',
  last_pros TEXT[] DEFAULT '{}',
  favorite_categories TEXT[] DEFAULT '{}',
  preferred_time_slots TEXT[] DEFAULT '{}',
  preferred_days TEXT[] DEFAULT '{}',
  profile_summary TEXT,
  pending_workflows JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  last_updated TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."UserMemory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UserMemory: select" ON public."UserMemory" FOR SELECT USING (user_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "UserMemory: insertion auth" ON public."UserMemory" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "UserMemory: modif propriétaire" ON public."UserMemory" FOR UPDATE USING (auth.uid() = created_by_id);
CREATE POLICY "UserMemory: suppression propriétaire" ON public."UserMemory" FOR DELETE USING (auth.uid() = created_by_id);

-- ============================================================
-- TABLE : VerificationCode (admin only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public."VerificationCode" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT,
  code TEXT,
  expires_at BIGINT,
  mode TEXT CHECK (mode IN ('email','phone')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."VerificationCode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VerificationCode: admin only" ON public."VerificationCode" FOR ALL USING (EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TABLE : VisiteVirtuelle
-- ============================================================
CREATE TABLE IF NOT EXISTS public."VisiteVirtuelle" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  floorplan_url TEXT,
  scenes JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'brouillon' CHECK (status IN ('actif','brouillon')),
  views INTEGER DEFAULT 0,
  pro_email TEXT NOT NULL,
  pro_name TEXT,
  pro_address TEXT,
  pro_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID
);
ALTER TABLE public."VisiteVirtuelle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VisiteVirtuelle: lecture publique actif" ON public."VisiteVirtuelle" FOR SELECT USING (status = 'actif' OR auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "VisiteVirtuelle: insertion auth" ON public."VisiteVirtuelle" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "VisiteVirtuelle: modif propriétaire" ON public."VisiteVirtuelle" FOR UPDATE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "VisiteVirtuelle: suppression propriétaire" ON public."VisiteVirtuelle" FOR DELETE USING (auth.uid() = created_by_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- Activer Realtime pour les tables qui en ont besoin
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public."MessageChat";
ALTER PUBLICATION supabase_realtime ADD TABLE public."CallSignal";
ALTER PUBLICATION supabase_realtime ADD TABLE public."LiveMessage";
ALTER PUBLICATION supabase_realtime ADD TABLE public."LiveSession";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Reservation";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Style";
ALTER PUBLICATION supabase_realtime ADD TABLE public."ProfilPro";

-- ============================================================
-- FIN DU SCHEMA
-- ============================================================

-- ============================================================
-- STORAGE : Bucket pour les fichiers (images, vidéos)
-- ============================================================
-- Ignoré si l'utilisateur n'est pas propriétaire de storage.objects
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('uploads', 'uploads', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage bucket skip: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage RLS skip: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public Access" ON storage.objects;
  CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy Public Access skip: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
  DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
  CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy Public Insert skip: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
  CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'uploads');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy Auth Update skip: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
  CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uploads');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy Auth Delete skip: %', SQLERRM;
END;
$$;

