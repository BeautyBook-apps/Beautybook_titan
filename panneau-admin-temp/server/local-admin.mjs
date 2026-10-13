import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { resourceAccess } from '../../beauty_book-main/beauty_book-main/backend/src/services/admin.js';

const hidden = new Set(['password', 'access_token', 'refresh_token', 'credentials', 'stripe_customer_id', 'mux_stream_key']);
// Les champs de l'annonce immobilière sont vérifiés contre le schéma distant.
// Ne supprimons jamais silencieusement un champ renseigné par le formulaire :
// une migration manquante doit rester visible et explicite.
const IMMOBILIER_OPTIONAL_COLUMNS = new Set();
const cleanRow = row => row && Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)));
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const field = key => {
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || hidden.has(key)) fail(400, 'Champ invalide.');
  return key;
};
const checked = result => {
  if (result.error) fail(result.status >= 400 ? result.status : 502, result.error.message);
  return result.data;
};
const containsSecretField = value => {
  if (Array.isArray(value)) return value.some(containsSecretField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    /secret|token|password|credential|stripe|api[._-]?key/i.test(key) || containsSecretField(child)
  );
};

export function acceptsLocalRequest(req, token, origin) {
  const remote = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false;
  if (req.headers.host !== new URL(origin).host) return false;
  if (req.headers.origin && req.headers.origin !== origin) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const received = Buffer.from(String(req.headers['x-beautybook-local-admin'] || ''));
  const expected = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function createLocalDataApi(client, { columns } = {}) {
  return {
      async entities(body) {
        const { table, operation = 'list', id, data = {}, filters = {}, orderBy = '-created_at', limit = 500 } = body;
        const resource = resourceAccess(table, operation);
        const primary = table === 'bb_seller_accounts' ? 'user_id' : 'id';
        if (!resource.writing && columns) {
          const available = await columns(table);
          if (available.size === 0) return operation === 'get' ? null : [];
        }
        let query = client.from(table);
      if (resource.writing) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Données invalides.');
        if (!Object.keys(data).every(key => resource.fields.includes(key))) fail(400, 'Un champ demandé ne peut pas être modifié.');
        if (table === 'AppConfig' && containsSecretField(data)) fail(400, 'Les secrets se configurent sur le serveur.');
        if ('price' in data && (!Number.isFinite(Number(data.price)) || Number(data.price) < 0)) fail(400, 'Prix invalide.');
        const payload = { ...data };
        if (columns && operation !== 'delete') {
          let available = await columns(table);
          for (const [key, value] of Object.entries(payload)) {
            if (!available.has(key)) {
              // Le schéma OpenAPI peut avoir été mis en cache avant une
              // migration récente. On le recharge une fois avant de renvoyer
              // une erreur 409 définitive.
              available = await columns(table, true);
              if (available.has(key)) continue;
            } else continue;
            if (value === '' || value === null || value === undefined) delete payload[key];
            else if (table === 'ImmobilierListing' && IMMOBILIER_OPTIONAL_COLUMNS.has(key)) delete payload[key];
            else fail(409, `Le champ ${key} n’existe pas encore dans ${table}. Appliquez la migration de schéma avant de renseigner ce champ.`);
          }
        }
        if (operation !== 'create' && (typeof id !== 'string' || !id || id.length > 100)) fail(400, 'Identifiant requis.');
        if (operation === 'create') query = query.insert(payload);
        else if (operation === 'update') query = query.update(payload).eq(primary, id);
        else {
          if (['profiles', 'ProfilPro', 'Produit', 'Service', 'bb_seller_accounts'].includes(table)) fail(409, 'Désactivez cet élément pour conserver son historique.');
          query = query.delete().eq(primary, id);
        }
        const result = checked(await query.select().maybeSingle());
        if (!result) fail(404, 'Élément introuvable ou supprimé.');
        return cleanRow(result);
      }
      query = query.select('*');
      if (operation === 'get') return cleanRow(checked(await query.eq(primary, id).maybeSingle()));
      if (!filters || typeof filters !== 'object' || Array.isArray(filters) || Object.keys(filters).length > 12) fail(400, 'Filtres invalides.');
      for (const [key, value] of Object.entries(filters)) {
        field(key);
        if (value === null) query = query.is(key, null);
        else if (Array.isArray(value)) query = query.in(key, value);
        else if (value && typeof value === 'object') {
          if (Object.keys(value).length !== 1 || !Array.isArray(value.$in)) fail(400, 'Filtre invalide.');
          query = query.in(key, value.$in);
        } else query = query.eq(key, value);
      }
      if (orderBy) query = query.order(field(String(orderBy).replace(/^-/, '').replace('created_date', 'created_at').replace('updated_date', 'updated_at')), { ascending: !String(orderBy).startsWith('-') });
      return (checked(await query.limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))) || []).map(cleanRow);
    },
    async stats() {
      const definitions = {
        users: ['profiles'], styles: ['Style'], services: ['Service', { status: 'actif' }],
        reservations: ['Reservation'], reservations_pending: ['Reservation', { status: 'en_attente' }],
        commandes: ['Commande'], reels: ['Reel', { status: 'publie' }], lives_actifs: ['LiveSession', { status: 'live' }],
      };
      return Object.fromEntries(await Promise.all(Object.entries(definitions).map(async ([key, [table, filters = {}]]) => {
        let query = client.from(table).select('id', { count: 'exact', head: true });
        for (const [name, value] of Object.entries(filters)) query = query.eq(name, value);
        const result = await query;
        checked(result);
        if (result.count === null) fail(502, `Impossible de compter les éléments de ${table}.`);
        return [key, result.count];
      })));
    },
    async styleEngagement({ styleIds = [] }) {
      const ids = [...new Set((Array.isArray(styleIds) ? styleIds : []).map(id => String(id).trim()).filter(Boolean))].slice(0, 500);
      if (!ids.length) return { stats: {} };
      let styleResult = await client.from('Style').select('id,views,shares').in('id', ids);
      if (styleResult.error && /shares|views|column|schema cache|does not exist/i.test(styleResult.error.message || '')) {
        styleResult = await client.from('Style').select('id,views').in('id', ids);
      }
      if (styleResult.error && /views|column|schema cache|does not exist/i.test(styleResult.error.message || '')) {
        styleResult = await client.from('Style').select('id').in('id', ids);
      }
      const styles = styleResult.error ? [] : (styleResult.data || []);
      const likesResult = await client.from('user_like').select('target_id').eq('target_type', 'style').in('target_id', ids);
      const likes = likesResult.error ? [] : (likesResult.data || []);
      const stats = Object.fromEntries(ids.map(id => [id, { likes: 0, views: 0, shares: 0 }]));
      styles.forEach(style => {
        const id = String(style.id);
        if (stats[id]) { stats[id].views = Number(style.views || 0); stats[id].shares = Number(style.shares || 0); }
      });
      likes.forEach(row => { const id = String(row.target_id); if (stats[id]) stats[id].likes += 1; });
      return { stats };
    },
    async upload({ name, contentType, base64 }) {
      const fileName = String(name || 'media');
      const isHdr = /\.(hdr|hdri|exr)$/i.test(fileName);
      const supportedMediaTypes = new Set([
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
      ]);
      const supportedHdrTypes = new Set([
        'image/vnd.radiance', 'image/x-hdr', 'image/exr', 'image/x-exr',
        'application/octet-stream',
      ]);
      if (!supportedMediaTypes.has(contentType) && !(isHdr && supportedHdrTypes.has(contentType))) {
        fail(400, 'Format de média non pris en charge.');
      }
      if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail(400, 'Média invalide.');
      const bytes = Buffer.from(base64, 'base64');
      const maxBytes = isHdr ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
      if (!bytes.length || bytes.length > maxBytes) fail(413, isHdr ? 'Le fichier HDR/HDRI/EXR doit faire au maximum 100 Mo.' : 'Le média doit faire au maximum 20 Mo.');
      const suffix = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
      const filePath = `admin/${randomUUID()}_${suffix}`;
      checked(await client.storage.from('uploads').upload(filePath, bytes, { contentType, upsert: false }));
      return { file_url: client.storage.from('uploads').getPublicUrl(filePath).data.publicUrl };
    },
  };
}

export function localAdminPlugin({ url, serviceKey, origin = 'http://localhost:5174', auditPath }) {
  const token = randomBytes(32).toString('hex');
  let api;
  let schema;
  let schemaTime = 0;
  const columns = async (table, force = false) => {
    if (force || !schema || Date.now() - schemaTime > 60000) {
      const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/', { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!response.ok) fail(502, 'Le schéma Supabase ne peut pas être chargé.');
      schema = (await response.json()).definitions;
      schemaTime = Date.now();
    }
    return new Set(Object.keys(schema?.[table]?.properties || {}));
  };
  return {
    name: 'beautybook-local-admin',
    apply: 'serve',
    config: () => ({ define: { __LOCAL_ADMIN_TOKEN__: JSON.stringify(token) } }),
    configureServer(server) {
      if (server.config.mode === 'production' || !['localhost', '127.0.0.1', '::1'].includes(server.config.server.host)) throw new Error('Le panneau sans connexion doit rester sur localhost, en développement.');
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (!pathname?.startsWith('/__local-admin/')) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          if (!acceptsLocalRequest(req, token, origin)) fail(403, 'Accès réservé au panneau local.');
          if (!url || !serviceKey) fail(503, 'Configurez les clés Supabase dans backend/.env.');
          api ||= createLocalDataApi(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), { columns });
          if (pathname === '/__local-admin/stats' && req.method === 'GET') {
            res.end(JSON.stringify(await api.stats())); return;
          }
          if (!['/__local-admin/entities', '/__local-admin/upload', '/__local-admin/style-engagement'].includes(pathname) || req.method !== 'POST') fail(404, 'Opération locale indisponible.');
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            // The upload body contains base64, so it is larger than the
            // original file. Allow a 100 MB HDR/EXR plus base64 overhead.
            if (length > (pathname.endsWith('/upload') ? 140 : 2) * 1024 * 1024) fail(413, 'Données trop volumineuses.');
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          let body; try { body = JSON.parse(raw); } catch { fail(400, 'JSON invalide.'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Données invalides.');
          if (pathname === '/__local-admin/upload') { res.end(JSON.stringify(await api.upload(body))); return; }
          if (pathname === '/__local-admin/style-engagement') { res.end(JSON.stringify(await api.styleEngagement(body))); return; }
          const writing = ['create', 'update', 'delete'].includes(body.operation);
          if (writing && auditPath) await appendFile(auditPath, JSON.stringify({ time: new Date().toISOString(), operation: body.operation, table: body.table, id: body.id, fields: Object.keys(body.data || {}) }) + '\n');
          res.end(JSON.stringify({ result: await api.entities(body) }));
        } catch (error) {
          res.statusCode = error.status || 500;
          res.end(JSON.stringify({ error: error.status ? error.message : 'Le service local ne peut pas terminer cette opération.' }));
        }
      });
    },
  };
}
