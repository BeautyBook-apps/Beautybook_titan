// ─── Proxy Grok (xAI) pour le chatbot ─────────────────────────────────────────
// Le navigateur n'appelle JAMAIS api.x.ai directement : la clé XAI_API_KEY reste
// côté serveur (variable d'environnement Vercel). Le front appelle /api/xai-chat.
const ALLOWED_MODELS = new Set([
  'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast-reasoning',
  'grok-4',
]);
const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';

// Garde-fou anti-abus minimal (mémoire du process serverless)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 30;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-12)
    .map((m) => {
      const role = m && (m.role === 'assistant' || m.role === 'system') ? m.role : 'user';
      let content = '';
      if (typeof m?.content === 'string') content = m.content;
      else if (Array.isArray(m?.content)) {
        content = m.content
          .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
          .map((p) => p.text)
          .join('\n');
      }
      return { role, content: content.slice(0, 4000) };
    })
    .filter((m) => m.content.trim().length > 0);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Service IA non configuré. Ajoutez la variable XAI_API_KEY dans Vercel puis redéployez.",
      code: 'XAI_KEY_MISSING',
    });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Trop de requêtes, réessayez dans un instant.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body && typeof body === 'object' ? body : {};

  const messages = cleanMessages(body.messages);
  if (messages.length === 0) return res.status(400).json({ error: 'Aucun message à traiter.' });

  const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const maxTokens = Math.min(Math.max(parseInt(body.max_tokens, 10) || 600, 50), 1000);

  const payload = { model, max_tokens: maxTokens, temperature: 0.7, messages };
  if (typeof body.system === 'string' && body.system.trim()) {
    payload.messages = [{ role: 'system', content: body.system.slice(0, 8000) }, ...messages];
  }

  try {
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || `Erreur xAI (${upstream.status})`;
      return res.status(upstream.status === 401 ? 503 : 502).json({ error: msg, code: 'XAI_UPSTREAM_ERROR' });
    }
    const content = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content, model: data?.model || model });
  } catch (e) {
    return res.status(502).json({ error: 'Impossible de joindre le service IA.', code: 'XAI_UNREACHABLE' });
  }
}
