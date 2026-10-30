import { assert, HttpError } from '../lib/errors.js';

export async function openaiRequest(path, payload, { binary = false, fetchImpl = fetch, timeoutMs=45000 } = {}) {
  assert(process.env.OPENAI_API_KEY, 503, 'AI_NOT_CONFIGURED', 'Le service IA est temporairement indisponible.');
  const multipart = payload instanceof FormData;
  let response;
  try {
    response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
      body: multipart ? payload : JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HttpError(502, 'AI_NETWORK_ERROR', 'Le service IA ne répond pas. Réessayez dans un instant.');
  }
  assert(response.ok, response.status === 429 ? 429 : 502, 'AI_PROVIDER_ERROR', 'Le service IA n’a pas pu traiter cette demande.');
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}

export function extractText(response) {
  return (response.output || []).filter(item => item.type === 'message')
    .flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
}

export async function generateText({ input, instructions, tools, max_output_tokens = 1600 }) {
  return openaiRequest('responses', { model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input, instructions, tools, max_output_tokens, store: false });
}

export function checkedImage(url) {
  assert(typeof url === 'string' && url.length <= 8 * 1024 * 1024, 400, 'INVALID_IMAGE', 'Image invalide.');
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return url;
  let parsed;
  try { parsed = new URL(url); } catch { /* validated below */ }
  assert(parsed?.protocol === 'https:' && !parsed.username && !parsed.password, 400, 'INVALID_IMAGE_URL', 'L’image doit utiliser une adresse HTTPS.');
  return url;
}

export async function generateSpeech(text) {
  assert(typeof text === 'string' && text.trim().length > 0 && text.length <= 4096, 400, 'INVALID_SPEECH', 'Le texte vocal doit contenir entre 1 et 4096 caractères.');
  if (process.env.OPENAI_API_KEY) {
    return openaiRequest('audio/speech', {
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: process.env.OPENAI_TTS_VOICE || 'coral', input: text,
      instructions: 'Parle en français avec une voix féminine naturelle, chaleureuse et professionnelle. Articule les horaires et les prix clairement.',
      response_format: 'mp3',
    }, { binary: true });
  }

  // Local installations often have xAI configured but no OpenAI account. The
  // project already ships an Edge-TTS fallback, so keep the endpoint usable.
  try {
    const { speakToBase64 } = await import('./voicebox.js');
    const result = await speakToBase64(text, { profile: 'Maria', language: 'fr' });
    assert(result?.audio_base64, 503, 'TTS_NOT_CONFIGURED', 'La synthèse vocale est temporairement indisponible.');
    return Buffer.from(result.audio_base64, 'base64');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'TTS_NOT_CONFIGURED', 'La synthèse vocale est temporairement indisponible.');
  }
}

export async function transcribe({ content, type }) {
  assert(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'].includes(type), 400, 'INVALID_AUDIO_TYPE', 'Format audio non pris en charge.');
  assert(typeof content === 'string' && /^[A-Za-z0-9+/=]+$/.test(content) && content.length <= 10 * 1024 * 1024, 400, 'INVALID_AUDIO', 'Enregistrement audio invalide ou trop volumineux.');
  const form = new FormData();
  form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
  form.append('language', 'fr');
  form.append('file', new Blob([Buffer.from(content, 'base64')], { type }), `audio.${type.split('/')[1]}`);
  return openaiRequest('audio/transcriptions', form);
}
