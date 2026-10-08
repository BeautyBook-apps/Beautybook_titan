import { supabase } from '@/api/supabaseClient';

/**
 * Couche d'abstraction compatible Base44.
 * Remplace entities.NomTable.filter/create/update/delete/get/list
 *
 * - Reads (filter/list/get) → direct Supabase (anon key)
 * - Writes (create/update/delete) → backend /api/crud (service_role, bypasses RLS)
 */

const CRUD_API = import.meta.env.VITE_BACKEND_URL || '';

const parseOrder = (orderBy) => {
  if (!orderBy) return { column: 'created_at', ascending: false };
  const desc = orderBy.startsWith('-');
  const raw = desc ? orderBy.slice(1) : orderBy;
  const colMap = {
    created_date: 'created_at',
    updated_date: 'updated_at',
    created_at: 'created_at',
    updated_at: 'updated_at',
    date: 'date',
    rating: 'rating',
    price: 'price',
    likes: 'likes',
    views: 'views',
    name: 'name',
    title: 'title',
  };
  return { column: colMap[raw] || raw, ascending: !desc };
};

const KNOWN_COLUMNS = {
  Reel: ['id','title','description','video_url','thumbnail_url','images','category','tags','status','pub_type','likes','views','comments_count','author_email','author_name','author_avatar','is_sponsored','music_title','music_artist','music_url','product_id','product_name','product_img','service_id','service_name','created_at','updated_at','created_by_id'],
  Style: ['id','title','description','category','images','image_url','video_url','tags','pro_email','status','likes','views','featured','author_email','author_name','author_avatar','created_at','updated_at'],
  Produit: ['id','name','description','price','old_price','images','category','brand','stock','status','tags','rating','reviews_count','shopify_id','source','featured','external_url','min_qty','delivery_time','free_shipping','return_policy','created_at','updated_at','created_by_id'],
  Publication: ['id','author_email','author_name','author_avatar','content','images','video_url','type','status','likes','comments_count','tags','created_at','updated_at','created_by_id'],
  Service: ['id','name','title','description','price','category','subcategory','style','duration_min','images','pro_email','status','addons','tags','rating','reviews_count','max_persons','promo_price','promo_ends_at','created_at','updated_at','created_by_id'],
  Notification: ['id','user_email','title','message','body','type','is_read','read','icon','action_url','data','created_at','updated_at','created_by_id'],
  MessageChat: ['id','conversation_id','sender_email','sender_avatar','receiver_email','receiver_avatar','content','attachment_url','is_read','read','reservation_id','is_maria','created_at','updated_at','created_by_id'],
  Commande: ['id','client_email','client_name','items','total_price','total','subtotal','shipping','status','payment_status','payment_method','payment_intent_id','shipping_address','tracking_number','notes','created_at','updated_at','created_by_id'],
  PointsFidelite: ['id','user_email','points','points_total','total_earned','total_spent','points_depenses','level','niveau','history','historique','code_parrainage','created_at','updated_at','created_by_id'],
  SoldeBeautyPay: ['id','user_email','balance','solde','currency','transactions','created_at','updated_at','created_by_id'],
  CallSignal: ['id','call_id','caller_email','caller_name','callee_email','signal_type','type','signal_data','payload','status','created_at','updated_at','created_by_id'],
  LiveSession: ['id','host_email','host_name','host_avatar','title','description','category','status','viewers_count','viewers','mux_stream_key','mux_playback_id','thumbnail_url','started_at','ended_at','created_at','updated_at','created_by_id'],
  LiveMessage: ['id','session_id','user_email','user_name','user_avatar','sender_email','sender_name','sender_avatar','content','type','created_at','updated_at','created_by_id'],
  DemandeProV2: ['id','user_email','username','nom','prenom','phone','address','city','specialite','experience','description','cv_url','portfolio_urls','status','admin_notes','statut','siret','salon_name','bio','type_activite','years_experience','services','categories','specialites_cheveux','salon_photo','portfolio','email_pro','doc_identite_recto','doc_identite_verso','doc_siret','doc_assurance','days','time_slots','commodites','seats_count','se_deplace','travail_nuit','visite_video_url','diplomes','has_diplome','created_at','updated_at','created_by_id'],
  DemandefFranchise: ['id','user_email','user_name','full_name','email','phone','city','budget','experience','message','status','created_at','updated_at','created_by_id'],
  MembreEquipe: ['id','pro_email','membre_email','membre_name','membre_avatar','name','role','specialites','specialties','experience','days','horaires','status','created_at','updated_at','created_by_id'],
  CatalogueOption: ['id','name','description','price','duration_min','service_id','pro_email','category','usage_count','created_at','updated_at','created_by_id'],
  Annonce: ['id','title','description','type','target_url','status','pro_email','pro_name','sponsor_name','budget','start_date','end_date','impressions','clicks','created_at','updated_at','created_by_id'],
  ProfilPro: ['id','user_email','nom','prenom','salon_name','bio','specialites','avatar_url','cover_url','address','city','phone','status','rating','reviews_count','travail_nuit','horaires','jours_repos','conges','ouverture','team_emails','latitude','longitude','_lat','_lng','abonnement','abonnement_expires_at','stripe_customer_id','categorie','tags','galerie_urls','presentation_video_url','website','instagram','facebook','services_count','followers','created_at','updated_at','created_by_id'],
  RoutineBeaute: ['id','user_email','name','emoji','description','steps','tasks','frequency','status','reminders','reminder_active','category','created_at','updated_at','created_by_id'],
  profiles: ['id','email','full_name','avatar_url','cover_url','role','gender','beauty_interests','maria_name','maria_memory','created_at','updated_at'],
  user_like: ['id','user_email','user_name','user_avatar','target_id','target_type','created_at'],
  user_favorite: ['id','user_email','target_id','target_type','target_title','target_image','target_data','created_at'],
  reel_comment: ['id','reel_id','user_email','user_name','user_avatar','content','likes','parent_id','created_at','updated_at'],
  user_follow: ['id','follower_email','follower_name','follower_avatar','followed_email','created_at'],
  ImmobilierListing: ['id','title','description','price','price_fonds_commerce','price_per_m2','tax_mode','salon_type','unit','surface','rooms','floor','type','status','city','address','location','area','postal_code','equip','extra','badge','images','video_url','contact_email','contact_phone','latitude','longitude','_lat','_lng','estimated_turnover','estimated_net_revenue','virtual_tour_id','created_at','updated_at','created_by_id'],
  ServiceBundle: ['id','pro_email','name','description','service_ids','bundle_price','discount_percent','image_url','is_active','is_group','min_persons','max_persons','bundle_price_per_person','category','bonus','created_at','updated_at'],
};

const stripUnknownColumns = async (tableName, payload) => {
  let known = KNOWN_COLUMNS[tableName];
  if (!known) {
    try {
      const { data } = await supabase.from(tableName).select('*').limit(1);
      if (data && data[0]) known = Object.keys(data[0]);
    } catch {}
  }
  if (!known || known.length === 0) return payload;
  const cleaned = {};
  for (const key of Object.keys(payload)) {
    if (known.includes(key)) cleaned[key] = payload[key];
  }
  return cleaned;
};

const createEntity = (tableName) => ({
  filter: async (filters = {}, orderBy = '-created_at', limit = 1000) => {
    const applyFilters = (q) => {
      if (filters && Object.keys(filters).length > 0) {
        for (const [k, v] of Object.entries(filters)) {
          q = q.eq(k, v);
        }
      }
      return q;
    };
    const applyOrder = (q) => {
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const raw = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
        const colMap = { created_date: 'created_at', updated_date: 'updated_at', created_at: 'created_at', updated_at: 'updated_at' };
        q = q.order(colMap[raw] || raw, { ascending: !desc });
      }
      return q;
    };
    // Aller directement à Supabase si pas de backend
    if (!CRUD_API) {
      try {
        let query = supabase.from(tableName).select('*');
        query = applyFilters(query);
        query = applyOrder(query);
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) return [];
        return data || [];
      } catch { return []; }
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, orderBy, limit }),
      });
      if (!res.ok) throw new Error('List failed');
      const { result } = await res.json();
      let data = result || [];
      if (filters && Object.keys(filters).length > 0) {
        data = data.filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      }
      return data;
    } catch (e) {
      try {
        let query = supabase.from(tableName).select('*');
        query = applyFilters(query);
        query = applyOrder(query);
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) return [];
        return data || [];
      } catch { return []; }
    }
  },

  list: async (orderBy = '-created_at', limit = 1000) => {
    if (!CRUD_API) {
      try {
        const { column, ascending } = parseOrder(orderBy);
        const { data, error } = await supabase.from(tableName).select('*').order(column, { ascending }).limit(limit);
        if (error) return [];
        return data || [];
      } catch { return []; }
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, orderBy, limit }),
      });
      if (!res.ok) throw new Error('List failed');
      const { result } = await res.json();
      return result || [];
    } catch (e) {
      try {
        const { column, ascending } = parseOrder(orderBy);
        const { data, error } = await supabase.from(tableName).select('*').order(column, { ascending }).limit(limit);
        if (error) return [];
        return data || [];
      } catch { return []; }
    }
  },

  get: async (id) => {
    if (!CRUD_API) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
        if (error) return null;
        return data;
      } catch { return null; }
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, orderBy: '-created_at', limit: 1 }),
      });
      if (!res.ok) throw new Error('Get failed');
      const { result } = await res.json();
      return (result || []).find(r => r.id === id) || null;
    } catch (e) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
        if (error) return null;
        return data;
      } catch { return null; }
    }
  },

  create: async (data) => {
    const payload = { ...data };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    if (!CRUD_API) {
      const cleanPayload = await stripUnknownColumns(tableName, payload);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Vous devez être connecté pour effectuer cette action.');
      }
      const { data: result, error } = await supabase.from(tableName).insert(cleanPayload).select().single();
      if (error) throw error;
      return { data: { [tableName.toLowerCase()]: result }, result };
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, data: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' }));
        throw new Error(err.error || 'Create failed');
      }
      const { result } = await res.json();
      return result;
    } catch (e) {
      throw e;
    }
  },

  update: async (id, data) => {
    const payload = { ...data };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    if (!CRUD_API) {
      const cleanPayload = await stripUnknownColumns(tableName, payload);
      const { data: result, error } = await supabase.from(tableName).update(cleanPayload).eq('id', id).select().single();
      if (error) throw error;
      return { data: { [tableName.toLowerCase()]: result }, result };
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, id, data: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(err.error || 'Update failed');
      }
      const { result } = await res.json();
      return result;
    } catch (e) {
      const cleanPayload = await stripUnknownColumns(tableName, payload);
      const { data: result, error } = await supabase.from(tableName).update(cleanPayload).eq('id', id).select().single();
      if (error) throw error;
      return { data: { [tableName.toLowerCase()]: result }, result };
    }
  },

  delete: async (id) => {
    if (!CRUD_API) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    try {
      const res = await fetch(`${CRUD_API}/crud/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || 'Delete failed');
      }
      return true;
    } catch (e) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  },
  subscribe: (callback) => {
    const channel = supabase
      .channel(`realtime:${tableName}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          const type = payload.eventType === 'INSERT' ? 'create'
                     : payload.eventType === 'UPDATE' ? 'update'
                     : 'delete';
          callback({ type, data: payload.new || payload.old, id: (payload.new || payload.old)?.id });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
});

export const entities = {
  ProfilPro:          createEntity('ProfilPro'),
  Service:            createEntity('Service'),
  Reservation:        createEntity('Reservation'),
  Avis:               createEntity('Avis'),
  Style:              createEntity('Style'),
  Reel:               createEntity('Reel'),
  CommentaireStyle:   createEntity('CommentaireStyle'),
  MessageChat:        createEntity('MessageChat'),
  Notification:       createEntity('Notification'),
  Produit:            createEntity('Produit'),
  Commande:           createEntity('Commande'),
  Annonce:            createEntity('Annonce'),
  AppConfig:          createEntity('AppConfig'),
  CallLog:            createEntity('CallLog'),
  CallSignal:         createEntity('CallSignal'),
  CatalogueOption:    createEntity('CatalogueOption'),
  DemandeProV2:       createEntity('DemandeProV2'),
  DemandefFranchise:  createEntity('DemandefFranchise'),
  ImmobilierListing:  createEntity('ImmobilierListing'),
  LiveMessage:        createEntity('LiveMessage'),
  LiveSession:        createEntity('LiveSession'),
  MariaConversation:  createEntity('MariaConversation'),
  MembreEquipe:       createEntity('MembreEquipe'),
  PointsFidelite:     createEntity('PointsFidelite'),
  PointsFidelitePro:  createEntity('PointsFidelitePro'),
  Publication:        createEntity('Publication'),
  Repub:              createEntity('Repub'),
  RoutineBeaute:      createEntity('RoutineBeaute'),
  SoldeBeautyPay:     createEntity('SoldeBeautyPay'),
  Panier:             createEntity('Panier'),
  UserMemory:         createEntity('UserMemory'),
  VerificationCode:   createEntity('VerificationCode'),
  VisiteVirtuelle:    createEntity('VisiteVirtuelle'),
  Like:               createEntity('user_like'),
  Favori:             createEntity('user_favorite'),
  CommentaireReel:    createEntity('reel_comment'),
  User:               createEntity('profiles'),
  profiles:           createEntity('profiles'),
  ServiceBundle:      createEntity('ServiceBundle'),
};

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

import { compressMedia } from '@/lib/compressMedia';

export const uploadFile = async (fileOrObj, bucket = 'uploads') => {
  const rawFile = (fileOrObj && fileOrObj.file instanceof File) ? fileOrObj.file : fileOrObj;
  if (!rawFile || !(rawFile instanceof File)) {
    console.error('[uploadFile] Argument invalide', fileOrObj);
    throw new Error('uploadFile: argument invalide');
  }

  if (!supabase || !supabase.storage) {
    console.error('[uploadFile] Client Supabase non configuré. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local');
    throw new Error('Supabase non configuré. Ajoutez vos identifiants dans le fichier .env.local');
  }

  let file;
  try {
    file = await compressMedia(rawFile);
  } catch (compressErr) {
    console.warn('[uploadFile] Compression échouée, upload du fichier original:', compressErr);
    file = rawFile;
  }
  const safeName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const filePath = `${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType: file.type, upsert: true });

  if (error) {
    console.error('[uploadFile] Erreur Supabase:', error);
    if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
      throw new Error('Le bucket "uploads" n\'existe pas dans Supabase Storage. Exécutez le script fix_storage_setup.sql dans l\'éditeur SQL Supabase.');
    }
    throw new Error(error.message || 'Upload failed');
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { file_url: urlData.publicUrl };
};

export const fetchProduits = async (params = {}) => {
  try {
    const res = await fetch(`${CRUD_API}/crud/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'Produit', orderBy: '-created_at', limit: params.limit || 500 }),
    });
    if (!res.ok) throw new Error('List failed');
    let { result } = await res.json();
    result = result || [];
    if (params.status) result = result.filter(p => p.status === params.status);
    return result;
  } catch (e) {
    console.warn('[fetchProduits] backend failed, trying Supabase:', e.message);
    try {
      let query = supabase.from('Produit').select('*').order('created_at', { ascending: false });
      if (params.status) query = query.eq('status', params.status);
      if (params.limit) query = query.limit(params.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch { return []; }
  }
};
