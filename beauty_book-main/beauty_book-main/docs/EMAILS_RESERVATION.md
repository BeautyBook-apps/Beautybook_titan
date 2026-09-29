# Emails de réservation — configuration requise

Les emails de confirmation / annulation / remerciement sont envoyés par la
Edge Function Supabase **`send-reservation-email`** via **Resend**.
Sans cette configuration, les appels échouent silencieusement (try/catch) et
aucun email ne part — l'application continue de fonctionner.

## 1. Créer un compte Resend

1. Aller sur https://resend.com → créer un compte.
2. **API Keys** → Create API Key → la copier.
3. **Domains** → ajouter votre domaine (ex : `beautybook.app`) et valider le
   DNS, OU utiliser le domaine de test `onboarding@resend.dev` (limité).

## 2. Déclarer les secrets Supabase

```bash
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set RESEND_FROM="BeautyBook <contact@beautybook.app>"
```

(`RESEND_FROM` doit utiliser un domaine validé dans Resend, sinon les emails
sont rejetés.)

## 3. Déployer la fonction

```bash
supabase functions deploy send-reservation-email
```

## 4. Migrations SQL à exécuter (Supabase → SQL Editor)

Dans l'ordre :

1. `supabase/migrations/20260929_booking_codes_qr.sql`
   - colonnes `booking_code` (matricule unique, ex `BB-7K2Q9P`) et
     `qr_code_url` sur `Reservation` ;
   - valeurs par défaut automatiques (le serveur vocal n'a rien à changer) ;
   - fonction RPC `get_reservation_by_code(code)` pour la recherche par ID ;
   - bucket public `qr-codes` (stockage des QR codes).
2. Les 4 migrations précédentes toujours en attente :
   - `20260929_salon_ai_settings.sql`
   - `20260929_maria_conversation.sql`
   - `20260929_prestation_showcase.sql`
   - `20260928_add_service_questions.sql`

## 5. Ce qui est envoyé, et quand

| Déclencheur | Email | Contenu |
|---|---|---|
| Le pro clique **Accepter** (Gestion agenda) | Confirmation | Récapitulatif + **QR code** + code client + ID de réservation |
| Le pro clique **Refuser** / annule | Annulation | Message d'annulation |
| Le pro valide le code client (prestation terminée) | Remerciement | Merci + invitation à laisser un avis + rappel des points fidélité |

Le QR code est généré automatiquement à la confirmation s'il n'existe pas
encore (y compris pour les RDV créés par téléphone via l'agent vocal IA).

## 6. Côté client (sans application)

Le client qui a réservé par téléphone reçoit son **ID de réservation** :
- dicté par l'agent vocal IA pendant l'appel ;
- écrit dans l'email de confirmation (si un email est connu).

Dans l'application, page **Rendez-vous** → **« Ajouter un ID de réservation »** →
le récapitulatif complet s'affiche (service, date, heure, salon, prix, code
client, QR code).

## 7. Côté pro

Dans le détail d'un RDV **confirmé**, sous la section **Code client** :
- **Scanner le QR code** → ouvre la caméra, scanne le QR du client,
  pré-remplit automatiquement son code à 4 chiffres → **Valider**.
