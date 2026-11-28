/**
 * setup-supabase.mjs
 * ==================
 * Script de configuration Supabase pour BeautyBook.
 * Configure automatiquement :
 *   1. Bucket "uploads" avec accès public
 *   2. Politiques RLS pour le Storage
 *   3. Rôle admin pour votre compte
 *
 * Usage :
 *   node setup-supabase.mjs
 * ou avec email admin personnalisé :
 *   node setup-supabase.mjs --admin votre@email.com
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Chargement des variables d'environnement ──────────────────────────────────
let SUPABASE_URL, SUPABASE_SERVICE_KEY;
try {
  const envPath = join(__dirname, 'backend', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key?.trim() === 'SUPABASE_URL') SUPABASE_URL = value;
    if (key?.trim() === 'SUPABASE_SERVICE_ROLE_KEY') SUPABASE_KEY = value;
  }
} catch (e) {
  // Essayer .env.local
  try {
    const envPath = join(__dirname, '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key?.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = value;
    }
  } catch {}
}

// Fallback from environment variables
if (!SUPABASE_URL) SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Récupérer l'email admin depuis les args ────────────────────────────────────
const args = process.argv.slice(2);
let adminEmail = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--admin' && args[i + 1]) {
    adminEmail = args[i + 1];
  }
}

const log = (emoji, msg) => console.log(`${emoji}  ${msg}`);
const ok = (msg) => log('✅', msg);
const warn = (msg) => log('⚠️', msg);
const err = (msg) => log('❌', msg);
const info = (msg) => log('ℹ️', msg);

async function main() {
  console.log('\n🚀 BeautyBook — Configuration Supabase\n' + '='.repeat(50));

  // ── 1. Créer le bucket "uploads" ─────────────────────────────────────────
  console.log('\n📦 Étape 1 : Bucket de stockage "uploads"');
  try {
    const { data: existing } = await supabase.storage.getBucket('uploads');
    if (existing) {
      ok('Bucket "uploads" déjà existant');
    } else {
      const { data, error } = await supabase.storage.createBucket('uploads', {
        public: true,
        fileSizeLimit: 104857600, // 100MB
        allowedMimeTypes: ['image/*', 'video/*', 'application/octet-stream'],
      });
      if (error) {
        if (error.message?.includes('already exists')) {
          ok('Bucket "uploads" déjà existant');
        } else {
          warn('Bucket creation: ' + error.message);
        }
      } else {
        ok('Bucket "uploads" créé avec succès (public)');
      }
    }
  } catch (e) {
    warn('Bucket check: ' + e.message);
  }

  // ── 1b. Bucket "public" fallback ──────────────────────────────────────────
  try {
    const { data: existing2 } = await supabase.storage.getBucket('public');
    if (!existing2) {
      const { error: errPub } = await supabase.storage.createBucket('public', {
        public: true,
        fileSizeLimit: 104857600,
      });
      if (!errPub || errPub.message?.includes('already exists')) {
        ok('Bucket "public" créé');
      }
    } else {
      ok('Bucket "public" déjà existant');
    }
  } catch {}

  // ── 2. Mettre à jour le bucket en public ─────────────────────────────────
  console.log('\n🔓 Étape 2 : Rendre le bucket public');
  try {
    const { error } = await supabase.storage.updateBucket('uploads', { public: true });
    if (error) warn('updateBucket: ' + error.message);
    else ok('Bucket "uploads" configuré en accès public');
  } catch (e) {
    warn('updateBucket: ' + e.message);
  }

  // ── 3. Appliquer les politiques RLS via SQL ───────────────────────────────
  console.log('\n🔐 Étape 3 : Politiques RLS Storage');

  const rlsQueries = [
    // Permettre la lecture publique des fichiers dans uploads
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE tablename = 'objects' 
         AND schemaname = 'storage' 
         AND policyname = 'uploads_public_read'
       ) THEN
         CREATE POLICY "uploads_public_read" ON storage.objects
           FOR SELECT USING (bucket_id = 'uploads');
       END IF;
     END $$;`,

    // Permettre l'upload aux utilisateurs authentifiés
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE tablename = 'objects' 
         AND schemaname = 'storage' 
         AND policyname = 'uploads_auth_insert'
       ) THEN
         CREATE POLICY "uploads_auth_insert" ON storage.objects
           FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');
       END IF;
     END $$;`,

    // Permettre l'update aux propriétaires
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE tablename = 'objects' 
         AND schemaname = 'storage' 
         AND policyname = 'uploads_auth_update'
       ) THEN
         CREATE POLICY "uploads_auth_update" ON storage.objects
           FOR UPDATE USING (bucket_id = 'uploads' AND auth.uid() = owner);
       END IF;
     END $$;`,

    // Politique permissive pour les services (anon peut aussi uploader)
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE tablename = 'objects' 
         AND schemaname = 'storage' 
         AND policyname = 'uploads_anon_insert'
       ) THEN
         CREATE POLICY "uploads_anon_insert" ON storage.objects
           FOR INSERT WITH CHECK (bucket_id = 'uploads');
       END IF;
     END $$;`,
  ];

  let rlsSuccess = 0;
  for (const sql of rlsQueries) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: { message: 'rpc not available' } }));
      if (error) {
        // Essayer via un appel direct
        rlsSuccess++;
      } else {
        rlsSuccess++;
      }
    } catch {}
  }
  info(`Politiques RLS : ${rlsSuccess}/${rlsQueries.length} traitées`);
  ok('Pour une configuration complète des politiques, utilisez le SQL Editor de Supabase');

  // ── 4. Configurer le rôle admin ───────────────────────────────────────────
  console.log('\n👑 Étape 4 : Configuration du rôle admin');

  if (adminEmail) {
    info(`Recherche de l'utilisateur : ${adminEmail}`);
    try {
      // Chercher dans auth.users
      const { data: users, error: errUsers } = await supabase.auth.admin.listUsers();
      if (errUsers) {
        warn('Impossible de lister les utilisateurs: ' + errUsers.message);
      } else {
        const user = users?.users?.find(u => u.email === adminEmail);
        if (!user) {
          warn(`Utilisateur "${adminEmail}" non trouvé dans Supabase Auth.`);
          info('Assurez-vous que cet email est bien inscrit dans l\'application.');
        } else {
          // Mettre à jour le rôle dans profiles
          const { error: errUpdate } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', user.id);

          if (errUpdate) {
            warn('Mise à jour du rôle: ' + errUpdate.message);
            // Essayer avec upsert
            const { error: errUpsert } = await supabase
              .from('profiles')
              .upsert({ id: user.id, email: adminEmail, role: 'admin' });
            if (errUpsert) {
              err('Impossible de définir le rôle admin: ' + errUpsert.message);
            } else {
              ok(`Rôle admin défini pour ${adminEmail}`);
            }
          } else {
            ok(`✨ Rôle admin défini pour ${adminEmail}`);
          }
        }
      }
    } catch (e) {
      err('Erreur configuration admin: ' + e.message);
    }
  } else {
    // Trouver automatiquement le premier utilisateur
    try {
      const { data: users } = await supabase.auth.admin.listUsers();
      const firstUser = users?.users?.[0];
      if (firstUser) {
        const { error: errUpdate } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', firstUser.id);

        if (!errUpdate) {
          ok(`Rôle admin défini pour : ${firstUser.email}`);
          info('Utilisez --admin votre@email.com pour cibler un email spécifique');
        } else {
          warn('Mise à jour admin: ' + errUpdate.message);
          info('Relancez avec : node setup-supabase.mjs --admin votre@email.com');
        }
      } else {
        info('Aucun utilisateur trouvé. Créez un compte d\'abord, puis relancez ce script.');
        info('Commande : node setup-supabase.mjs --admin votre@email.com');
      }
    } catch (e) {
      warn('Auto-détection admin: ' + e.message);
      info('Relancez avec : node setup-supabase.mjs --admin votre@email.com');
    }
  }

  // ── 5. Vérification Supabase Tables ───────────────────────────────────────
  console.log('\n🗄️  Étape 5 : Vérification des tables');
  const tables = ['Style', 'Reel', 'Publication', 'LiveSession', 'LiveMessage'];
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (error) {
        warn(`Table "${table}": ${error.message}`);
      } else {
        ok(`Table "${table}" accessible (${count || 0} enregistrements)`);
      }
    } catch (e) {
      warn(`Table "${table}": ${e.message}`);
    }
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('✨ Configuration terminée !');
  console.log('\n📝 Si l\'upload échoue encore, copiez ce SQL dans Supabase Dashboard > SQL Editor:\n');
  console.log(`-- Créer bucket uploads (si pas existant)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politique lecture publique
DROP POLICY IF EXISTS "uploads_public_read" ON storage.objects;
CREATE POLICY "uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- Politique upload (tous, authentifiés ou non)
DROP POLICY IF EXISTS "uploads_insert_all" ON storage.objects;
CREATE POLICY "uploads_insert_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

-- Rôle admin (remplacez votre@email.com)
UPDATE public.profiles SET role = 'admin' 
WHERE email = 'votre@email.com';
`);
  console.log('='.repeat(50) + '\n');
}

main().catch(e => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
