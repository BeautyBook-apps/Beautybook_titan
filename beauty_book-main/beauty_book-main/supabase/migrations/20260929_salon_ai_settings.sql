-- ─── Réglages IA par salon ────────────────────────────────────────────────
-- Un salon = un pro_email = ses propres réglages (agent vocal, chatbot, agent_id, voix).
-- Les visiteurs lisent ces réglages pour savoir si le chatbot est visible.
create table if not exists public.salon_ai_settings (
  pro_email text primary key,
  vocal_enabled boolean not null default true,
  chatbot_enabled boolean not null default true,
  agent_id text not null default '',
  voice text not null default 'ara',
  updated_at timestamptz not null default now()
);

alter table public.salon_ai_settings enable row level security;

drop policy if exists "Lecture publique des reglages IA salon" on public.salon_ai_settings;
create policy "Lecture publique des reglages IA salon"
  on public.salon_ai_settings for select
  using (true);

drop policy if exists "Le pro gere ses propres reglages IA" on public.salon_ai_settings;
create policy "Le pro gere ses propres reglages IA"
  on public.salon_ai_settings for insert
  with check ((auth.jwt() ->> 'email') = pro_email);

drop policy if exists "Le pro modifie ses propres reglages IA" on public.salon_ai_settings;
create policy "Le pro modifie ses propres reglages IA"
  on public.salon_ai_settings for update
  using ((auth.jwt() ->> 'email') = pro_email)
  with check ((auth.jwt() ->> 'email') = pro_email);
