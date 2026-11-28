import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''),
    },
    envPrefix: ['VITE_', 'SUPABASE_'],
    plugins: [react()],
    resolve: { dedupe:['react','react-dom'], alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      fs: { deny: ['.env', '.env.*', '**/.maria_key', '**/*.key', '**/*.pem', '**/backend/**'] },
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.LOCAL_BACKEND_URL || 'http://127.0.0.1:3000', changeOrigin: true },
      }
    },
    build: { sourcemap: false },
  };
});
