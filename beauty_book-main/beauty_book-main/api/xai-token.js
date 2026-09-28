// ─── Token éphémère pour l'agent vocal Grok (realtime) ───────────────────────
// Le navigateur ne peut pas envoyer le header Authorization sur un WebSocket :
// cette fonction minte un token éphémère côté serveur (clé XAI_API_KEY jamais
// exposée) que le front utilise via le sous-protocole `xai-client-secret.<token>`.
// Durée de vie : 5 minutes. Le front appelle /api/xai-token puis ouvre
// wss://api.x.ai/v1/realtime directement.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 10;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Méthode non autorisée.' });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Service vocal non configuré. Ajoutez la variable XAI_API_KEY dans Vercel puis redéployez.",
      code: 'XAI_KEY_MISSING',
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
      const msg = data?.error?.message || `Erreur xAI (${upstream.status})`;
      return res.status(upstream.status === 401 ? 503 : 502).json({ error: msg, code: 'XAI_UPSTREAM_ERROR' });
    }
    return res.status(200).json({ token: data.value, expires_at: data.expires_at });
  } catch (e) {
    return res.status(502).json({ error: 'Impossible de joindre le service vocal.', code: 'XAI_UNREACHABLE' });
  }
}
