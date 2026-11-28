import { HttpError, assert } from '../lib/errors.js';

const FAL_BASE = 'https://queue.fal.run';
const MUSE_EDIT_MODEL = 'meta/muse-image/edit';

export function isFalConfigured(env = process.env) {
  return Boolean(env.FAL_KEY);
}

export async function submitFalModel(endpoint, payload, { fetchImpl = fetch, maxWaitMs = 180000, pollMs = 2000 } = {}) {
  const falKey = process.env.FAL_KEY || '';
  if (!falKey) throw new HttpError(503, 'FAL_NOT_CONFIGURED', 'Le fournisseur fal.ai n’est pas configuré.');

  let submitRes;
  try {
    submitRes = await fetchImpl(`${FAL_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!submitRes.ok) {
      throw new HttpError(submitRes.status === 429 ? 429 : 502, 'FAL_PROVIDER_ERROR', `fal.ai n’a pas accepté la demande (${submitRes.status}).`);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'FAL_NETWORK_ERROR', 'fal.ai ne répond pas. Réessayez dans un instant.');
  }

  const { request_id: requestId, response_url: responseUrl, status_url: statusUrl } = await submitRes.json();
  assert(requestId, 502, 'FAL_PROVIDER_ERROR', 'fal.ai n’a pas retourné d’identifiant de génération.');
  // Queue URLs omit the model subpath (e.g. /edit). Reusing the submit
  // endpoint here returns 405 even when the billable generation succeeds.
  const requestUrl = `${FAL_BASE}/${endpoint.split('/').slice(0, 2).join('/')}/requests/${encodeURIComponent(requestId)}`;
  const queueUrl = value => {
    const url = new URL(value);
    assert(url.origin === FAL_BASE && !url.username && !url.password, 502, 'FAL_PROVIDER_ERROR', 'Adresse de suivi invalide.');
    return url.href;
  };
  const pollingUrl = queueUrl(statusUrl || `${requestUrl}/status`);
  const resultUrl = queueUrl(responseUrl || requestUrl);

  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    let statusRes;
    try {
      statusRes = await fetchImpl(pollingUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!statusRes.ok) throw new HttpError(502, 'FAL_PROVIDER_ERROR', 'fal.ai n’a pas pu lire l’état de la génération.');
      const status = await statusRes.json();
      if (status.status === 'COMPLETED') {
        const resultRes = await fetchImpl(resultUrl, {
          headers: { 'Authorization': `Key ${falKey}` },
          signal: AbortSignal.timeout(60000),
        });
        if (!resultRes.ok) throw new HttpError(502, 'FAL_PROVIDER_ERROR', 'Le résultat fal.ai est inaccessible.');
        return await resultRes.json();
      }
      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        throw new HttpError(502, 'FAL_PROVIDER_ERROR', 'fal.ai n’a pas pu générer cette image.');
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'FAL_NETWORK_ERROR', 'fal.ai ne répond pas. Réessayez dans un instant.');
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new HttpError(504, 'FAL_TIMEOUT', 'La génération fal.ai prend trop de temps. Réessayez depuis votre historique.');
}

async function downloadFalImage(url, { fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(60000) });
  } catch {
    throw new HttpError(502, 'FAL_NETWORK_ERROR', 'Le résultat fal.ai est inaccessible.');
  }
  assert(response.ok, 502, 'FAL_PROVIDER_ERROR', 'Le résultat fal.ai est inaccessible.');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length > 8 && bytes.length <= 24 * 1024 * 1024, 502, 'INVALID_IMAGE_RESULT', 'fal.ai a renvoyé une image inexploitable.');
  return bytes;
}

async function assertFalInputImagesAccessible(images, { fetchImpl = fetch } = {}) {
  for (const image of images) {
    if (/^data:image\/(jpeg|png|webp);base64,/.test(image)) continue;
    let response;
    try {
      response = await fetchImpl(image, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      if (!response.ok && [400, 403, 405, 501].includes(response.status)) {
        response = await fetchImpl(image, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(15000) });
      }
    } catch {
      throw new HttpError(400, 'FAL_IMAGE_UNAVAILABLE', 'Une image de référence n’est pas accessible. Importez-la à nouveau puis réessayez.');
    }
    assert(response.ok, 400, 'FAL_IMAGE_UNAVAILABLE', 'Une image de référence n’est pas accessible. Importez-la à nouveau puis réessayez.');
  }
}

export async function falMuseImageEdit({ images, prompt, fetchImpl = fetch }) {
  assert(Array.isArray(images) && images.length >= 1 && images.length <= 10, 400, 'REFERENCE_REQUIRED', 'Ajoutez une image de référence.');
  await assertFalInputImagesAccessible(images, { fetchImpl });
  const result = await submitFalModel(MUSE_EDIT_MODEL, {
    prompt,
    image_urls: images,
    num_images: 1,
    output_format: 'png',
  }, { fetchImpl });
  const image = result?.images?.[0];
  assert(typeof image?.url === 'string' && image.url.startsWith('https://'), 502, 'INVALID_IMAGE_RESULT', 'fal.ai n’a pas renvoyé d’image exploitable.');
  const bytes = await downloadFalImage(image.url, { fetchImpl });
  return { data: [{ b64_json: bytes.toString('base64') }], output_format: 'png' };
}
