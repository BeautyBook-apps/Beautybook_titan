// Keep multi-image requests small enough for mobile uploads and hosting proxies.
export async function compressSimulationImage(blob) {
  let image;
  let objectUrl;
  try {
    if (typeof createImageBitmap === 'function') {
      try { image = await createImageBitmap(blob); } catch { /* Safari fallback below. */ }
    }
    if (!image && typeof Image !== 'undefined') {
      objectUrl = URL.createObjectURL(blob);
      image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Cette photo ne peut pas être lue. Choisissez une photo JPG ou PNG.'));
        element.src = objectUrl;
      });
    }
    if (!image) {
      if (blob.size <= 256 * 1024) return blob;
      throw new Error('Cette photo ne peut pas être préparée. Choisissez une photo plus petite.');
    }
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('La photo est illisible. Importez une autre image.');
    const canvas = document.createElement('canvas');
    for (const [maxSize, quality] of [[1280, 0.82], [1024, 0.82], [800, 0.80], [640, 0.78], [640, 0.68], [512, 0.65]]) {
      const scale = Math.min(1, maxSize / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Préparation de la photo impossible.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (compressed && compressed.size <= 256 * 1024) return compressed;
    }
    throw new Error('Cette photo reste trop volumineuse. Recadrez-la puis réessayez.');
  } finally {
    image?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
