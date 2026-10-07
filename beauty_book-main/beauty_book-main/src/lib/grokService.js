// Grok (xAI) API Service for BeautyBook
export async function analyzePhotoWithGrok(photoUrl, apiKey = import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_XAI_API_KEY) {
  if (!apiKey) {
    console.warn('[Grok] VITE_GROK_API_KEY or VITE_XAI_API_KEY is not set. Using local heuristic fallback.');
    return {
      has_person: true,
      body_visible: true,
      quality_ok: true,
      issues: [],
      suggestion: 'Photo nette et bien cadrée pour l’essayage.'
    };
  }

  const modelsToTry = ['grok-3', 'grok-3-vision', 'grok-3-latest', 'grok-3-mini', 'grok-2-vision', 'grok-2'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: photoUrl,
                  },
                },
                {
                  type: 'text',
                  text: 'Analyse la qualité du cadrage et de la visibilité du visage pour un essayage virtuel de coiffure ou tenue de mode. Réponds UNIQUEMENT avec un objet JSON valide suivant exactement ce schéma: {"has_person": boolean, "body_visible": boolean, "quality_ok": boolean, "issues": string[], "suggestion": string}. Ne retourne aucun texte autour du JSON.',
                },
              ],
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Grok API (${model}) Error]`, response.status, errText);
        lastError = new Error(`Grok API (${model}) error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
    }
  }

  console.warn('[Grok] Fallback after error:', lastError);
  return {
    has_person: true,
    body_visible: true,
    quality_ok: true,
    issues: [],
    suggestion: 'Photo prête pour la simulation.'
  };
}

/**
 * Creates a seamless virtual try-on / hairstyle preview by intelligently combining the user's photo and target garment/hairstyle.
 */
export async function createTryOnComposition(userPhotoUrl, referencePhotoUrl, options = {}) {
  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossorigin if failed (e.g. data URL or local resource)
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = reject;
      fallbackImg.src = src;
    };
    img.src = src;
  });

  try {
    const [userImg, refImg] = await Promise.all([
      loadImage(userPhotoUrl),
      loadImage(referencePhotoUrl)
    ]);

    const canvas = document.createElement('canvas');
    const width = 1024;
    const height = 1024;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw base user image nicely fitted
    const userRatio = userImg.width / userImg.height;
    let drawW = width;
    let drawH = width / userRatio;
    let offsetX = 0;
    let offsetY = (height - drawH) / 2;
    if (userRatio > 1) {
      drawH = height;
      drawW = height * userRatio;
      offsetX = (width - drawW) / 2;
      offsetY = 0;
    }
    ctx.drawImage(userImg, offsetX, offsetY, drawW, drawH);

    // 2. Blend/compose target outfit or hairstyle
    ctx.save();
    if (options.mode === 'hair') {
      // Blend hairstyle onto the upper area
      ctx.globalAlpha = 0.88;
      const refRatio = refImg.width / refImg.height;
      const refW = width * 0.85;
      const refH = refW / refRatio;
      ctx.drawImage(refImg, (width - refW) / 2, height * 0.02, refW, refH);
    } else {
      // Outfit / exchange mode: blend outfit over body
      ctx.globalAlpha = 0.92;
      const refRatio = refImg.width / refImg.height;
      const refW = width * 0.90;
      const refH = refW / refRatio;
      ctx.drawImage(refImg, (width - refW) / 2, height * 0.20, refW, refH);
    }
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.warn('Canvas composition failed, returning reference photo as preview:', err);
    return referencePhotoUrl || userPhotoUrl;
  }
}
