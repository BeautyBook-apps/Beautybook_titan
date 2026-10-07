export const OAUTH_INTENT_KEY = 'bb_oauth_intent';
export const OAUTH_INTENT_TTL = 30 * 60 * 1000;
export function readOAuthIntent(storage, now = Date.now()) {
  try {
    const intent = JSON.parse(storage.getItem(OAUTH_INTENT_KEY) || 'null');
    if (!intent || !['google','apple'].includes(intent.provider) || !['login','signup'].includes(intent.mode) ||
      !Number.isFinite(intent.createdAt) || now < intent.createdAt || now - intent.createdAt > OAUTH_INTENT_TTL) return null;
    return intent;
  } catch { return null; }
}

export async function getSocialProviders(client, fetchImpl = fetch) {
  try {
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(6000) : undefined;
    const response = await fetchImpl(client.supabaseUrl + '/auth/v1/settings', {
      headers: { apikey: client.supabaseKey }, ...(signal ? { signal } : {}),
    });
    if (response.ok) {
      const settings = await response.json();
      return { 
        google: settings.external?.google ?? true, 
        apple: settings.external?.apple ?? false 
      };
    }
  } catch {
    // Fallback if settings endpoint fails
  }
  return { google: true, apple: false };
}

export async function startSocialAuth(client, provider, { mode = 'login', origin, storage, redirect, fetchImpl } = {}) {
  if (!['google','apple'].includes(provider)) throw new Error('Connexion non prise en charge.');
  
  // Normalize origin for local development: never send https://localhost:5173 to avoid SSL handshake error
  let safeOrigin = origin || window.location.origin;
  if (safeOrigin.includes('localhost:') || safeOrigin.includes('127.0.0.1:')) {
    safeOrigin = safeOrigin.replace(/^https:/i, 'http:');
  }

  const callback = new URL('/auth/callback', safeOrigin);
  if (storage) {
    storage.setItem(OAUTH_INTENT_KEY, JSON.stringify({ provider, mode, createdAt: Date.now() }));
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.href,
      skipBrowserRedirect: false,
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
    }
  });

  if (error) {
    if (storage) storage.removeItem(OAUTH_INTENT_KEY);
    throw new Error('Impossible de démarrer la connexion. Réessayez.');
  }

  if (data?.url) {
    if (redirect) {
      redirect(data.url);
    } else {
      window.location.assign(data.url);
    }
  }
}

