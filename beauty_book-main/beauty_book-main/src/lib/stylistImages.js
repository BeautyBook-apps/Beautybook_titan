import { compressSimulationImage } from './simulationImage.js';

export const UNUSED_IMAGE_TTL = 3 * 60 * 1000;

// Object URLs are browser memory only: no public upload or persisted draft.
export function createTemporaryImages({ urls = URL, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const images = new Set();
  let timer;
  const clear = () => { for (const url of images) urls.revokeObjectURL(url); images.clear(); };
  return {
    add(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisissez une image JPG, PNG ou WebP.');
      if (file.size > 20 * 1024 * 1024) throw new Error('La photo doit faire moins de 20 Mo.');
      const url = urls.createObjectURL(file); images.add(url); return url;
    },
    resume() { if (timer) cancel(timer); },
    leave() { if (timer) cancel(timer); timer = schedule(clear, UNUSED_IMAGE_TTL); },
    clear,
  };
}

async function inlineImage(source, signal) {
  if (!source) throw new Error('Ajoutez toutes les images nécessaires.');
  let response;
  try { response = await fetch(source, { signal }); }
  catch (error) {
    if (signal?.aborted) throw error;
    // Catalogue URLs without CORS are checked by the backend before submission.
    if (source.startsWith('https://')) return source;
    throw new Error('Cette photo a expiré. Importez-la à nouveau.');
  }
  if (!response.ok) throw new Error('Une image est inaccessible. Importez-la à nouveau.');
  const blob = await response.blob();
  const prepared = await compressSimulationImage(blob);
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture de la photo impossible.'));
    reader.readAsDataURL(prepared);
  });
}

export async function prepareStylistImages({ photo, references = [], pieces, signal }) {
  const entries = pieces ? Object.entries(pieces).filter(([, image]) => image) : [];
  const sources = entries.length ? entries.map(([, image]) => image) : references.slice(0, 2);
  if (!sources.length) throw new Error('Sélectionnez au moins une image de référence.');
  const prepared = await Promise.all([photo, ...sources].map(source => inlineImage(source, signal)));
  if (prepared.join('').length > 10 * 1024 * 1024) throw new Error('Les images sont trop volumineuses. Choisissez des photos plus petites.');
  signal?.throwIfAborted();
  return {
    user_photo: prepared[0],
    garment_photo: prepared[1],
    ...(entries.length
      ? { outfit_pieces: Object.fromEntries(entries.map(([slot], index) => [slot, prepared[index + 1]])) }
      : { reference_images: prepared.slice(1) }),
  };
}
