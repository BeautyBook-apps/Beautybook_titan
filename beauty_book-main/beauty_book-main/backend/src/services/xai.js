import { assert, HttpError } from '../lib/errors.js';

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
