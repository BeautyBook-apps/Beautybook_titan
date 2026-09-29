// ─── Proxy du service IA pour le chatbot ──────────────────────────────────────
// Le navigateur n'appelle JAMAIS api.x.ai directement : la clé XAI_API_KEY reste
// côté serveur (variable d'environnement Vercel). Le front appelle /api/xai-chat.
//
// OUTILS IA (optionnels) : quand le front envoie
//   { enable_tools: true, tool_context: { pro_email } },
// le serveur donne au modèle deux outils LECTURE SEULE sur les VRAIES données
// du salon (clé service Supabase, jamais exposée) :
//   - list_services       : catalogue réel (noms, prix, durées) ;
//   - get_available_slots : créneaux libres réels pour une date et une durée,
//                           calculés comme dans l'application (durée + 15 min
//                           de nettoyage, pauses, congés, sièges libres).
// En cas d'échec d'accès, l'outil renvoie une erreur honnête — le modèle ne
// doit JAMAIS inventer de créneaux, prix ou durées.
import { getSalonServices, getAvailableSlots } from './_lib/salonData.js';
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
      error: "Service IA non configuré. Contactez le support BeautyBook.",
      code: 'VOICE_KEY_MISSING',
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

  let systemText = (typeof body.system === 'string' && body.system.trim())
    ? body.system.slice(0, 8000)
    : '';

  // ── Outils : définitions + exécution serveur ─────────────────────────────
  const toolsEnabled = body.enable_tools === true;
  const toolEmail = toolsEnabled && body.tool_context && typeof body.tool_context.pro_email === 'string'
    ? body.tool_context.pro_email.trim().toLowerCase()
    : '';

  const TOOL_DEFS = [
    {
      type: 'function',
      function: {
        name: 'list_services',
        description: "Liste le VRAI catalogue du salon : prestations et offres/packs avec prix et durées réels. À appeler avant de parler d'un prix ou d'une durée.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_available_slots',
        description: "Renvoie les VRAIS créneaux libres du salon pour une date donnée (format AAAA-MM-JJ) et une durée en minutes. Ne jamais inventer de créneaux : toujours appeler cet outil quand on parle de disponibilité.",
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: "Date au format AAAA-MM-JJ (ex : 2026-10-02)." },
            duration_min: { type: 'number', description: 'Durée de la prestation en minutes. Si inconnue, appelle d\u2019abord list_services.' },
            service_name: { type: 'string', description: "Nom de la prestation (optionnel) : la durée réelle du catalogue sera utilisée." },
          },
          required: ['date'],
          additionalProperties: false,
        },
      },
    },
  ];

  async function executeServerTool(name, args) {
    const a = (args && typeof args === 'object') ? args : {};
    try {
      if (name === 'list_services') {
        const r = await getSalonServices(toolEmail);
        if (!r.ok) return JSON.stringify({ status: 'error', reason: r.reason });
        return JSON.stringify({ status: 'success', services: r.services, packs: r.packs });
      }
      if (name === 'get_available_slots') {
        let duration = Number(a.duration_min) || 0;
        if ((!duration || duration <= 0) && a.service_name) {
          const cat = await getSalonServices(toolEmail);
          if (cat.ok) {
            const q = String(a.service_name).toLowerCase();
            const hit = (cat.services || []).find((s) => String(s.name).toLowerCase().includes(q));
            if (hit) duration = Number(hit.duration_min) || 60;
          }
        }
        const r = await getAvailableSlots(toolEmail, a.date, duration || 60);
        if (!r.ok) return JSON.stringify({ status: 'error', reason: r.reason });
        if (r.closed) return JSON.stringify({ status: 'success', closed: true, slots: [] });
        return JSON.stringify({ status: 'success', closed: false, slots: r.slots });
      }
      return JSON.stringify({ status: 'error', reason: 'OUTIL_INCONNU' });
    } catch (e) {
      return JSON.stringify({ status: 'error', reason: 'LECTURE_IMPOSSIBLE' });
    }
  }

  if (toolsEnabled && toolEmail) {
    const todayParis = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const [dd, mm, yyyy] = todayParis.split('/');
    systemText += `\n\n[OUTILS DONNÉES SALON — RÈGLE D'OR] Tu as accès aux VRAIES données du salon via tes outils.`
      + ` Aujourd'hui nous sommes le ${yyyy}-${mm}-${dd} (Europe/Paris).`
      + ` Quand on te parle de prix, durée ou disponibilité : appelle TOUJOURS list_services et/ou get_available_slots AVANT de répondre.`
      + ` N'invente JAMAIS un créneau, un prix ou une durée. Si un outil renvoie une erreur, dis honnêtement que tu ne peux pas accéder au planning pour le moment.`
      + ` Résous les dates relatives (« demain », « samedi », « vendredi prochain ») par rapport à la date du jour ci-dessus.`;
  }

  const baseMessages = systemText
    ? [{ role: 'system', content: systemText }, ...messages]
    : messages;

  async function callXAI(msgs, withTools) {
    const payload = { model, max_tokens: maxTokens, temperature: 0.7, messages: msgs };
    if (withTools) {
      payload.tools = TOOL_DEFS;
      payload.tool_choice = 'auto';
    }
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || `Erreur du service IA (${upstream.status})`;
      const err = new Error(msg);
      err.status = upstream.status;
      throw err;
    }
    return data;
  }

  try {
    // ── Parcours avec outils : boucle appel → exécution → réponse ──────────
    if (toolsEnabled && toolEmail) {
      const convo = [...baseMessages];
      let finalContent = '';
      let finalModel = model;
      for (let round = 0; round < 4; round++) {
        const data = await callXAI(convo, true);
        finalModel = data?.model || model;
        const msg = data?.choices?.[0]?.message || {};
        const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        if (toolCalls.length === 0) {
          finalContent = msg.content || '';
          break;
        }
        convo.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls });
        for (const tc of toolCalls.slice(0, 4)) {
          let args = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
          const result = await executeServerTool(tc.function?.name, args);
          convo.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        finalContent = msg.content || '';
      }
      return res.status(200).json({ content: finalContent, model: finalModel, tools_used: true });
    }

    // ── Parcours classique (sans outils) ────────────────────────────────────
    const data = await callXAI(baseMessages, false);
    const content = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content, model: data?.model || model });
  } catch (e) {
    const status = e && e.status === 401 ? 503 : 502;
    return res.status(status).json({
      error: (e && e.message) || 'Impossible de joindre le service IA.',
      code: 'XAI_UNREACHABLE',
    });
  }
}
