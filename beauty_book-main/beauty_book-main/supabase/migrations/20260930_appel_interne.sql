-- ─── Appel interne : l'agent vocal IA décroche les appels dans l'app ──────
-- Quand le salon active « appel_interne » (et que son agent vocal est actif),
-- un visiteur qui appuie sur « APPELER » dans l'application parle à l'agent
-- vocal IA du salon au lieu de joindre le téléphone du professionnel.
alter table public.salon_ai_settings
  add column if not exists appel_interne boolean not null default false;
