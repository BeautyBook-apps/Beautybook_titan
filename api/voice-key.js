// ─── Clé API vocale du salon — gestion côté serveur ──────────────────────────
// La clé brute n'est JAMAIS lue ni écrite depuis le navigateur : tout passe
// par cette route, qui vérifie le JWT Supabase du professionnel et utilise
// le rôle service pour accéder à salon_ai_settings.voice_api_key.
// Actions (POST JSON) :
//   { pro_email, access_token, action: 'status' }            -> { configured }
//   { pro_email, access_token, action: 'save', voice_api_key } -> { ok: true }
//   { pro_email, access_token, action: 'remove' }             -> { ok: true }

async function getUserEmail(url, accessToken) {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return '';
    const user = await res.json().catch(() => null);
    return String((user && user.email) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function rest(path, serviceKey, opts = {}) {
  const url = process.env.SUPABASE_URL || '';
  return fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(503).json({ error: 'Service non configuré.', code: 'BACKEND_NOT_CONFIGURED' });
  }
  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch { body = {}; }
  const proEmail = String(body.pro_email || '').trim().toLowerCase();
  const accessToken = String(body.access_token || '').trim();
  const action = String(body.action || 'status');
  if (!proEmail || !accessToken) {
    return res.status(401).json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
  }
  // Le JWT doit appartenir au professionnel dont on gère la clé.
  const authedEmail = await getUserEmail(url, accessToken);
  if (!authedEmail || authedEmail !== proEmail) {
    return res.status(403).json({ error: 'Accès refusé.', code: 'FORBIDDEN' });
  }

  try {
    if (action === 'status') {
      const r = await rest(
        `salon_ai_settings?pro_email=eq.${encodeURIComponent(proEmail)}&select=voice_api_key`,
        serviceKey
      );
      const rows = await r.json().catch(() => []);
      const key = Array.isArray(rows) && rows[0] ? String(rows[0].voice_api_key || '').trim() : '';
      return res.status(200).json({ configured: !!key });
    }
    if (action === 'save') {
      const key = String(body.voice_api_key || '').trim();
      if (!key) return res.status(400).json({ error: 'Clé manquante.', code: 'KEY_REQUIRED' });
      const r = await rest('salon_ai_settings', serviceKey, {
        method: 'POST',
        body: JSON.stringify({ pro_email: proEmail, voice_api_key: key }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return res.status(502).json({ error: "Échec de l'enregistrement.", code: 'SAVE_FAILED', detail: t.slice(0, 200) });
      }
      return res.status(200).json({ ok: true, configured: true });
    }
    if (action === 'remove') {
      const r = await rest(
        `salon_ai_settings?pro_email=eq.${encodeURIComponent(proEmail)}`,
        serviceKey,
        { method: 'PATCH', body: JSON.stringify({ voice_api_key: '' }) }
      );
      if (!r.ok) {
        return res.status(502).json({ error: 'Échec de la suppression.', code: 'REMOVE_FAILED' });
      }
      return res.status(200).json({ ok: true, configured: false });
    }
    return res.status(400).json({ error: 'Action inconnue.', code: 'BAD_ACTION' });
  } catch (e) {
    return res.status(502).json({ error: 'Service indisponible.', code: 'UPSTREAM_ERROR' });
  }
}
