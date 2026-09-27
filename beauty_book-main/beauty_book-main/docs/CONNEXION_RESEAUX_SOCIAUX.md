# Connecter vraiment les réseaux sociaux (Maria AI Social)

L'outil de connexion OAuth est prêt dans le code. Pour qu'il fonctionne, il faut
créer les applications développeur (Meta + TikTok), déployer la fonction backend
et créer la table. Suivez les étapes dans l'ordre — environ 30 minutes.

---

## Étape 1 — Créer l'application Meta (Instagram + Facebook + WhatsApp)

1. Allez sur **https://developers.facebook.com** → connectez-vous → **Créer une app**
   → type **Entreprise** → nommez-la par ex. « BeautyBook Maria ».
2. Dans le tableau de bord de l'app, notez **l'ID d'app** et la **clé secrète d'app**
   (Paramètres → Général).
3. Ajoutez les produits : **Facebook Login**, **Instagram**, **WhatsApp**.
4. **Facebook Login → Paramètres** → ajoutez cette URL exacte dans
   « URI de redirection OAuth valides » :
   ```
   https://vimusrczrjvefsbljtmf.supabase.co/functions/v1/social-oauth/callback
   ```
5. Pour Instagram : l'app doit être liée à une **Page Facebook** elle-même liée à
   votre **compte Instagram professionnel** (Paramètres de la Page → Comptes liés).
6. Pour WhatsApp : créez votre compte dans **Meta Business Suite** → WhatsApp
   (business.facebook.com → Tous les outils → WhatsApp) et notez le numéro.

> En mode développement, l'app ne peut connecter que les comptes ajoutés comme
> **testeurs** (Rôles → Ajouter des testeurs). Pour un usage public complet, Meta
> demandera une validation de l'app — ce n'est pas nécessaire pour votre propre salon.

## Étape 2 — Créer l'application TikTok

1. Allez sur **https://developers.tiktok.com** → **Manage apps** → **Create an app**.
2. Renseignez les infos, ajoutez le scope **user.info.basic**.
3. Dans **Login Kit**, ajoutez cette URL de redirection exacte :
   ```
   https://vimusrczrjvefsbljtmf.supabase.co/functions/v1/social-oauth/callback
   ```
4. Notez la **Client key** et le **Client secret**.

## Étape 3 — Créer la table en base (2 minutes)

1. Ouvrez **https://supabase.com/dashboard** → projet **vimusrczrjvefsbljtmf**
   → **SQL Editor** → **New query**.
2. Copiez-collez tout le contenu du fichier
   `supabase/migrations/20260928_social_connections.sql` du dépôt.
3. Cliquez **Run**. Vérifiez que les tables `social_connections` et
   `social_oauth_states` apparaissent dans **Table Editor**.

## Étape 4 — Déployer la fonction backend (5 minutes)

1. Dans le dashboard Supabase → **Edge Functions** → **Create a new function**
   → nommez-la exactement : **`social-oauth`**.
2. Ouvrez le fichier `supabase/functions/social-oauth/index.ts` du dépôt,
   copiez tout son contenu dans l'éditeur de la fonction → **Deploy**.
3. Toujours dans **Edge Functions** → cliquez sur `social-oauth` → **Secrets**
   → ajoutez un par un :
   | Nom | Valeur |
   |---|---|
   | `META_APP_ID` | ID d'app Meta (étape 1) |
   | `META_APP_SECRET` | Clé secrète d'app Meta |
   | `TIKTOK_CLIENT_KEY` | Client key TikTok (étape 2) |
   | `TIKTOK_CLIENT_SECRET` | Client secret TikTok |
   | `SUPABASE_URL` | `https://vimusrczrjvefsbljtmf.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` (Project Settings → API) |
   | `APP_URL` | `https://thelastjiren.vercel.app` |
4. Test : ouvrez dans le navigateur
   `https://vimusrczrjvefsbljtmf.supabase.co/functions/v1/social-oauth/health`
   → vous devez voir `{"ok":true}`.

## Étape 5 — Tester dans l'app

1. Ouvrez **Maria → AI Social** (ou `/social-media`).
2. Cliquez **« Se connecter avec Instagram »** → autorisez sur la page Meta →
   vous revenez sur l'app avec la bannière « Instagram connecté avec succès »
   et votre `@pseudo` affiché comme compte vérifié.
3. Même chose pour Facebook, WhatsApp, TikTok.
4. La connexion alternative **par clé API manuelle** reste disponible
   (elle est désormais vraiment vérifiée auprès de chaque plateforme).

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| « URI de redirection invalide » chez Meta/TikTok | L'URL de l'étape 1.4 / 2.3 n'est pas à l'identique (pas de `/` final) |
| Bannière rouge « Session OAuth expirée » | Le `state` a dépassé 10 min : recommencez |
| « Aucun compte Instagram professionnel lié » | Liez votre compte IG pro à votre Page Facebook |
| « Aucun Business Meta trouvé » (WhatsApp) | Créez le Business sur business.facebook.com |
| `/health` ne répond pas | La fonction n'est pas déployée ou mal nommée |

## Fichiers concernés

- `supabase/functions/social-oauth/index.ts` — backend OAuth (échange code→token, profil, stockage)
- `supabase/migrations/20260928_social_connections.sql` — tables + RLS
- `src/lib/socialOAuth.js` — helpers frontend
- `src/pages/SocialMedia.jsx` — boutons « Se connecter avec… », bannières, états
