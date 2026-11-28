// A configured URL/key does not imply the running process has network access.
// Probe the public auth settings; never create a session or log credentials.
export async function checkAuthConnectivity({ env = process.env, fetchImpl = fetch } = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { reachable: false, code: 'BACKEND_NOT_CONFIGURED' };
  }
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return {
      reachable: false,
      code: [401, 403].includes(response.status) ? 'AUTH_CONFIGURATION_INVALID' : 'AUTH_UNAVAILABLE',
      status: response.status,
    };
    const settings = await response.json();
    return settings && typeof settings.external === 'object'
      ? { reachable: true }
      : { reachable: false, code: 'AUTH_INVALID_RESPONSE' };
  } catch (error) {
    const networkCode = error.cause?.code || error.code;
    return {
      reachable: false,
      code: 'AUTH_UNAVAILABLE',
      reason: ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EACCES', 'EPERM'].includes(networkCode)
        ? networkCode : error.name === 'TimeoutError' ? 'TIMEOUT' : 'CONNECTION_FAILED',
    };
  }
}
