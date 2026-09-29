-- Configuration de l'agent social IA (Maria community manager)
-- Lue par la Edge Function `social-webhook` pour répondre aux DMs et
-- commentaires via Grok en suivant les INSTRUCTIONS du salon (plus de mots-clés).

create table if not exists public.social_agent_config (
  pro_email text primary key,
  enabled boolean not null default true,
  instructions text not null default '',
  tone text not null default 'chaleureux',
  dm_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  platforms jsonb not null default '{"dm":{"instagram":true,"facebook":true,"whatsapp":true},"comments":{"instagram":true,"facebook":true}}',
  updated_at timestamptz not null default now()
);

alter table public.social_agent_config enable row level security;

-- Chaque pro ne voit et ne gère que SA config (le service_role la lit côté webhook).
drop policy if exists "social_agent_config_owner" on public.social_agent_config;
create policy "social_agent_config_owner" on public.social_agent_config
  for all
  using (pro_email = (auth.jwt() ->> 'email'))
  with check (pro_email = (auth.jwt() ->> 'email'));
