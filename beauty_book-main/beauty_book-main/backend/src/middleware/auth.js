import { getSupabaseAdmin, userSupabase } from '../config/supabase.js';
import { assert, asyncRoute } from '../lib/errors.js';
export function authMiddleware(getAdmin = getSupabaseAdmin) {
  return asyncRoute(async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    assert(match, 401, 'AUTH_REQUIRED', 'Connectez-vous pour continuer.');
    // Validate a visitor token with the project anon client. The service-role
    // client is reserved for server-side data access; using it for token
    // validation can reject otherwise valid user sessions when the project
    // service key has been rotated independently of the public client key.
    const authClient = getAdmin === getSupabaseAdmin ? userSupabase(match[1]) : getAdmin();
    const { data, error } = await authClient.auth.getUser(match[1]);
    assert(!error && data?.user && !data.user.deleted_at, 401, 'SESSION_INVALID', 'Votre session a expiré. Reconnectez-vous.');
    req.user = data.user;
    req.accessToken = match[1];
    next();
  });
}
export const requireAuth = authMiddleware();
export function adminMiddleware(permission, getAdmin = getSupabaseAdmin, env = process.env) {
  return asyncRoute(async (req, res, next) => {
    assert(req.user, 401, 'AUTH_REQUIRED', 'Connectez-vous pour continuer.');
    // Never trust user_metadata or profiles.role for administrative privileges.
    const { data: membership, error } = await getAdmin().from('bb_admin_memberships')
      .select('role,permissions,active').eq('user_id', req.user.id).maybeSingle();
    assert(!error, 503, 'ADMIN_CONFIGURATION_REQUIRED', 'L’administration sécurisée doit être configurée.');
    assert(membership?.active === true, 403, 'ADMIN_FORBIDDEN', 'Accès administrateur refusé.');
    const permissions = Array.isArray(membership.permissions) ? membership.permissions : [];
    assert(!permission || permissions.includes(permission) || permissions.includes('*'), 403, 'PERMISSION_DENIED', 'Permission insuffisante.');
    if (env.NODE_ENV === 'production' || env.ADMIN_REQUIRE_MFA === 'true') {
      let claims;
      try { claims = JSON.parse(Buffer.from(req.accessToken.split('.')[1], 'base64url').toString()); } catch { claims = {}; }
      assert(claims.aal === 'aal2', 403, 'MFA_REQUIRED', 'Validez la double authentification administrateur.');
    }
    req.admin = { role: membership.role, permissions };
    next();
  });
}
export const requirePermission = permission => adminMiddleware(permission);
export const requireRole = role => role === 'admin' ? requirePermission() : asyncRoute(async (req, res, next) => {
  assert(req.user, 401, 'AUTH_REQUIRED', 'Connectez-vous pour continuer.');
  const { data, error } = await getSupabaseAdmin().from('profiles').select('role').eq('id', req.user.id).maybeSingle();
  assert(!error && data?.role === role, 403, 'ROLE_REQUIRED', 'Ce profil ne dispose pas de cet accès.');
  next();
});
export const withUserDatabase = (req, res, next) => { req.db = userSupabase(req.accessToken); next(); };
