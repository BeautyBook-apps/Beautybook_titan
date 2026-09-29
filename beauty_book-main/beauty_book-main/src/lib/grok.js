// ─── Client Grok (xAI) — chatbot texte ────────────────────────────────────────
// Le front n'appelle JAMAIS api.x.ai directement : tout passe par /api/xai-chat
// (fonction Vercel qui garde XAI_API_KEY côté serveur).
import { recordChatUsage } from './apiUsage';
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
 * @param {{system?:string, model?:string, max_tokens?:number, feature?:string, enableTools?:boolean, salonEmail?:string}} opts
 *   feature : 'maria' | 'global' | 'vocal' | 'social' | 'other' — pour le suivi
 *   d'utilisation (onglet Utilisation de la Réceptionniste IA).
 *   enableTools + salonEmail : donne au modèle un accès LECTURE SEULE aux
 *   vraies données du salon (catalogue, créneaux libres) via /api/xai-chat.
 * @returns {Promise<string>}
 */
export async function grokChat(messages, opts = {}) {
  const body = {
    messages,
    system: opts.system,
    model: opts.model,
    max_tokens: opts.max_tokens,
  };
  if (opts.enableTools && opts.salonEmail) {
    body.enable_tools = true;
    body.tool_context = { pro_email: opts.salonEmail };
  }
  const res = await fetch('/api/xai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
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
  // ── Suivi d'utilisation (tokens → coût estimé), jamais bloquant ──
  try {
    if (data && data.usage) {
      recordChatUsage({
        model: (data && data.model) || opts.model || 'grok-4-1-fast-non-reasoning',
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        feature: opts.feature || 'other',
      });
    }
  } catch { /* suivi optionnel */ }
  return content;
}

/** Récupère un token éphémère pour la session voix temps réel.
 * @param {string} proEmail - email du salon : le serveur vérifie le JWT du
 *   professionnel connecté, puis utilise la clé API vocale propre au salon
 *   si configurée, sinon la clé BeautyBook. */
export async function mintVoiceToken(proEmail) {
  let accessToken = '';
  try {
    const { supabase } = await import('@/api/supabaseClient');
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  } catch { /* session indisponible */ }
  const res = await fetch('/api/xai-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pro_email: proEmail || '', access_token: accessToken }),
    signal: AbortSignal.timeout(20000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* pas de JSON */ }
  if (!res.ok || !data?.token) {
    const err = new Error((data && data.error) || `Erreur service vocal (${res.status})`);
    err.code = data && data.code;
    throw err;
  }
  return data; // { token, expires_at }
}
