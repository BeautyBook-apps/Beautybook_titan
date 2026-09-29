// ─── Token éphémère pour l'agent vocal (realtime) ───────────────────────────
// Le navigateur ne peut pas envoyer le header Authorization sur un WebSocket :
// cette fonction minte un token éphémère côté serveur (clé jamais exposée)
// que le front utilise via le sous-protocole `xai-client-secret.<token>`.
// Durée de vie : 5 minutes. Le front appelle /api/xai-token puis ouvre
// wss://api.x.ai/v1/realtime directement.
//
// Clé utilisée : celle PROPRE AU SALON si le pro en a configuré une
// (page Réceptionniste IA → « Clé API vocale du salon », colonne
// salon_ai_settings.voice_api_key lue en rôle service), sinon la clé
// XAI_API_KEY de l'environnement (BeautyBook).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 10;
}

/** Vérifie le JWT Supabase et renvoie un diagnostic précis (jamais un simple « refusé »). */
async function checkAuth(url, accessToken) {
  const endpoint = `${String(url || '').replace(/\/$/, '')}/auth/v1/user`;
  let res;
  try {
    res = await fetch(endpoint, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, code: 'AUTH_URL_UNREACHABLE',
      message: "Le serveur n'arrive pas à joindre Supabase : vérifiez la variable SUPABASE_URL dans Vercel (elle doit valoir exactement l'URL de votre projet, https://…supabase.co)." };
  }
  const raw = await res.text().catch(() => '');
  if (res.status === 401 && /invalid api key/i.test(raw)) {
    return { ok: false, code: 'AUTH_BAD_API_KEY',
      message: "La clé API Supabase configurée sur le serveur est rejetée : recopiez SUPABASE_ANON_KEY depuis votre dashboard Supabase (Project Settings → API)." };
  }
  if (!res.ok) {
    return { ok: false, code: 'AUTH_TOKEN_REJECTED',
      message: "Votre session n'est pas reconnue par le serveur : déconnectez-vous puis reconnectez-vous sur le site. Si le problème persiste, vérifiez que SUPABASE_URL dans Vercel correspond exactement au projet utilisé par l'application." };
  }
  let user = null;
  try { user = JSON.parse(raw); } catch { user = null; }
  const email = String((user && user.email) || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, code: 'AUTH_NO_EMAIL',
      message: "Le serveur n'a pas pu lire votre email de session : déconnectez-vous puis reconnectez-vous." };
  }
  return { ok: true, email };
}

/** Clé API vocale propre au salon (rôle service, jamais exposée au client). */
async function getSalonVoiceKey(proEmail) {
  const email = String(proEmail || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !url || !serviceKey) return '';
  try {
    const res = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/salon_ai_settings?pro_email=eq.${encodeURIComponent(email)}&select=voice_api_key`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    const rows = await res.json().catch(() => []);
    const key = Array.isArray(rows) && rows[0] ? String(rows[0].voice_api_key || '').trim() : '';
    return key;
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (!['POST'].includes(req.method)) return res.status(405).json({ error: 'Méthode non autorisée.' });

  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch { body = {}; }

  const proEmail = String(body.pro_email || '').trim().toLowerCase();
  const accessToken = String(body.access_token || '').trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
  }
  // Le token éphémère est minté uniquement pour le salon du professionnel connecté.
  const auth = await checkAuth(process.env.SUPABASE_URL, accessToken);
  if (!auth.ok) {
    return res.status(502).json({ error: auth.message, code: auth.code });
  }
  const authedEmail = auth.email;
  if (proEmail && authedEmail !== proEmail) {
    return res.status(403).json({ error: 'Accès refusé.', code: 'FORBIDDEN' });
  }
  const effectiveEmail = proEmail || authedEmail;

  // 1) Clé propre au salon si configurée, 2) sinon clé BeautyBook (env).
  const salonKey = await getSalonVoiceKey(effectiveEmail);
  const apiKey = salonKey || process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Service vocal non configuré : ajoutez votre clé API vocale dans la page Réceptionniste IA.",
      code: 'VOICE_KEY_MISSING',
    });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Trop de requêtes, réessayez dans un instant.' });

  try {
    const upstream = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !data?.value) {
      const msg = data?.error?.message || `Erreur du service vocal (${upstream.status})`;
      return res.status(upstream.status === 401 ? 503 : 502).json({ error: msg, code: 'VOICE_UPSTREAM_ERROR' });
    }
    return res.status(200).json({ token: data.value, expires_at: data.expires_at });
  } catch (e) {
    return res.status(502).json({ error: 'Impossible de joindre le service vocal.', code: 'VOICE_UNREACHABLE' });
  }
}
