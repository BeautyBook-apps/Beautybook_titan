// ─── Client Grok (xAI) — chatbot texte ────────────────────────────────────────
// Le front n'appelle JAMAIS api.x.ai directement : tout passe par /api/xai-chat
// (fonction Vercel qui garde XAI_API_KEY côté serveur).
const LS_AGENT_ID = 'bb_grok_agent_id';
export const DEFAULT_AGENT_ID = 'agent_xGMVEL6cEMKtWzG8';

export function getGrokAgentId() {
  try {
    return localStorage.getItem(LS_AGENT_ID) || DEFAULT_AGENT_ID;
  } catch {
    return DEFAULT_AGENT_ID;
  }
}
export function setGrokAgentId(id) {
  try {
    if (id) localStorage.setItem(LS_AGENT_ID, id);
    else localStorage.removeItem(LS_AGENT_ID);
  } catch { /* stockage indisponible */ }
}

/**
 * Envoie une conversation à Grok et renvoie le texte de réponse.
 * @param {Array<{role:string, content:string}>} messages
 * @param {{system?:string, model?:string, max_tokens?:number}} opts
 * @returns {Promise<string>}
 */
export async function grokChat(messages, opts = {}) {
  const res = await fetch('/api/xai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      system: opts.system,
      model: opts.model,
      max_tokens: opts.max_tokens,
    }),
    signal: AbortSignal.timeout(60000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* pas de JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erreur IA (${res.status})`);
    err.code = data && data.code;
    err.status = res.status;
    throw err;
  }
  const content = (data && data.content) || '';
  if (!content.trim()) throw new Error('Réponse IA vide.');
  return content;
}

/** Récupère un token éphémère pour la session voix temps réel. */
export async function mintVoiceToken() {
  const res = await fetch('/api/xai-token', { signal: AbortSignal.timeout(20000) });
  let data = null;
  try { data = await res.json(); } catch { /* pas de JSON */ }
  if (!res.ok || !data?.token) {
    const err = new Error((data && data.error) || `Erreur service vocal (${res.status})`);
    err.code = data && data.code;
    throw err;
  }
  return data; // { token, expires_at }
}
