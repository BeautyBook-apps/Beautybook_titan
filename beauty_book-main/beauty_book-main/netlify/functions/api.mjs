// Adapter that runs the Vercel-style handlers from /api on Netlify Functions.
// Each handler keeps its (req, res) signature; this file translates the
// Web Request into a minimal Node-like req/res pair and back.
import xaiChat from '../../api/xai-chat.js';
import voiceKey from '../../api/voice-key.js';
import xaiToken from '../../api/xai-token.js';
import xaiVisitorToken from '../../api/xai-visitor-token.js';
import analyzePhoto from '../../api/ai/analyze-photo.js';
import imageSearch from '../../api/ai/image-search.js';
import invokeLlm from '../../api/ai/invoke-llm.js';
import maria from '../../api/ai/maria.js';
import searchStyles from '../../api/ai/search-styles.js';
import simulateHairstyle from '../../api/ai/simulate-hairstyle.js';
import tts from '../../api/ai/tts.js';
import tryOn from '../../api/v8/boutique/try-on.js';
import catchAll from '../../api/[...path].js';

const routes = {
  'xai-chat': xaiChat,
  'voice-key': voiceKey,
  'xai-token': xaiToken,
  'xai-visitor-token': xaiVisitorToken,
  'ai/analyze-photo': analyzePhoto,
  'ai/image-search': imageSearch,
  'ai/invoke-llm': invokeLlm,
  'ai/maria': maria,
  'ai/search-styles': searchStyles,
  'ai/simulate-hairstyle': simulateHairstyle,
  'ai/tts': tts,
  'v8/boutique/try-on': tryOn,
};

async function readBody(request, raw) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return undefined;
  const buffer = Buffer.from(await request.arrayBuffer());
  if (raw) return buffer;
  const text = buffer.toString('utf-8');
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    try { return text ? JSON.parse(text) : {}; } catch { return text; }
  }
  return text;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const handler = routes[route] || catchAll;

  const headers = Object.fromEntries(request.headers);
  if (!headers['x-forwarded-for'] && context?.ip) headers['x-forwarded-for'] = context.ip;

  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    body: await readBody(request, handler === catchAll),
  };

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const outHeaders = new Headers();
    const finish = (body) => resolve(new Response(body ?? null, { status: statusCode, headers: outHeaders }));
    const res = {
      get statusCode() { return statusCode; },
      set statusCode(code) { statusCode = code; },
      status(code) { statusCode = code; return res; },
      setHeader(name, value) { outHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value)); return res; },
      getHeader(name) { return outHeaders.get(name); },
      json(data) {
        if (!outHeaders.has('content-type')) outHeaders.set('content-type', 'application/json; charset=utf-8');
        finish(JSON.stringify(data));
        return res;
      },
      send(data) {
        if (data !== null && typeof data === 'object' && !Buffer.isBuffer(data) && !(data instanceof Uint8Array)) return res.json(data);
        finish(data);
        return res;
      },
      end(data) { finish(data); return res; },
    };
    Promise.resolve(handler(req, res)).then(() => finish(), reject);
  }).catch(() => Response.json({ error: 'Erreur interne du serveur.' }, { status: 500 }));
};

export const config = { path: '/api/*' };
