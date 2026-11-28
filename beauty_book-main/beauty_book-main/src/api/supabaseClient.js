import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl && import.meta.env.PROD) {
  console.error('[Supabase] VITE_SUPABASE_URL is missing in the production environment.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Origine de l'application : toujours HTTP en local pour éviter les problèmes SSL
export const appOrigin = (() => {
  if (typeof window !== 'undefined') {
    let origin = window.location.origin;
    // Force HTTP pour localhost (Google OAuth autorise http://localhost)
    if (origin.includes('localhost:') || origin.includes('127.0.0.1:')) {
      origin = origin.replace(/^https:/i, 'http:');
    }
    return origin.replace(/\/$/, '');
  }
  return (import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
})();
export const authCallbackUrl = `${appOrigin}/auth/callback`;
export { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
