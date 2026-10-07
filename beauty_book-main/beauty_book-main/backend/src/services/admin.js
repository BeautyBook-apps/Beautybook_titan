import db from '../config/pg.js';
import { assert } from '../lib/errors.js';

export const RESOURCES = {
  profiles: { permission: 'users', fields: ['full_name','avatar_url','cover_url'] },
  ProfilPro: { permission: 'professionals', fields: ['salon_name','bio','status','verified','city','address','phone','specialites','ouverture','horaires','conges','seats_count','timezone','avatar_url','cover_url'] },
  DemandeProV2: { permission: 'professionals', fields: ['statut','status','admin_notes'] },
  Service: { permission: 'services', fields: ['name','title','description','price','duration','duration_min','category','subcategory','images','status','addons','tags','pro_email','promo_price','promo_ends_at'] },
  Produit: { permission: 'products', fields: ['name','description','price','old_price','images','category','brand','stock','status','tags','pro_email','min_qty','delivery_time','free_shipping','return_policy'] },
  Style: { permission: 'content', fields: ['title','description','images','image_url','video_url','category','subcategory','status','featured','tags','produits_utilises','outils_utilises','author_email','author_name','author_avatar','pro_email','type_cheveux','type_peau','type_prestation','temps_moyen','niveau_difficulte','mots_cles'] },
  Reel: { permission: 'content', fields: ['title','description','video_url','thumbnail_url','images','category','status','tags','author_email','author_name','author_avatar'] },
  Publication: { permission: 'content', fields: ['content','images','video_url','type','status','author_email','author_name'] },
  StyleCategory: { permission: 'categories', fields: ['name','slug','description','icon','color','is_active'] },
  StyleSubCategory: { permission: 'categories', fields: ['name','slug','description','category_id','is_active'] },
  Annonce: { permission: 'content', fields: ['title','description','type','status','image_url','video_url','cta_label','cta_url','target_url','pro_email','pro_name','sponsor_name','pages','budget','start_date','end_date'] },
  AppConfig: { permission: 'configuration', fields: ['key','value','description'] },
  Reservation: { permission: 'bookings', fields: [], readOnly: true },
  Commande: { permission: 'orders', fields: [], readOnly: true },
  Avis: { permission: 'reports', fields: ['status'] },
  CommentaireStyle: { permission: 'reports', fields: ['content'] },
  reel_comment_report: { permission: 'reports', fields: [] },
  Notification: { permission: 'notifications', fields: ['user_email','title','message','body','type','action_url','is_read','read'] },
  LiveSession: { permission: 'content', fields: ['title','description','status','thumbnail_url'] },
  ImmobilierListing: { permission: 'content', fields: ['title','description','price','price_fonds_commerce','price_per_m2','tax_mode','salon_type','rooms','floor','location','postal_code','equip','extra','video_url','images','address','city','type','status','area','surface','contact_email','contact_phone','latitude','longitude'] },
  MessageChat: { permission: 'messages', fields: [], readOnly: true },
  PointsFidelite: { permission: 'loyalty', fields: [], readOnly: true },
  PointsFidelitePro: { permission: 'loyalty', fields: [], readOnly: true },
  bb_audit_log: { permission: 'audit', fields: [], readOnly: true },
  bb_seller_accounts: { permission: 'sellers', fields: ['shop_name','status','low_stock_threshold'] },
  bb_handoffs: { permission: 'support', fields: ['status'] },
  bb_outbox: { permission: 'operations', fields: [], readOnly: true },
  bb_deletion_jobs: { permission: 'users', fields: [], readOnly: true },
};
const hidden = ['password','access_token','refresh_token','credentials','stripe_customer_id','mux_stream_key'];
const containsSecretField = value => {
  if (Array.isArray(value)) return value.some(containsSecretField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    /secret|token|password|credential|stripe|api[._-]?key/i.test(key) || containsSecretField(child)
  );
};
const identifier = value => { assert(/^[A-Za-z_][A-Za-z_0-9]*$/.test(value), 400, 'INVALID_FIELD', 'Champ invalide.'); return `"${value}"`; };

export function resourceAccess(table, operation) {
  const resource = RESOURCES[table];
  assert(resource, 404, 'RESOURCE_UNKNOWN', 'Ressource administrative inconnue.');
  assert(['list','filter','get','create','update','delete'].includes(operation), 400, 'ACTION_UNKNOWN', 'Action administrative inconnue.');
  const writing = ['create','update','delete'].includes(operation);
  assert(!writing || !resource.readOnly, 403, 'BUSINESS_API_REQUIRED', 'Cette opération doit passer par son service métier dédié.');
  return { ...resource, writing, permission: `${resource.permission}:${writing ? 'write' : 'read'}` };
}

export async function adminEntity(user, body, requestId, database = db) {
  const { table, operation = 'list', id, data = {}, filters = {}, orderBy = '-created_at', limit = 100, offset = 0 } = body;
  const resource = resourceAccess(table, operation);
  const tableSql = `public.${identifier(table)}`;
  if (!resource.writing) {
    const params = [hidden];
    const predicates = [];
    const requested = operation === 'get' ? { [table==='bb_seller_accounts'?'user_id':'id']:id } : filters;
    assert(requested && typeof requested === 'object' && !Array.isArray(requested) && Object.keys(requested).length <= 12, 400, 'INVALID_FILTERS', 'Filtres invalides.');
    for (const [key, value] of Object.entries(requested)) {
      if(value && typeof value==='object' && !Array.isArray(value)){
        assert(Object.keys(value).length===1 && Array.isArray(value.$in) && value.$in.length>0 && value.$in.length<=100 && value.$in.every(item=>typeof item==='string'),400,'INVALID_FILTER','Filtre de liste invalide.');
        identifier(key);assert(!hidden.includes(key),400,'INVALID_FILTER','Filtre invalide.');
        params.push(key,value.$in);
        predicates.push(`((to_jsonb(t)->$${params.length-1}) ?| $${params.length}::text[] OR (to_jsonb(t)->>$${params.length-1}) = ANY($${params.length}::text[]))`);
        continue;
      }
      assert(!hidden.includes(key) && (value === null || ['string','number','boolean'].includes(typeof value)), 400, 'INVALID_FILTER', 'Filtre invalide.');
      params.push(value);
      predicates.push(`${identifier(key)} IS NOT DISTINCT FROM $${params.length}`);
    }
    const column = String(orderBy).replace(/^-/, '').replace('created_date','created_at');
    params.push(Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0));
    const { rows } = await database.query(`SELECT to_jsonb(t) - $1::text[] AS row FROM ${tableSql} t ${predicates.length ? 'WHERE ' + predicates.join(' AND ') : ''} ORDER BY ${identifier(column)} ${String(orderBy).startsWith('-') ? 'DESC' : 'ASC'} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return operation === 'get' ? rows[0]?.row || null : rows.map(row => row.row);
  }
  assert(operation !== 'delete' || !['profiles','ProfilPro','Produit','Service','bb_seller_accounts'].includes(table), 409, 'ARCHIVE_REQUIRED', 'Désactivez cet élément ou utilisez la procédure de suppression de compte.');
  const keys = Object.keys(data);
  assert(keys.every(key => resource.fields.includes(key)), 400, 'FIELD_NOT_WRITABLE', 'Un champ demandé n’est pas modifiable par cette opération.');
  if (table === 'AppConfig') {
    assert(!containsSecretField(data), 400, 'SECRET_CONFIGURATION_FORBIDDEN', 'Les secrets se configurent exclusivement sur le serveur.');
  }
  if ('price' in data) assert(Number.isFinite(Number(data.price)) && Number(data.price) >= 0, 400, 'INVALID_PRICE', 'Prix invalide.');
  return database.transaction(async client => {
    let rows;
    if (operation === 'create') {
      assert(keys.length, 400, 'EMPTY_CHANGE', 'Aucune donnée fournie.');
      ({ rows } = await client.query(`INSERT INTO ${tableSql} (${keys.map(identifier).join(',')}) SELECT ${keys.map(identifier).join(',')} FROM jsonb_populate_record(NULL::${tableSql},$1::jsonb) RETURNING *`, [JSON.stringify(data)]));
    } else {
      assert(typeof id === 'string' && id.length <= 100, 400, 'ID_REQUIRED', 'Identifiant requis.');
      if (operation === 'delete') ({ rows } = await client.query(`DELETE FROM ${tableSql} WHERE id::text = $1 RETURNING id`, [id]));
      else {
        assert(keys.length, 400, 'EMPTY_CHANGE', 'Aucune modification fournie.');
        const primary = table === 'bb_seller_accounts' ? 'user_id' : 'id';
        ({ rows } = await client.query(`UPDATE ${tableSql} SET (${keys.map(identifier).join(',')}) = (SELECT ${keys.map(identifier).join(',')} FROM jsonb_populate_record(NULL::${tableSql},$1::jsonb)) WHERE ${primary}::text = $2 RETURNING *`, [JSON.stringify(data),id]));
      }
    }
    assert(rows[0], 404, 'RESOURCE_NOT_FOUND', 'Élément introuvable ou supprimé.');
    await client.query('INSERT INTO public.bb_audit_log (actor_id,action,resource,resource_id,changes,request_id) VALUES ($1,$2,$3,$4,$5::jsonb,$6)', [user.id,operation,table,String(rows[0].id || id),JSON.stringify({ fields: keys }),requestId]);
    const result = { ...rows[0] }; hidden.forEach(key => delete result[key]);
    return result;
  });
}
