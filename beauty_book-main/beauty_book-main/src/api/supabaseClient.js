import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vimusrczrjvefsbljtmf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbXVzcmN6cmp2ZWZzYmxqdG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODg1MDksImV4cCI6MjA5NzU2NDUwOX0.2fSiqWfYKs3fadwRkS9Nvdq9b9JqnsmtMTHg-wN5m6k';

if (!import.meta.env.VITE_SUPABASE_URL && import.meta.env.PROD) {
  console.error('[Supabase] VITE_SUPABASE_URL is missing in the production environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Production should provide VITE_PUBLIC_APP_URL; localhost remains a development fallback.
export const appOrigin = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
export const authCallbackUrl = `${appOrigin}/auth/callback`;
