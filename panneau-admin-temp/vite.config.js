import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import { localAdminPlugin } from './server/local-admin.mjs';
export default defineConfig(({ command, mode }) => {
 const backendEnv = loadEnv(mode, path.resolve(import.meta.dirname, '../beauty_book-main/beauty_book-main/backend'), '');
 return {
 server:{host:'localhost',port:5174,strictPort:true,fs:{allow:[import.meta.dirname,path.resolve(import.meta.dirname,'../shared')]},proxy:{'/api':{target:'http://127.0.0.1:3000',changeOrigin:true}}},
 plugins:[react(), ...(command === 'serve' && mode !== 'production' ? [localAdminPlugin({url:backendEnv.SUPABASE_URL,serviceKey:backendEnv.SUPABASE_SERVICE_ROLE_KEY,auditPath:path.resolve(import.meta.dirname,'admin.local.audit.log')})] : [])],
 define: command === 'build' || mode === 'production' ? { __LOCAL_ADMIN_TOKEN__: '""' } : {},
 resolve:{alias:{'@':path.resolve(import.meta.dirname,'src')}},
 };
});
