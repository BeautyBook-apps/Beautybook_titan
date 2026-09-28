# Assistant conversationnel Maria — Guide technique

La page **« Assistant conversationnel »** (route `/social-media`) remplace l'ancienne
page « AI Social Media ». Elle fonctionne comme Manychat :

- **Automatisations** : scénarios DM pour Instagram, Facebook, WhatsApp
  (mot-clé → DM d'ouverture → demande de follow → demande d'email →
  réservation → lien → relance), avec aperçu téléphone réel.
- **Connaissances** : données synchronisées du salon (services, horaires,
  tarifs, contact) + FAQ personnalisées. L'assistant ne répond qu'avec des
  données réelles — jamais d'invention.
- **Plateformes** : connexion OAuth / clé API vérifiée (Meta v21.0, TikTok).
- **Statistiques** : compteurs locaux/réels uniquement (aucune donnée
  inventée), export CSV des leads.
- **Widget public** : bouton « Discuter avec Maria » sur la page publique du
  salon (VueClient), qui écrit de vraies réservations.

## 3 canaux de réponse

1. **Page publique BeautyBook** — le widget (`AssistantChatWidget.jsx`)
   écrit directement dans la table `Reservation`.
2. **DMs réseaux sociaux** — via la Edge Function `social-webhook`
   (webhook Meta : Instagram + Facebook).
3. **Commentaires réseaux sociaux** — mot-clé détecté → réponse privée
   (`/{comment_id}/private_replies`), puis scénario DM.

WhatsApp : l'envoi automatique nécessite un template validé (limite Meta) —
prévoir une phase de validation avant activation. TikTok : aucun DM
automatique public n'existe via l'API — canal désactivé par défaut.

## Réservation réelle

`createAssistantReservation()` / la fonction webhook insèrent dans
`Reservation` avec `source: "maria_assistant"`, `status: "en_attente"`.
GestionAgenda écoute cette table en temps réel : la réservation apparaît
immédiatement.

Google Agenda : la connexion est réutilisée du **Réceptionniste IA**
(`voice_server_url`, `voice_server_admin_token`, `voice_server_salon`).
Le serveur vocal expose désormais `POST /api/calendar/event` (protégé par
`x-admin-token`) et `/api/salons` retourne `pro_email` pour le bon salon.
Si Google n'est pas connecté, la réservation reste enregistrée et l'écran
le dit honnêtement.

## Migration Supabase

`supabase/migrations/20260928_assistant_conversationnel.sql` crée :

- `social_automations` — scénarios (platform, trigger_type, trigger_keyword,
  steps JSONB, enabled)
- `social_leads` — emails capturés
- `social_events` — journal (ouvertures, emails, clics, réservations,
  états de conversation `conv_state`, relances `pending_followup`)
- `social_faq` — FAQ personnalisées de la base de connaissances

RLS : chaque utilisateur ne gère que ses lignes
(`(auth.jwt() ->> 'email') = user_email`). La fonction webhook utilise la
clé `service_role` (contourne le RLS).

## Déploiement de la fonction

```bash
cd ~/workspace/thelast/beauty_book-main/beauty_book-main
supabase functions deploy social-webhook
supabase secrets set \
  VERIFY_TOKEN=<token_choisi> \
  VOICE_SERVER_URL=<url_serveur_vocal> \
  VOICE_SERVER_ADMIN_TOKEN=<admin_token> \
  APP_URL=https://thelastjiren.vercel.app
```

## Meta App → webhook

1. App Meta : produits **Messenger** + **Instagram**, champs
   `comments` et `messages` souscrits.
2. URL de callback : `https://<projet>.supabase.co/functions/v1/social-webhook`
3. Token de vérification : le même que `VERIFY_TOKEN`.
4. Relances : cron (toutes les heures) → `POST …/social-webhook/followup`
   avec la clé service en `Authorization: Bearer`.

## Tests manuels

- `/social-media` : créer une automatisation, « Aperçu » → le téléphone
  simule ; email invalide refusé ; réservation crée une ligne visible dans
  Gestion agenda ; lien ouvre le vrai lien ; relance accélérée (5 s).
- Statistiques → « Exporter CSV » télécharge les vrais leads.
- Connaissances → ajouter une FAQ → l'aperçu et le widget y répondent.
- Widget public : ouvrir la page publique d'un salon (en navigation privée),
  discuter, réserver → vérifier la ligne dans Gestion agenda.

## Chatbot sur le site web du salon

Maria peut aussi vivre sur le site internet du salon (hors BeautyBook) :
les visiteurs discutent avec elle (vraies données : prestations, tarifs,
horaires, FAQ) et réservent — chaque réservation arrive dans
« Gestion agenda » avec le badge **Site web** (`source = 'maria_widget'`).

### Fonctionnement
- **Edge Function `maria-widget`** (`supabase/functions/maria-widget/`) :
  `GET /knowledge`, `POST /chat`, `POST /book`. CORS ouvert (faite pour
  être appelée depuis n'importe quel site). Utilise la `service_role` key :
  aucune modification RLS nécessaire. Anti-abus basique : 10 réservations /
  10 min / IP sur `/book`.
- **Page publique `/maria-site/:code`** : chatbot plein écran, sans connexion,
  pensé pour l'iframe. Le `:code` est l'email pro encodé en base64url —
  généré automatiquement dans l'onglet **Site web** de la page Assistant
  (lien direct + code `<iframe>` à copier + aperçu en direct).

### Déploiement
1. `supabase functions deploy maria-widget`
2. `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`
   (optionnel : `VOICE_SERVER_URL`, `VOICE_SERVER_ADMIN_TOKEN` pour
   Google Agenda — mêmes secrets que `social-webhook`).
3. Dans l'Assistant → onglet **Site web** : copier le code iframe et le
   coller sur le site du salon.
