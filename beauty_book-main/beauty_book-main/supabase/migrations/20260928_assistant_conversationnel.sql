-- ─────────────────────────────────────────────────────────────────────────────
-- Assistant conversationnel Maria (remplace AI Social Media)
-- Tables : automatisations DM, leads (emails capturés), journal d'activité,
-- FAQ personnalisées de la base de connaissances.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Automatisations (builder style Manychat) ──
create table if not exists public.social_automations (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  platform text not null check (platform in ('instagram', 'facebook', 'whatsapp')),
  name text not null,
  trigger_type text not null default 'comment_keyword'
    check (trigger_type in ('comment_keyword', 'dm_keyword', 'new_follower')),
  trigger_keyword text not null default '',
  steps jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_automations_user_idx on public.social_automations (user_email);

-- ── Leads : emails capturés par l'assistant ──
create table if not exists public.social_leads (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  platform text,
  automation_id uuid references public.social_automations(id) on delete set null,
  email text not null,
  pseudo text,
  created_at timestamptz not null default now()
);
create index if not exists social_leads_user_idx on public.social_leads (user_email);

-- ── Journal d'activité de l'assistant ──
create table if not exists public.social_events (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  platform text,
  automation_id uuid references public.social_automations(id) on delete set null,
  event_type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists social_events_user_idx on public.social_events (user_email);
create index if not exists social_events_type_idx on public.social_events (event_type);

-- ── FAQ personnalisées (base de connaissances) ──
create table if not exists public.social_faq (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
create index if not exists social_faq_user_idx on public.social_faq (user_email);

-- ── RLS : chaque utilisateur ne gère que SES lignes ──
alter table public.social_automations enable row level security;
alter table public.social_leads enable row level security;
alter table public.social_events enable row level security;
alter table public.social_faq enable row level security;

drop policy if exists "social_automations_owner" on public.social_automations;
create policy "social_automations_owner" on public.social_automations
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists "social_leads_owner" on public.social_leads;
create policy "social_leads_owner" on public.social_leads
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists "social_events_owner" on public.social_events;
create policy "social_events_owner" on public.social_events
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists "social_faq_owner" on public.social_faq;
create policy "social_faq_owner" on public.social_faq
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

-- Note : la Edge Function `social-webhook` utilise la clé service_role
-- (contourne le RLS) pour lire les automatisations et écrire leads/événements.
