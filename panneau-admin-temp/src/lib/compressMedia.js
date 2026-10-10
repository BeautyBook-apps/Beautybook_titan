/**
 * Compresse les médias (images ET vidéos) côté client avant upload.
 * Objectif : passer sous la barre des 50 Mo sans perte visuelle.
 *
 * Images → Canvas API (resize + JPEG quality adaptatif)
 * Vidéos → MediaRecorder (re-encodage bitrate adaptatif)
 */

// Le serveur d'administration accepte 20 Mo par média. On garde une marge
// pour l'encodage JSON/base64 utilisé par l'upload local.
const MAX_SIZE_BYTES = 18 * 1024 * 1024;

// ─── IMAGES ──────────────────────────────────────────────────────────────────

/**
 * Compresse une image avec qualité adaptative pour rester sous maxBytes.
 */
export async function compressImage(file, opts = {}) {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85,
    maxBytes = MAX_SIZE_BYTES,
  } = opts;

  if (!file || !(file instanceof File)) return file;

  const type = file.type || '';
  if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') {
    return file;
  }

  // Si déjà sous la limite, ne pas compresser
  if (file.size <= maxBytes) {
    // Mais on redimensionne quand même si trop grand en dimensions
    const bitmap = await createImageBitmap(file);
    const needsResize = bitmap.width > maxWidth || bitmap.height > maxHeight;
    bitmap.close();
    if (!needsResize) return file;
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Redimensionner si dépasse les dimensions max
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outputType = 'image/jpeg';
  let q = quality;

  // Essayer avec la qualité demandée, réduire si trop gros
  let blob = await canvasToBlob(canvas, outputType, q);
  let attempts = 0;
  while (blob && blob.size > maxBytes && q > 0.15 && attempts < 8) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, outputType, Math.max(0.15, q));
    attempts++;
  }

  // Si toujours trop gros, réduire les dimensions
  if (blob && blob.size > maxBytes) {
    const scale = Math.sqrt(maxBytes / blob.size) * 0.9;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, outputType, 0.7);
  }

  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: outputType, lastModified: Date.now() });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

// ─── VIDÉOS ──────────────────────────────────────────────────────────────────

/**
 * Compresse une vidéo via MediaRecorder (re-encodage canvas + stream).
 * Objectif : passer sous maxBytes sans perte visuelle perceptible.
 */
export async function compressVideo(file, opts = {}) {
  const {
    maxBytes = MAX_SIZE_BYTES,
    maxWidth = 1280,
    maxHeight = 720,
    force = false,
    onProgress = null, // (pct) => void
  } = opts;

  if (!file || !(file instanceof File)) return file;
  if (!file.type.startsWith('video/')) return file;

  // Si déjà sous la limite
  if (file.size <= maxBytes && !force) return file;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const duration = video.duration;

      if (!duration || duration === Infinity) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      // Calculer le bitrate cible pour rester sous la limite
      // bitrate = (maxBytes * 8) / duration, mais on laisse 10% de marge pour l'audio
      const targetBitrate = (maxBytes * 0.9 * 8) / duration;
      const maxDim = Math.max(vWidth, vHeight);
      let scale = 1;
      if (maxDim > Math.max(maxWidth, maxHeight)) {
        scale = Math.max(maxWidth, maxHeight) / maxDim;
      }

      const outW = Math.round(vWidth * scale);
      const outH = Math.round(vHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      if (!window.MediaRecorder || typeof canvas.captureStream !== 'function') {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      // Capturer le stream du canvas
      const canvasStream = canvas.captureStream(30);

      // Calculer le bitrate vidéo (en bps)
      const videoBitrate = Math.min(targetBitrate, 8_000_000); // max 8 Mbps
      const videoBitrateKbps = Math.round(videoBitrate / 1000);

      // MediaRecorder avec le bon codec
      const recorderMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: recorderMimeType,
        videoBitsPerSecond: videoBitrate,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size >= file.size || blob.size <= 0) {
          resolve(file); // Si pas d'amélioration, garder l'original
          return;
        }
        const ext = 'webm';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        // Le serveur valide le MIME principal, sans le suffixe codecs=...
        resolve(new File([blob], `${baseName}.${ext}`, { type: 'video/webm', lastModified: Date.now() }));
      };

      recorder.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };

      recorder.start(100);

      let started = false;

      const drawFrame = () => {
        if (video.ended || video.currentTime >= duration - 0.05) {
          if (recorder.state !== 'inactive') recorder.stop();
          video.pause();
          return;
        }

        ctx.drawImage(video, 0, 0, outW, outH);

        if (onProgress) {
          onProgress(Math.round((video.currentTime / duration) * 100));
        }

        // Synchroniser avec le timestamp de la vidéo
        const delay = Math.max(0, (1 / 30) * 1000);
        setTimeout(drawFrame, delay);
      };

      const startCapture = async () => {
        if (started) return;
        started = true;
        try {
          await video.play();
          drawFrame();
        } catch {
          if (recorder.state !== 'inactive') recorder.stop();
          else { URL.revokeObjectURL(url); resolve(file); }
        }
      };

      video.oncanplay = startCapture;
      if (video.readyState >= 2) startCapture();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    video.src = url;
  });
}

// ─── COMPREHENSIF ────────────────────────────────────────────────────────────

/**
 * Compresse un fichier média (image ou vidéo) avant upload.
 * Détecte automatiquement le type et applique la compression adaptée.
 */
export async function compressMedia(file, opts = {}) {
  if (!file || !(file instanceof File)) return file;

  const type = file.type || '';

  if (type.startsWith('image/')) {
    return compressImage(file, opts);
  }

  if (type.startsWith('video/')) {
    return compressVideo(file, { ...opts, force: Boolean(opts.forceVideoTranscode) });
  }

  // Autres types → pas de compression
  return file;
}
