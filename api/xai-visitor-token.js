// ─── Token éphémère pour l'« appel interne » (visiteur → agent vocal IA) ────
// Quand un salon active « Appel interne » (et que son agent vocal est actif),
// un visiteur qui appuie sur « APPELER » dans l'application parle à l'agent
// vocal IA du salon au lieu de joindre le téléphone du professionnel.
//
// Cette route minte un token éphémère xAI (5 min) SANS exiger que l'appelant
// soit le professionnel : la seule condition, vérifiée côté serveur en rôle
// service, est que le salon ait activé vocal_enabled ET appel_interne.
// Limite de débit par IP pour éviter les abus.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 5; // 5 appels / 10 min / IP
}

/** Vérifie que le salon autorise l'appel interne (vocal actif + appel_interne). */
async function salonAllowsInternalCall(url, serviceKey, proEmail) {
  const base = String(url || '').replace(/\/$/, '');
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const res = await fetch(
      `${base}/rest/v1/salon_ai_settings?pro_email=eq.${encodeURIComponent(proEmail)}&select=vocal_enabled,appel_interne,voice_api_key`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { ok: false, reason: 'NOT_FOUND' };
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) return { ok: false, reason: 'NOT_FOUND' };
    if (row.vocal_enabled === false) return { ok: false, reason: 'VOCAL_DISABLED' };
    if (row.appel_interne !== true) return { ok: false, reason: 'INTERNAL_CALL_DISABLED' };
    return { ok: true, voiceApiKey: String(row.voice_api_key || '').trim() };
  } catch {
    return { ok: false, reason: 'UNREACHABLE' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch { body = {}; }
  const proEmail = String(body.pro_email || '').trim().toLowerCase();
  if (!proEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(proEmail)) {
    return res.status(400).json({ error: 'Salon invalide.', code: 'BAD_SALON' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Trop de requêtes, réessayez dans quelques minutes.', code: 'RATE_LIMITED' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(503).json({ error: 'Service vocal non configuré.', code: 'SERVER_MISCONFIGURED' });
  }

  const check = await salonAllowsInternalCall(url, serviceKey, proEmail);
  if (!check.ok) {
    const messages = {
      NOT_FOUND: "Ce salon n'a pas configuré l'appel par l'assistant vocal.",
      VOCAL_DISABLED: "L'assistant vocal de ce salon est désactivé.",
      INTERNAL_CALL_DISABLED: "Ce salon n'a pas activé l'appel interne.",
      UNREACHABLE: 'Service momentanément indisponible.',
    };
    return res.status(403).json({ error: messages[check.reason] || messages.UNREACHABLE, code: check.reason });
  }

  const apiKey = check.voiceApiKey || process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Service vocal non configuré.', code: 'VOICE_KEY_MISSING' });
  }

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
  } catch {
    return res.status(502).json({ error: 'Impossible de joindre le service vocal.', code: 'VOICE_UNREACHABLE' });
  }
}
