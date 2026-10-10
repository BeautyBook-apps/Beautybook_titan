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
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const requestOptions = { ...options, headers, signal: options.signal || AbortSignal.timeout(60000) };
  let response;
  try {
    response = await fetchImpl(apiUrl(endpoint, baseUrl), requestOptions);
  } catch (error) {
    throw new ApiError(error.name === 'TimeoutError' ? 'Le serveur met trop de temps à répondre.' : 'Connexion au serveur impossible. Vérifiez votre connexion.', 0, 'NETWORK_ERROR');
  }
  // Supabase can return a cached access token just as it expires. Refresh it
  // once before exposing a false "session expired" error to the user.
  if (response.status === 401 && session?.refresh_token && refreshSession && !(options.body instanceof FormData)) {
    try {
      const refreshed = await refreshSession();
      if (refreshed?.access_token) {
        session = refreshed;
        requestOptions.headers.set('Authorization', `Bearer ${refreshed.access_token}`);
        response = await fetchImpl(apiUrl(endpoint, baseUrl), requestOptions);
      }
    } catch {
      // The normal 401 response below remains the source of truth when the
      // refresh token is no longer valid.
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error || 'Le serveur n’a pas pu terminer cette opération.', response.status, body.code, body.request_id);
  }
  if (options.responseType === 'blob') return response.blob();
  if (response.status === 204) return null;
  const body = await response.json().catch(() => { throw new ApiError('Réponse serveur invalide.', response.status, 'INVALID_RESPONSE'); });
  if (body?.success === false || body?.fallback === true || body?.error) throw new ApiError(body.error || body.message || 'Cette opération a échoué.', response.status, body.code || 'OPERATION_FAILED');
  return body;
}
