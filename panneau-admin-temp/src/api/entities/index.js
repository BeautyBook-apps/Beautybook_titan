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

/* ─── Local preview data for StyleCategory / StyleSubCategory ───
 * The remote API remains the source of truth. These rows only keep the admin
 * taxonomy visible while the Supabase migration is being deployed. */
const slugify = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const STYLE_TAXONOMY = [
  { id: "coiffure", name: "Coiffure", icon: "Scissors", color: "#E8732A", description: "Coupes, coiffage et techniques capillaires", subs: ["Coupe Femme", "Coupe Homme", "Coupe Enfant", "Brushing", "Coloration", "Décoloration", "Lissage", "Permanente", "Chignon", "Coiffure de mariage"] },
  { id: "perruque", name: "Perruque", icon: "Sparkles", color: "#7C3AED", description: "Perruques, lace wigs et poses", subs: ["Lace Wig", "Closure", "Frontale", "Perruque naturelle", "Perruque synthétique", "Pose de perruque", "Entretien de perruque"] },
  { id: "tresses", name: "Tresses", icon: "Waves", color: "#F43F5E", description: "Tresses protectrices et coiffures afro", subs: ["Box Braids", "Knotless Braids", "Cornrows", "Fulani Braids", "Vanilles", "Twist", "Passion Twist", "Sisterlocks"] },
  { id: "extensions", name: "Extensions", icon: "Sparkles", color: "#8B5CF6", description: "Extensions, tissages et poses", subs: ["Clip-in", "Tape-in", "Kératine", "Tissage ouvert", "Tissage fermé", "Pose d'extensions", "Retrait d'extensions"] },
  { id: "maquillage", name: "Maquillage", icon: "Palette", color: "#D946EF", description: "Maquillage du visage, des yeux et des lèvres", subs: ["Naturel", "Mariage", "Glamour", "Soirée", "Artistique", "Professionnel", "Maquillage permanent", "Microblading", "Faux cils"] },
  { id: "ongles", name: "Ongles", icon: "Gem", color: "#EC4899", description: "Manucure, gel, résine et nail art", subs: ["Gel", "Résine", "Acrylique", "Semi-permanent", "Nail Art", "French", "Baby Boomer", "Capsules", "Chrome"] },
  { id: "pedicure", name: "Pédicure", icon: "Footprints", color: "#F59E0B", description: "Beauté et soin des pieds", subs: ["Pédicure classique", "Pédicure spa", "Semi-permanent", "Gel pieds", "French pieds", "Soin des pieds"] },
  { id: "soins", name: "Soin", icon: "Droplets", color: "#10B981", description: "Soins visage, corps et bien-être", subs: ["Soins visage", "Soins corps", "Hydratation", "Anti-âge", "Acné", "Éclat", "Détox", "Gommage"] },
  { id: "barbe", name: "Barbe", icon: "User", color: "#475569", description: "Taille, rasage et soins de la barbe", subs: ["Taille classique", "Taille design", "Dégradé", "Rasage complet", "Soin barbe", "Coloration barbe"] },
  { id: "massage", name: "Massage", icon: "Hand", color: "#F59E0B", description: "Massages relaxants et spécialisés", subs: ["Relaxant", "Sportif", "Thérapeutique", "Drainant", "Prénatal", "Hot Stone", "Aromathérapie"] },
  { id: "epilation", name: "Épilation", icon: "Zap", color: "#818CF8", description: "Épilation visage et corps", subs: ["Cire chaude", "Cire froide", "Épilation laser", "Sourcils", "Visage", "Corps", "Maillot"] },
  { id: "cils-sourcils", name: "Cils & Sourcils", icon: "Eye", color: "#06B6D4", description: "Mise en beauté du regard", subs: ["Extension cil à cil", "Volume russe", "Rehaussement de cils", "Teinture cils", "Brow Lift", "Teinture sourcils"] },
  { id: "spa-bien-etre", name: "Spa & Bien-être", icon: "Heart", color: "#14B8A6", description: "Rituels spa et relaxation", subs: ["Hammam", "Sauna", "Jacuzzi", "Rituel corps", "Rituel visage", "Balnéothérapie", "Détox"] },
  { id: "tatouage", name: "Tatouage", icon: "PenTool", color: "#0EA5E9", description: "Tatouage artistique et temporaire", subs: ["Blackwork", "Coloré", "Aquarelle", "Japonais", "Géométrique", "Cover-up", "Temporaire"] },
  { id: "piercing", name: "Piercing", icon: "Circle", color: "#8B5CF6", description: "Piercing des oreilles et du corps", subs: ["Lobe", "Cartilage", "Nez", "Sourcil", "Lèvre", "Nombril", "Corps"] },
].map(category => ({ ...category, slug: category.id }));

const SEED_CATEGORIES = STYLE_TAXONOMY.map(({ subs, ...category }) => ({
  ...category, is_active: true, styles_count: 0, subcategories_count: subs.length,
}));
const SEED_SUBCATEGORIES = STYLE_TAXONOMY.flatMap(category => category.subs.map(name => ({
  id: `${category.id}-${slugify(name)}`, name, slug: slugify(name), category_id: category.id,
  is_active: true, styles_count: 0,
})));

const LS_KEY_CAT = 'bb_style_categories';
const LS_KEY_SUB = 'bb_style_subcategories';
const TAXONOMY_LOCAL_ONLY_KEY = 'bb_style_taxonomy_local_only_v2';

const isTaxonomyLocalOnly = () => {
  try {
    const markedAt = Number(sessionStorage.getItem(TAXONOMY_LOCAL_ONLY_KEY));
    return Number.isFinite(markedAt) && markedAt > 0 && Date.now() - markedAt < 60_000;
  } catch { return false; }
};

const setTaxonomyLocalOnly = () => {
  try { sessionStorage.setItem(TAXONOMY_LOCAL_ONLY_KEY, String(Date.now())); } catch {}
};

const isMissingTaxonomySchema = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 404 || error?.status === 409
    || message.includes('could not find the table')
    || message.includes('schema cache')
    || message.includes('public.stylecategory')
    || message.includes('public.stylesubcategory');
};

const LEGACY_CATEGORY_IDS = {
  manucure: "ongles",
  "soin-visage": "soins",
  cils: "cils-sourcils",
  spa: "spa-bien-etre",
};
const _now = () => new Date().toISOString();
const _uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

const normalizePreviewRows = (key, rows) => {
  const normalized = rows.map(row => {
    if (key === LS_KEY_CAT) {
      const canonicalId = LEGACY_CATEGORY_IDS[row.id] || row.id;
      return { ...row, id: canonicalId, slug: canonicalId };
    }
    if (key === LS_KEY_SUB) {
      const categoryId = LEGACY_CATEGORY_IDS[row.category_id] || row.category_id;
      const rowId = String(row.id || "");
      const canonicalId = row.category_id === "coiffure" && !rowId.startsWith("coiffure-")
        ? `coiffure-${rowId}`
        : rowId;
      return { ...row, id: canonicalId, category_id: categoryId };
    }
    return row;
  });
  return [...new Map(normalized.map(row => [row.id, row])).values()];
};

const _loadStore = (key, seed) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = normalizePreviewRows(key, JSON.parse(raw));
      if (Array.isArray(parsed) && parsed.length) {
        const knownIds = new Set(parsed.map(item => item.id));
        const missing = seed
          .filter(item => !knownIds.has(item.id))
          .map(item => ({ ...item, created_at: _now(), updated_at: _now() }));
        if (missing.length) {
          const merged = [...parsed, ...missing];
          _saveStore(key, merged);
          return merged;
        }
        return parsed;
      }
    }
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

const createTaxonomyEntity = (tableName, lsKey, seedData) => {
  const remote = createEntity(tableName);
  const local = createLocalEntity(lsKey, seedData);
  const readWithFallback = async (operation, args) => {
    if (isTaxonomyLocalOnly()) return local[operation](...args);
    try {
      const rows = await remote[operation](...args);
      return rows;
    } catch (error) {
      if (isMissingTaxonomySchema(error)) {
        setTaxonomyLocalOnly();
        return local[operation](...args);
      }
      console.warn(`[${tableName}] remote taxonomy unavailable; showing local preview data`, error);
      return local[operation](...args);
    }
  };

  // Only reads use the preview. All writes stay on the authenticated admin API
  // so local data can never masquerade as a successful server mutation.
  return {
    ...remote,
    list: (...args) => readWithFallback("list", args),
    filter: (...args) => readWithFallback("filter", args),
    get: (...args) => readWithFallback("getById", args),
  };
};

export const entities = {
  ProfilPro:          createEntity('ProfilPro'),
  Service:            createEntity('Service'),
  Reservation:        createEntity('Reservation'),
  Avis:               createEntity('Avis'),
  Style:              createEntity('Style'),
  // Categories and subcategories share the same Supabase tables as the main app.
  StyleCategory:      createTaxonomyEntity('StyleCategory', LS_KEY_CAT, SEED_CATEGORIES),
  StyleSubCategory:   createTaxonomyEntity('StyleSubCategory', LS_KEY_SUB, SEED_SUBCATEGORIES),
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
  UserSubscription:   createEntity('UserSubscription'),
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

// Creates the default taxonomy in the secured admin API when the database is
// empty. It is deliberately idempotent: existing custom categories and
// subcategories are preserved and only missing slugs are inserted.
let taxonomyBootstrapPromise = null;

async function bootstrapDefaultStyleTaxonomy() {
  // The migration is not available in every local environment yet. Avoid
  // retrying the same 404/409 on every admin render while keeping the seeded
  // local preview available until the schema is deployed.
  if (isTaxonomyLocalOnly()) return { deferred: true, local: true };

  const categoryApi = createEntity('StyleCategory');
  const subcategoryApi = createEntity('StyleSubCategory');
  try {
    let categories = await categoryApi.list('-created_at', 500);
    const existingCategorySlugs = new Set((categories || []).map(category => category.slug));

    for (const category of SEED_CATEGORIES) {
      if (existingCategorySlugs.has(category.slug)) continue;
      await categoryApi.create({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || 'Palette',
        color: category.color || '#E8732A',
        is_active: true,
      });
    }

    categories = await categoryApi.list('-created_at', 500);
    const categoryIds = new Map((categories || []).map(category => [category.slug, category.id]));
    const subcategories = await subcategoryApi.list('-created_at', 1000);
    const existingSubcategories = new Set(
      (subcategories || []).map(subcategory => `${subcategory.category_id}:${subcategory.slug}`)
    );

    for (const subcategory of SEED_SUBCATEGORIES) {
      const categoryId = categoryIds.get(subcategory.category_id);
      if (!categoryId || existingSubcategories.has(`${categoryId}:${subcategory.slug}`)) continue;
      await subcategoryApi.create({
        name: subcategory.name,
        slug: subcategory.slug,
        category_id: categoryId,
        description: '',
        is_active: true,
      });
    }

    return { categories: categories?.length || 0, subcategories: subcategories?.length || 0 };
  } catch (error) {
    if (isMissingTaxonomySchema(error)) {
      setTaxonomyLocalOnly();
      return { deferred: true, local: true };
    }
    throw error;
  }
}

// Categories and subcategories mount together in the admin panel. Share one
// bootstrap request so both screens cannot race to insert the same slug.
export function ensureDefaultStyleTaxonomy() {
  if (!taxonomyBootstrapPromise) {
    taxonomyBootstrapPromise = bootstrapDefaultStyleTaxonomy()
      .finally(() => { taxonomyBootstrapPromise = null; });
  }
  return taxonomyBootstrapPromise;
}


import { compressMedia } from '@/lib/compressMedia';

const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const SUPPORTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

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

  const isHdr = /\.(hdr|hdri|exr)$/i.test(rawFile.name || '') || ['image/vnd.radiance','image/x-hdr','image/exr','image/x-exr'].includes(rawFile.type);
  let file;
  try {
    const isVideo = rawFile.type?.startsWith('video/');
    file = isHdr ? rawFile : await compressMedia(rawFile, {
      maxBytes: MAX_UPLOAD_BYTES,
      forceVideoTranscode: isVideo && !SUPPORTED_VIDEO_TYPES.has(rawFile.type),
    });
  } catch (compressErr) {
    console.warn('[uploadFile] Compression échouée, upload du fichier original:', compressErr);
    file = rawFile;
  }
  if (file.type?.startsWith('video/') && (!SUPPORTED_VIDEO_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES)) {
    throw new Error('Vidéo trop volumineuse ou format non pris en charge. Utilisez une vidéo MP4 ou WebM de moins de 18 Mo.');
  }
  const safeName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const filePath = `${Date.now()}_${safeName}`;
  const extension = file.name?.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  // Browsers commonly report HDR/HDRI/EXR as application/octet-stream (or an
  // empty MIME). Normalize it before sending the local admin request so the
  // server can validate it from both the extension and the media type.
  const contentType = isHdr
    ? (extension === 'exr' ? 'image/exr' : 'image/vnd.radiance')
    : (file.type || 'application/octet-stream');

  if (localAdminEnabled && bucket === 'uploads') {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Lecture du média impossible.'));
      reader.readAsDataURL(file);
    });
    return apiClient.post('/admin/upload', { name: safeName, contentType, base64 });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType, upsert: true });

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
