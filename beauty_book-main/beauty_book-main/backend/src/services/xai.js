import { assert, HttpError } from '../lib/errors.js';
import { getSalonServices, getAvailableSlots } from '../../../api/_lib/salonData.js';

const XAI_URL = 'https://api.x.ai/v1';

function apiKey() {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
}

async function request(path, options = {}) {
  const key = apiKey();
  assert(key, 503, 'AI_NOT_CONFIGURED', 'Le service Grok doit être configuré sur le serveur.');
  let response;
  try {
    response = await fetch(`${XAI_URL}/${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new HttpError(502, 'AI_NETWORK_ERROR', 'Le service Grok ne répond pas. Réessayez dans un instant.');
  }
  const body = await response.json().catch(() => ({}));
  assert(response.ok, response.status === 429 ? 429 : 502, 'AI_PROVIDER_ERROR', body.error?.message || 'Grok n’a pas pu traiter cette demande.');
  return body;
}

async function materializeUrl(item) {
  if (!item?.url) return item;
  let response;
  try {
    response = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
  } catch {
    throw new HttpError(502, 'AI_NETWORK_ERROR', 'Le résultat Grok n’a pas pu être récupéré.');
  }
  assert(response.ok, 502, 'AI_PROVIDER_ERROR', 'Le résultat Grok n’a pas pu être récupéré.');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length > 8, 502, 'INVALID_IMAGE_RESULT', 'Grok n’a pas renvoyé une image exploitable.');
  return { ...item, b64_json: bytes.toString('base64') };
}

async function pollDeferred(requestId) {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const body = await request(`images/${encodeURIComponent(requestId)}`, { method: 'GET' });
    if (body.status === 'failed' || body.error) {
      throw new HttpError(502, 'AI_PROVIDER_ERROR', body.error?.message || 'Grok a échoué pendant la génération.');
    }
    if (body.status === 'done' || body.data?.length) return body;
  }
  throw new HttpError(202, 'IMAGE_PENDING', 'Le traitement Grok continue.');
}

export function isXaiConfigured() {
  return Boolean(apiKey());
}

const CHAT_MODELS = new Set([
  'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast-reasoning',
  'grok-4',
]);
const DEFAULT_CHAT_MODEL = 'grok-4-1-fast-non-reasoning';

function cleanChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-12)
    .map((message) => {
      const role = message?.role === 'assistant' || message?.role === 'system'
        ? message.role
        : 'user';
      let content = '';
      if (typeof message?.content === 'string') content = message.content;
      else if (Array.isArray(message?.content)) {
        content = message.content
          .filter((part) => part?.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text)
          .join('\n');
      }
      return { role, content: content.slice(0, 4000) };
    })
    .filter((message) => message.content.trim());
}

const CHAT_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: "Liste le vrai catalogue du salon avec les prix et durées réels.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: "Renvoie les vrais créneaux libres du salon pour une date et une durée.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date au format AAAA-MM-JJ.' },
          duration_min: { type: 'number', description: 'Durée en minutes.' },
          service_name: { type: 'string', description: 'Nom de la prestation, optionnel.' },
        },
        required: ['date'],
        additionalProperties: false,
      },
    },
  },
];

async function executeChatTool(name, args, salonEmail) {
  const input = args && typeof args === 'object' ? args : {};
  try {
    if (name === 'list_services') {
      const result = await getSalonServices(salonEmail);
      return result.ok
        ? JSON.stringify({ status: 'success', services: result.services, packs: result.packs })
        : JSON.stringify({ status: 'error', reason: result.reason });
    }
    if (name === 'get_available_slots') {
      let duration = Number(input.duration_min) || 0;
      if (duration <= 0 && input.service_name) {
        const catalog = await getSalonServices(salonEmail);
        if (catalog.ok) {
          const query = String(input.service_name).toLowerCase();
          const service = (catalog.services || []).find((item) => String(item.name).toLowerCase().includes(query));
          duration = Number(service?.duration_min) || 60;
        }
      }
      const result = await getAvailableSlots(salonEmail, input.date, duration || 60);
      return result.ok
        ? JSON.stringify({ status: 'success', closed: !!result.closed, slots: result.slots || [] })
        : JSON.stringify({ status: 'error', reason: result.reason });
    }
    return JSON.stringify({ status: 'error', reason: 'OUTIL_INCONNU' });
  } catch {
    return JSON.stringify({ status: 'error', reason: 'LECTURE_IMPOSSIBLE' });
  }
}

/** Local-development equivalent of the Vercel /api/xai-chat function. */
export async function chatCompletion({ messages, system, model, max_tokens, enable_tools, salon_email }) {
  const cleaned = cleanChatMessages(messages);
  assert(cleaned.length > 0, 400, 'MESSAGE_REQUIRED', 'Aucun message à traiter.');

  const selectedModel = CHAT_MODELS.has(model) ? model : DEFAULT_CHAT_MODEL;
  const maxTokens = Math.min(Math.max(parseInt(max_tokens, 10) || 600, 50), 1000);
  const salonEmail = enable_tools && typeof salon_email === 'string' ? salon_email.trim().toLowerCase() : '';
  let systemText = typeof system === 'string' ? system.trim().slice(0, 8000) : '';

  if (salonEmail) {
    systemText += `\n\n[DONNÉES DU SALON] Aujourd'hui nous sommes le ${new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())}. Utilise toujours les outils avant de donner un prix, une durée ou une disponibilité. N'invente jamais ces informations.`;
  }

  const baseMessages = systemText
    ? [{ role: 'system', content: systemText }, ...cleaned]
    : cleaned;
  const withTools = Boolean(salonEmail);
  let conversation = baseMessages;
  let response;

  for (let round = 0; round < (withTools ? 4 : 1); round += 1) {
    response = await request('chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: conversation,
        ...(withTools ? { tools: CHAT_TOOL_DEFS, tool_choice: 'auto' } : {}),
      }),
    });
    const message = response?.choices?.[0]?.message || {};
    const toolCalls = withTools && Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!toolCalls.length) break;

    conversation = [...conversation, {
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls,
    }];
    for (const toolCall of toolCalls.slice(0, 4)) {
      let args = {};
      try { args = JSON.parse(toolCall.function?.arguments || '{}'); } catch { /* invalid tool args */ }
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: await executeChatTool(toolCall.function?.name, args, salonEmail),
      });
    }
  }

  const content = response?.choices?.[0]?.message?.content || '';
  return {
    content,
    model: response?.model || selectedModel,
    usage: response?.usage,
    tools_used: withTools,
  };
}

// Vision is also used by the public catalogue search. Keep the provider call
// server-side so neither the xAI key nor an AI request is exposed in the app.
export async function generateVisionText({ image_url, prompt }) {
  const body = await request('chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      // grok-4.7 is the current xAI model with image understanding. Older
      // fast slugs can be unavailable for newly created teams.
      model: process.env.XAI_VISION_MODEL || 'grok-4.7',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image_url, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      }],
      temperature: 0,
      max_tokens: 450,
    }),
  });
  return body?.choices?.[0]?.message?.content || '';
}

export async function xaiImageEdit({ images, prompt }) {
  let body = await request('images/edits', {
    method: 'POST',
    body: JSON.stringify({
      model: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0',
      prompt,
      images: images.map(url => ({ type: 'image_url', url })),
      aspect_ratio: '1:1',
    }),
  });
  if (body.request_id && !body.data?.length) body = await pollDeferred(body.request_id);
  if (body.data?.[0]?.url && !body.data[0].b64_json) {
    body = { ...body, data: [await materializeUrl(body.data[0]), ...body.data.slice(1)] };
  }
  return body;
}
