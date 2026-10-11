import { supabaseAdmin } from '../config/supabase.js';

const ALLOWED_TABLES = [
  'ProfilPro', 'Service', 'Reservation', 'Avis', 'Style', 'Reel',
  'CommentaireStyle', 'MessageChat', 'Notification', 'Produit', 'Commande',
  'Annonce', 'AppConfig', 'CallLog', 'CallSignal', 'CatalogueOption',
  'DemandeProV2', 'DemandefFranchise', 'ImmobilierListing', 'LiveMessage',
  'LiveSession', 'MariaConversation', 'MembreEquipe', 'PointsFidelite',
  'PointsFidelitePro', 'Publication', 'Repub', 'RoutineBeaute',
  'SoldeBeautyPay', 'Panier', 'UserMemory', 'VerificationCode',
  'VisiteVirtuelle', 'ServiceBundle', 'profiles',
  'user_like', 'reel_comment', 'reel_comment_report', 'user_follow', 'user_favorite',
];

export const columnCache = new Map();

const FALLBACK_COLUMNS = {
  Style: ['id','title','description','images','category','status','likes','views','featured','created_at','updated_at','created_by_id','pro_email','image_url','video_url','tags','author_email','author_name','author_avatar','service_id','price','duration_min','is_sponsored','produits_utilises'],
  Produit: ['id','name','description','price','old_price','images','category','brand','stock','status','tags','rating','reviews_count','shopify_id','source','featured','external_url','min_qty','created_at','updated_at','created_by_id','pro_email'],
  Service: ['id','name','title','description','price','duration','duration_min','category','subcategory','style','images','pro_email','status','addons','tags','rating','reviews_count','max_persons','promo_price','promo_ends_at','created_at','updated_at','created_by_id'],
  Annonce: ['id','title','description','images','type','target_url','status','pro_email','pro_name','sponsor_name','budget','start_date','end_date','impressions','clicks','created_at','updated_at','created_by_id'],
  Reel: ['id','title','description','video_url','thumbnail_url','category','tags','status','pub_type','likes','views','author_email','author_name','author_avatar','is_sponsored','music_title','music_artist','music_url','sound_preview_url','product_id','product_name','product_img','service_id','service_name','created_at','updated_at','created_by_id'],
  Publication: ['id','author_email','author_name','author_avatar','content','images','video_url','type','status','likes','comments_count','tags','created_at','updated_at','created_by_id'],
  Notification: ['id','user_email','title','message','body','type','is_read','read','icon','action_url','data','created_at','updated_at','created_by_id'],
  MessageChat: ['id','conversation_id','sender_email','sender_name','sender_avatar','receiver_email','receiver_name','content','type','file_url','is_read','read','reservation_id','is_maria','created_at','updated_at','created_by_id'],
  Commande: ['id','client_email','client_name','items','total_price','total','subtotal','shipping','status','payment_status','payment_method','payment_intent_id','shipping_address','tracking_number','notes','created_at','updated_at','created_by_id'],
  Reservation: ['id','user_email','user_name','client_email','client_name','pro_email','pro_name','service_id','service_name','date','time','time_slot','end_time_slot','duration_min','persons','status','price','service_price','total_price','notes','custom_answers','custom_answer_labels','created_at','updated_at','created_by_id'],
  LiveSession: ['id','host_email','host_name','host_avatar','title','description','category','status','viewers_count','viewers','mux_stream_key','mux_playback_id','thumbnail_url','started_at','ended_at','created_at','updated_at','created_by_id'],
  LiveMessage: ['id','session_id','user_email','user_name','user_avatar','sender_email','sender_name','sender_avatar','content','type','created_at','updated_at','created_by_id'],
  Avis: ['id','user_email','user_name','user_avatar','pro_email','service_id','service_name','rating','comment','status','created_at','updated_at','created_by_id'],
  MembreEquipe: ['id','pro_email','membre_email','membre_name','membre_avatar','name','role','specialites','specialties','experience','days','horaires','status','created_at','updated_at','created_by_id'],
  ProfilPro: ['id','user_email','nom','prenom','salon_name','bio','specialites','avatar_url','cover_url','address','city','phone','status','rating','reviews_count','travail_nuit','horaires','jours_repos','conges','ouverture','team_emails','latitude','longitude','_lat','_lng','abonnement','abonnement_expires_at','stripe_customer_id','categorie','tags','galerie_urls','presentation_video_url','website','instagram','facebook','services_count','followers','created_at','updated_at','created_by_id'],
  DemandeProV2: ['id','user_email','username','nom','prenom','phone','address','city','specialite','experience','description','cv_url','portfolio_urls','status','admin_notes','statut','siret','salon_name','bio','type_activite','categorie','years_experience','services','categories','specialites_cheveux','salon_photo','portfolio','email_pro','doc_identite_recto','doc_identite_verso','doc_siret','doc_assurance','days','time_slots','commodites','seats_count','se_deplace','travail_nuit','visite_video_url','diplomes','has_diplome','created_at','updated_at','created_by_id'],
  DemandefFranchise: ['id','user_email','user_name','full_name','email','phone','city','budget','experience','message','status','created_at','updated_at','created_by_id'],
  CatalogueOption: ['id','name','description','price','duration_min','service_id','pro_email','category','usage_count','created_at','updated_at','created_by_id'],
  ServiceBundle: ['id','pro_email','name','description','service_ids','style_ids','bundle_price','discount_percent','image_url','cover_url','banner_url','is_active','is_group','min_persons','max_persons','bundle_price_per_person','category','bonus','created_at','updated_at'],
  AppConfig: ['id','key','value','description','created_at','updated_at'],
  ImmobilierListing: ['id','title','description','price','unit','images','address','city','location','postal_code','type','status','pro_email','bedrooms','bathrooms','area','surface','seats_count','equip','extra','features','estimated_turnover','estimated_net_revenue','virtual_tour_id','created_at','updated_at','created_by_id'],
  PointsFidelite: ['id','user_email','points','points_total','total_earned','total_spent','points_depenses','level','niveau','history','historique','code_parrainage','created_at','updated_at','created_by_id'],
  PointsFidelitePro: ['id','pro_email','points_total','points_depenses','niveau','created_at','updated_at','created_by_id'],
  SoldeBeautyPay: ['id','user_email','balance','solde','currency','transactions','created_at','updated_at','created_by_id'],
  VisiteVirtuelle: ['id','pro_email','name','title','scenes','floorplan_url','status','created_at','updated_at','created_by_id'],
  CallSignal: ['id','call_id','caller_email','caller_name','callee_email','signal_type','type','signal_data','payload','status','created_at','updated_at','created_by_id'],
  RoutineBeaute: ['id','user_email','name','emoji','description','steps','tasks','frequency','status','reminders','reminder_active','category','created_at','updated_at','created_by_id'],
  CommentaireStyle: ['id','style_id','user_email','user_name','user_avatar','content','likes','created_at','updated_at','created_by_id'],
  CallLog: ['id','caller_email','callee_email','started_at','ended_at','duration','status','created_at','updated_at'],
  MariaConversation: ['id','user_email','title','messages','status','created_at','updated_at','created_by_id'],
  Repub: ['id','user_email','reel_id','created_at'],
  user_like: ['id','user_email','user_name','user_avatar','target_id','target_type','created_at'],
  reel_comment: ['id','reel_id','user_email','user_name','user_avatar','content','likes','parent_id','created_at','updated_at'],
  user_follow: ['id','follower_email','follower_name','follower_avatar','followed_email','created_at'],
  user_favorite: ['id','user_email','target_id','target_type','target_title','target_image','target_data','created_at'],
  profiles: ['id','email','role'],
};

const REQUIRED_DEFAULTS = {
  Style: { pro_email: 'admin@beautybook.com', author_email: 'admin@beautybook.com', author_name: 'Admin' },
  Produit: { pro_email: 'admin@beautybook.com' },
  Service: { pro_email: 'admin@beautybook.com' },
  Reel: { author_email: 'admin@beautybook.com', author_name: 'Admin' },
  Publication: { author_email: 'admin@beautybook.com', author_name: 'Admin' },
  Notification: { user_email: 'admin@beautybook.com' },
  Reservation: { user_email: 'admin@beautybook.com' },
  Commande: { client_email: 'admin@beautybook.com' },
};

async function getTableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);
  try {
    const { data: sample } = await supabaseAdmin.from(table).select('*').limit(1);
    if (sample && sample.length > 0) {
      const cols = Object.keys(sample[0]);
      columnCache.set(table, cols);
      return cols;
    }
    if (FALLBACK_COLUMNS[table]) {
      columnCache.set(table, FALLBACK_COLUMNS[table]);
      return FALLBACK_COLUMNS[table];
    }
    return null;
  } catch {
    if (FALLBACK_COLUMNS[table]) return FALLBACK_COLUMNS[table];
    return null;
  }
}

function filterColumns(data, allowedColumns) {
  if (!allowedColumns) return data;
  const filtered = {};
  for (const key of Object.keys(data)) {
    if (allowedColumns.includes(key)) {
      filtered[key] = data[key];
    }
  }
  return filtered;
}

export const runMigration = async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    let result;
    try {
      result = await supabaseAdmin.rpc('exec_sql', { query: sql });
    } catch (rpcErr) {
      console.warn('[runMigration] rpc failed:', rpcErr.message);
      // Try via raw query as fallback
      try {
        result = await supabaseAdmin.from('_sql').select('*').match({ query: sql });
      } catch {
        // If both fail, report but still clear cache
      }
    }
    columnCache.clear();
    return res.json({ success: true, error: result?.error?.message || null });
  } catch (e) {
    console.error('[runMigration] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

export const runMigrations = async (req, res) => {
  const migrations = [
    // ── Tables auto-créées si manquantes ──
    `CREATE TABLE IF NOT EXISTS user_like (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT 'reel',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ul_target ON user_like(target_id, target_type)`,
    `CREATE INDEX IF NOT EXISTS idx_ul_user ON user_like(user_email)`,
    `DO $$ BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ul_unique ON user_like(user_email, target_id, target_type);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `ALTER TABLE user_like ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "ul_all" ON user_like`,
    `CREATE POLICY "ul_all" ON user_like FOR ALL USING (true) WITH CHECK (true)`,

    `CREATE TABLE IF NOT EXISTS reel_comment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      likes INTEGER DEFAULT 0,
      reactions JSONB DEFAULT NULL,
      parent_id UUID DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rc_reel ON reel_comment(reel_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rc_parent ON reel_comment(parent_id)`,
    `ALTER TABLE reel_comment ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "rc_all" ON reel_comment`,
    `CREATE POLICY "rc_all" ON reel_comment FOR ALL USING (true) WITH CHECK (true)`,

    `CREATE TABLE IF NOT EXISTS reel_comment_report (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id UUID NOT NULL,
      reporter_email TEXT NOT NULL DEFAULT '',
      reel_id TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rcr_comment ON reel_comment_report(comment_id)`,
    `ALTER TABLE reel_comment_report ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "rcr_all" ON reel_comment_report`,
    `CREATE POLICY "rcr_all" ON reel_comment_report FOR ALL USING (true) WITH CHECK (true)`,

    `CREATE TABLE IF NOT EXISTS user_follow (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_email TEXT NOT NULL DEFAULT '',
      follower_name TEXT NOT NULL DEFAULT '',
      follower_avatar TEXT NOT NULL DEFAULT '',
      followed_email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_uf_followed ON user_follow(followed_email)`,
    `DO $$ BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_uf_unique ON user_follow(follower_email, followed_email);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `ALTER TABLE user_follow ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "uf_all" ON user_follow`,
    `CREATE POLICY "uf_all" ON user_follow FOR ALL USING (true) WITH CHECK (true)`,

    `CREATE TABLE IF NOT EXISTS user_favorite (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT 'reel',
      target_title TEXT NOT NULL DEFAULT '',
      target_image TEXT NOT NULL DEFAULT '',
      target_data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ufav_user ON user_favorite(user_email)`,
    `ALTER TABLE user_favorite ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "ufav_all" ON user_favorite`,
    `CREATE POLICY "ufav_all" ON user_favorite FOR ALL USING (true) WITH CHECK (true)`,

    // ── Ajouter reactions si la table reel_comment existe déjà sans cette colonne ──
    `DO $$ BEGIN
      ALTER TABLE reel_comment ADD COLUMN reactions JSONB DEFAULT NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$`,

    // ── Migrations existantes ──
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beauty_interests JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0`,
    `ALTER TABLE public."ProfilPro" ADD COLUMN IF NOT EXISTS ouverture JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE public."MembreEquipe" ADD COLUMN IF NOT EXISTS experience TEXT`,
    `ALTER TABLE public."MembreEquipe" ADD COLUMN IF NOT EXISTS days TEXT[] DEFAULT '{}'`,
    `ALTER TABLE public."CatalogueOption" ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE public."CatalogueOption" ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0`,
    `ALTER TABLE public."Annonce" ADD COLUMN IF NOT EXISTS sponsor_name TEXT`,
    `ALTER TABLE public."LiveSession" ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE public."LiveSession" ADD COLUMN IF NOT EXISTS viewers INTEGER DEFAULT 0`,
    `ALTER TABLE public."CallSignal" ADD COLUMN IF NOT EXISTS caller_name TEXT`,
    `ALTER TABLE public."CallSignal" ADD COLUMN IF NOT EXISTS status TEXT`,
    `ALTER TABLE public."CallSignal" ADD COLUMN IF NOT EXISTS type TEXT`,
    `ALTER TABLE public."CallSignal" ADD COLUMN IF NOT EXISTS payload TEXT`,
    `ALTER TABLE public."MessageChat" ADD COLUMN IF NOT EXISTS conversation_id TEXT`,
    `ALTER TABLE public."MessageChat" ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false`,
    `ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS icon TEXT`,
    `ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS body TEXT`,
    `ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false`,
    `ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS old_price NUMERIC`,
    `ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS external_url TEXT`,
    `ALTER TABLE public."Produit" ADD COLUMN IF NOT EXISTS min_qty INTEGER`,
    `ALTER TABLE public."Commande" ADD COLUMN IF NOT EXISTS subtotal NUMERIC`,
    `ALTER TABLE public."Commande" ADD COLUMN IF NOT EXISTS shipping NUMERIC`,
    `ALTER TABLE public."Commande" ADD COLUMN IF NOT EXISTS total NUMERIC`,
    `ALTER TABLE public."Commande" ADD COLUMN IF NOT EXISTS payment_method TEXT`,
    `ALTER TABLE public."PointsFidelite" ADD COLUMN IF NOT EXISTS points_total INTEGER DEFAULT 0`,
    `ALTER TABLE public."PointsFidelite" ADD COLUMN IF NOT EXISTS points_depenses INTEGER DEFAULT 0`,
    `ALTER TABLE public."PointsFidelite" ADD COLUMN IF NOT EXISTS niveau TEXT DEFAULT 'Silver'`,
    `ALTER TABLE public."PointsFidelite" ADD COLUMN IF NOT EXISTS historique JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."PointsFidelite" ADD COLUMN IF NOT EXISTS code_parrainage TEXT`,
    `ALTER TABLE public."SoldeBeautyPay" ADD COLUMN IF NOT EXISTS solde NUMERIC DEFAULT 0`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS salon_name TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS type_activite TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS categorie TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS specialites_cheveux JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS salon_photo TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS portfolio JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS email_pro TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS doc_identite_recto TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS doc_identite_verso TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS doc_siret TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS doc_assurance TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS days JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS commodites JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS seats_count INTEGER DEFAULT 1`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS se_deplace BOOLEAN DEFAULT false`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS travail_nuit BOOLEAN DEFAULT false`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS visite_video_url TEXT`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS diplomes JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."DemandeProV2" ADD COLUMN IF NOT EXISTS has_diplome BOOLEAN DEFAULT false`,
    `ALTER TABLE public."DemandefFranchise" ADD COLUMN IF NOT EXISTS full_name TEXT`,
    `ALTER TABLE public."DemandefFranchise" ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE public."DemandefFranchise" ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE public."RoutineBeaute" ADD COLUMN IF NOT EXISTS emoji TEXT`,
    `ALTER TABLE public."RoutineBeaute" ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."RoutineBeaute" ADD COLUMN IF NOT EXISTS reminder_active BOOLEAN DEFAULT false`,
    `ALTER TABLE public."LiveMessage" ADD COLUMN IF NOT EXISTS sender_email TEXT`,
    `ALTER TABLE public."LiveMessage" ADD COLUMN IF NOT EXISTS sender_name TEXT`,
    `ALTER TABLE public."LiveMessage" ADD COLUMN IF NOT EXISTS sender_avatar TEXT`,
    `ALTER TABLE public."MembreEquipe" ADD COLUMN IF NOT EXISTS name TEXT`,
    `ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS title TEXT`,
    `ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS style TEXT`,
    `ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 60`,
    `ALTER TABLE public."Service" ADD COLUMN IF NOT EXISTS price_ht NUMERIC DEFAULT 0`,
    `ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `ALTER TABLE public."Style" ADD COLUMN IF NOT EXISTS produits_utilises jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."Reel" ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public."Reel" ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0`,
    // ServiceBundle new columns
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS min_persons INTEGER DEFAULT 1`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS max_persons INTEGER DEFAULT 1`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS bundle_price_per_person NUMERIC(10,2)`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'autre'`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS bonus TEXT`,
    `ALTER TABLE public."ServiceBundle" ADD COLUMN IF NOT EXISTS style_ids TEXT[] DEFAULT '{}'`,
    `ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE public."Reservation" ADD COLUMN IF NOT EXISTS custom_answer_labels JSONB DEFAULT '{}'::jsonb`,
  ];

  let success = 0, failed = 0, errors = [];
  for (const sql of migrations) {
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql }).catch(() => ({ error: { message: 'rpc not available' } }));
      if (error && !error.message?.includes('already exists')) {
        failed++;
        errors.push(`${sql.substring(0, 50)}... → ${error.message.substring(0, 80)}`);
      } else {
        success++;
      }
    } catch (e) {
      failed++;
      errors.push(`${sql.substring(0, 50)}... → ${e.message.substring(0, 80)}`);
    }
  }
  columnCache.clear();
  return res.json({ success, failed, total: migrations.length, errors: errors.slice(0, 20) });
};

export const crudCreate = async (req, res) => {
  try {
    const { table, data } = req.body;
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: `Table non autorisée: ${table}` });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data requis' });
    }

    const userId = req.user?.id;
    const payload = { ...data };
    if (userId) payload.created_by_id = userId;
    
    if (REQUIRED_DEFAULTS[table]) {
      for (const [col, def] of Object.entries(REQUIRED_DEFAULTS[table])) {
        if (!payload[col]) payload[col] = def;
      }
    }
    
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    let columns = await getTableColumns(table);
    if (!columns) {
      return res.status(400).json({ error: `Table "${table}" inconnue. Créez-la via Supabase Dashboard > SQL Editor.` });
    }
    let cleanPayload = filterColumns(payload, columns);

    console.log('[crudCreate]', table, JSON.stringify(cleanPayload).substring(0, 200));

    let { data: result, error } = await supabaseAdmin.from(table).insert(cleanPayload).select().single();

    // Smart retry: strip problematic columns on schema cache errors
    let strippedCols = [];
    while (error && (error.message?.includes('schema cache') || error.code === 'PGRST204') && strippedCols.length < 10) {
      const match = error.message?.match(/(?:column ["'](\w+)["']|the ["'](\w+)["'] column)/);
      const badCol = match ? (match[1] || match[2]) : null;
      if (!badCol || strippedCols.includes(badCol)) break;
      console.warn(`[crudCreate] Stripping column "${badCol}" and retrying...`);
      strippedCols.push(badCol);
      columnCache.delete(table);
      columns = (await getTableColumns(table))?.filter(c => !strippedCols.includes(c));
      if (!columns || columns.length === 0) break;
      cleanPayload = filterColumns(payload, columns);
      ({ data: result, error } = await supabaseAdmin.from(table).insert(cleanPayload).select().single());
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ result });
  } catch (error) {
    console.error(`crudCreate error:`, error);
    return res.status(500).json({ error: error.message });
  }
};

export const crudUpdate = async (req, res) => {
  try {
    const { table, id, data } = req.body;
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: `Table non autorisée: ${table}` });
    }
    if (!id) return res.status(400).json({ error: 'id requis' });
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data requis' });
    }

    const payload = { ...data, updated_at: new Date().toISOString() };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

    let cleanPayload = payload;
    if (table !== 'profiles') {
      let columns = await getTableColumns(table);
      if (columns) cleanPayload = filterColumns(payload, columns);
    }

    console.log('[crudUpdate]', table, id, JSON.stringify(cleanPayload).substring(0, 200));

    let { data: result, error } = await supabaseAdmin.from(table).update(cleanPayload).eq('id', id).select().single();

    let strippedCols = [];
    while (error && (error.message?.includes('schema cache') || error.code === 'PGRST204') && strippedCols.length < 10) {
      const match = error.message?.match(/(?:column ["'](\w+)["']|the ["'](\w+)["'] column)/);
      const badCol = match ? (match[1] || match[2]) : null;
      if (!badCol || strippedCols.includes(badCol)) break;
      console.warn(`[crudUpdate] Stripping column "${badCol}" and retrying...`);
      strippedCols.push(badCol);
      columnCache.delete(table);
      let columns = (await getTableColumns(table))?.filter(c => !strippedCols.includes(c));
      if (!columns || columns.length === 0) break;
      cleanPayload = filterColumns(payload, columns);
      ({ data: result, error } = await supabaseAdmin.from(table).update(cleanPayload).eq('id', id).select().single());
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ result });
  } catch (error) {
    console.error('[crudUpdate] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const crudFilter = async (req, res) => {
  try {
    const { table, filters } = req.body;
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: `Table non autorisée: ${table}` });
    }
    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ error: 'filters requis' });
    }

    let query = supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }).limit(1000);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ result: data || [] });
  } catch (error) {
    console.error('[crudFilter] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const crudDelete = async (req, res) => {
  try {
    const { table, id } = req.body;
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: `Table non autorisée: ${table}` });
    }
    if (!id) return res.status(400).json({ error: 'id requis' });

    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    console.error(`crudDelete error:`, error);
    return res.status(500).json({ error: error.message });
  }
};
