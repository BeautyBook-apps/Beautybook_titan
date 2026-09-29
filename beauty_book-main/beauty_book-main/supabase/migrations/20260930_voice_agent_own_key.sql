-- ─── Agent vocal : clé API vocale propre à chaque salon ────────────────────
-- Chaque professionnel peut brancher SA PROPRE clé API du service vocal :
--   voice_api_key: clé stockée côté serveur uniquement.
-- Sécurité :
--   - la lecture de la colonne est RÉVOQUÉE pour les rôles anon/authenticated
--     (la politique SELECT publique de salon_ai_settings ne doit JAMAIS
--     exposer les clés) ; seul le rôle service la lit (routes /api/voice-key,
--     /api/xai-token et edge function social-webhook).
--   - le navigateur ne reçoit qu'un indicateur « configurée / non ».
alter table public.salon_ai_settings
  add column if not exists voice_api_key text not null default '';

-- La clé brute n'est jamais lisible via l'API publique, même par son propriétaire.
revoke select (voice_api_key) on public.salon_ai_settings from public;
revoke select (voice_api_key) on public.salon_ai_settings from anon;
revoke select (voice_api_key) on public.salon_ai_settings from authenticated;
