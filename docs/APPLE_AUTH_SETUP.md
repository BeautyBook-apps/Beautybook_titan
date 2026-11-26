# Authentification Apple

Le client BeautyBook lance maintenant `signInWithOAuth({ provider: 'apple' })`,
demande les scopes `name email`, échange le retour PKCE sur `/auth/callback` et
redirige les nouvelles inscriptions Apple vers l’onboarding si Apple ne renvoie
pas le nom.

## Configuration Supabase obligatoire

Le fournisseur Apple doit être activé dans Supabase :

1. Apple Developer → Identifiers : créer un **App ID** avec Sign in with Apple.
2. Créer un **Services ID** lié à cet App ID et activer Sign in with Apple.
3. Dans le Services ID, ajouter le domaine de production et l’URL de retour :
   `https://vimusrczrjvefsbljtmf.supabase.co/auth/v1/callback`
4. Dans Supabase → Authentication → Providers → Apple, renseigner le Services
   ID, le Team ID, la Key ID et la clé privée `.p8`, puis activer le provider.
5. Dans Supabase → Authentication → URL Configuration, autoriser les URL de
   l’application, notamment :
   `http://localhost:5173/auth/callback` et
   `https://<domaine-de-production>/auth/callback`.

Le projet distant répond actuellement `apple: false` sur
`/auth/v1/settings`. Tant que le provider Apple n’est pas activé avec les
identifiants Apple Developer, aucun changement frontend ne peut terminer la
connexion Apple.

## Base de données

Appliquer la migration suivante avant de tester une première inscription :

`supabase/migrations/202611260001_auth_profile_compatibility.sql`

Elle évite d’imposer `role = 'user'` lors de la création d’un profil. La base
distante BeautyBook utilise actuellement `role = 'client'` par défaut, ce qui
était la cause du `400 Bad Request` observé après la vérification email.
