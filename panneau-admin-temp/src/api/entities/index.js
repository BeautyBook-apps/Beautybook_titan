import apiClient, { localAdminEnabled } from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';

import { createAdminEntity } from './adminEntity.mjs';

// Legacy bb_local_* browser data is preserved, but must not masquerade as
// server records. Admin operations use the authenticated, audited API.
const createEntity = (tableName) => ({
  ...createAdminEntity(tableName, apiClient),
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

/* ─── Local-storage-backed stub for StyleCategory / StyleSubCategory ─── */
const SEED_CATEGORIES = [
  { id: 'coiffure',    name: 'Coiffure',         slug: 'coiffure',    icon: 'Scissors',   color: '#8B5CF6', is_active: true, styles_count: 0, subcategories_count: 3 },
  { id: 'tresses',     name: 'Tresses',          slug: 'tresses',     icon: 'Waves',      color: '#F43F5E', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'manucure',    name: 'Manucure',         slug: 'manucure',    icon: 'Gem',        color: '#F59E0B', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'pedicure',    name: 'Pédicure',         slug: 'pedicure',    icon: 'Star',       color: '#EC4899', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'maquillage',  name: 'Maquillage',       slug: 'maquillage',  icon: 'Brush',      color: '#D946EF', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'soin-visage', name: 'Soin Visage',      slug: 'soin-visage', icon: 'Droplets',   color: '#EF4444', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'barbe',       name: 'Barbe',            slug: 'barbe',       icon: 'Zap',        color: '#475569', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'extensions',  name: 'Extensions',       slug: 'extensions',  icon: 'Sparkles',   color: '#7C3AED', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'massage',     name: 'Massage',          slug: 'massage',     icon: 'Flower2',    color: '#10B981', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'epilation',   name: 'Épilation',        slug: 'epilation',   icon: 'Wind',       color: '#818CF8', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'cils',        name: 'Cils & Sourcils',  slug: 'cils',        icon: 'Eye',        color: '#06B6D4', is_active: true, styles_count: 0, subcategories_count: 0 },
  { id: 'spa',         name: 'Spa & Bien-être',  slug: 'spa',         icon: 'Heart',      color: '#D97706', is_active: true, styles_count: 0, subcategories_count: 0 },
];
const SEED_SUBCATEGORIES = [
  { id: 'coupe-femme',    name: 'Coupe Femme',    slug: 'coupe-femme',    category_id: 'coiffure', is_active: true, styles_count: 0 },
  { id: 'coupe-homme',    name: 'Coupe Homme',    slug: 'coupe-homme',    category_id: 'coiffure', is_active: true, styles_count: 0 },
  { id: 'coloration',     name: 'Coloration',     slug: 'coloration',     category_id: 'coiffure', is_active: true, styles_count: 0 },
];

const LS_KEY_CAT = 'bb_style_categories';
const LS_KEY_SUB = 'bb_style_subcategories';
const _now = () => new Date().toISOString();
const _uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

const _loadStore = (key, seed) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed; }
  } catch {}
  const seeded = seed.map(s => ({ ...s, created_at: _now(), updated_at: _now() }));
  localStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
};
const _saveStore = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

const createLocalEntity = (lsKey, seedData) => ({
  list: async (_orderBy, _limit) => _loadStore(lsKey, seedData),
  filter: async (filters = {}) => {
    let rows = _loadStore(lsKey, seedData);
    if (filters && Object.keys(filters).length > 0) {
      rows = rows.filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
    }
    return rows;
  },
  getById: async (id) => _loadStore(lsKey, seedData).find(r => r.id === id) || null,
  create: async (payload) => {
    const rows = _loadStore(lsKey, seedData);
    const row = { ...payload, id: payload.id || _uuid(), created_at: _now(), updated_at: _now() };
    rows.push(row);
    _saveStore(lsKey, rows);
    return row;
  },
  update: async (id, patch) => {
    const rows = _loadStore(lsKey, seedData);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updated_at: _now() };
    _saveStore(lsKey, rows);
    return rows[idx];
  },
  delete: async (id) => {
    let rows = _loadStore(lsKey, seedData);
    rows = rows.filter(r => r.id !== id);
    _saveStore(lsKey, rows);
    return true;
  },
});

export const entities = {
  ProfilPro:          createEntity('ProfilPro'),
  Service:            createEntity('Service'),
  Reservation:        createEntity('Reservation'),
  Avis:               createEntity('Avis'),
  Style:              createEntity('Style'),
  StyleCategory:      createLocalEntity(LS_KEY_CAT, SEED_CATEGORIES),
  StyleSubCategory:   createLocalEntity(LS_KEY_SUB, SEED_SUBCATEGORIES),
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
  Client:             createEntity('Client'),
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
};


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

  if (localAdminEnabled && bucket === 'uploads') {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Lecture du média impossible.'));
      reader.readAsDataURL(file);
    });
    return apiClient.post('/admin/upload', { name: safeName, contentType: file.type, base64 });
  }

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

export const fetchProduits = (params = {}) => entities.Produit.filter(
  params.status ? { status: params.status } : {}, '-created_at', params.limit || 500
);
