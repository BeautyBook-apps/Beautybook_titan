-- ─── Agent vocal : base de connaissances par salon ─────────────────────────
-- Chaque salon garde ses propres réglages d'agent vocal :
--   welcome_message    : message de bienvenue dit par l'agent en début d'appel
--                        (vide = modèle par défaut avec le nom du salon)
--   custom_instructions: instructions personnalisées (vide = modèle par défaut)
--   connection_mode    : 'direct' (recommandé : instructions FR + outils +
--                        données temps réel de l'app) ou 'agent' (console xAI)
alter table public.salon_ai_settings
  add column if not exists welcome_message text not null default '',
  add column if not exists custom_instructions text not null default '',
  add column if not exists connection_mode text not null default 'direct';
