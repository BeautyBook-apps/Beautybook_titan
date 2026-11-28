export class ApiError extends Error {
  constructor(message, status, code, requestId) {
    super(message); this.status = status; this.code = code; this.requestId = requestId;
  }
}

export function apiUrl(endpoint, baseUrl = '') {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('Chemin API invalide.');
  const base = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  const path = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;
  return base + path;
}

export async function requestApi(endpoint, options = {}, { baseUrl = '', getSession, refreshSession, fetchImpl = fetch } = {}) {
  let session = await getSession?.();
  const { requireAuth = false, ...fetchOptions } = options;
  if (requireAuth && !session?.access_token) {
    throw new ApiError('Connectez-vous pour consulter votre historique privé.', 401, 'AUTH_REQUIRED');
  }
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const requestOptions = { ...fetchOptions, headers, signal: options.signal || AbortSignal.timeout(60000) };
  let response;
  try {
    response = await fetchImpl(apiUrl(endpoint, baseUrl), requestOptions);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(error.name === 'TimeoutError' ? 'Le serveur met trop de temps à répondre.' : 'Connexion au serveur impossible. Vérifiez votre connexion.', 0, 'NETWORK_ERROR');
  }
  // Supabase can return a cached access token just as it expires. Refresh it
  // once before exposing a false "session expired" error to the user.
  if (response.status === 401 && session?.refresh_token && refreshSession && !(options.body instanceof FormData)) {
    let refreshed;
    try {
      refreshed = await refreshSession();
    } catch {
      // The normal 401 response below remains the source of truth when the
      // refresh token is no longer valid.
    }
    if (refreshed?.access_token) {
      requestOptions.headers.set('Authorization', `Bearer ${refreshed.access_token}`);
      try {
        response = await fetchImpl(apiUrl(endpoint, baseUrl), requestOptions);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        throw new ApiError('Connexion au serveur impossible. Vérifiez votre connexion.', 0, 'NETWORK_ERROR');
      }
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const fallbackCode = response.status === 401 ? 'SESSION_INVALID' : response.status === 413
      ? 'IMAGES_TOO_LARGE'
      : [502, 503, 504].includes(response.status)
        ? 'BACKEND_UNAVAILABLE'
        : response.status === 404
          ? 'ENDPOINT_NOT_FOUND'
          : undefined;
    const fallbackError = response.status === 401 ? 'Votre session a expiré. Reconnectez-vous.' : response.status === 413
      ? 'Les images envoy?es sont trop volumineuses.'
      : [502, 503, 504].includes(response.status)
        ? 'Le serveur de simulation est momentan?ment indisponible. R?essayez dans quelques instants.'
        : 'Le serveur n?a pas pu terminer cette op?ration.';
    throw new ApiError(body.error || fallbackError, response.status, body.code || fallbackCode, body.request_id);
  }
  if (options.responseType === 'blob') return response.blob();
  if (response.status === 204) return null;
  const body = await response.json().catch(() => { throw new ApiError('Réponse serveur invalide.', response.status, 'INVALID_RESPONSE'); });
  if (body?.success === false || body?.fallback === true || body?.error) throw new ApiError(body.error || body.message || 'Cette opération a échoué.', response.status, body.code || 'OPERATION_FAILED');
  return body;
}
