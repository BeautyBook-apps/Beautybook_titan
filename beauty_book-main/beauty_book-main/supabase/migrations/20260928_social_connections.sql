-- Connexions OAuth aux réseaux sociaux (Maria AI Social)
-- Utilisé par la Edge Function `social-oauth`.

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  platform text not null check (platform in ('instagram', 'facebook', 'whatsapp', 'tiktok')),
  platform_user_id text not null,
  username text,
  display_name text,
  avatar_url text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_email, platform)
);

create table if not exists public.social_oauth_states (
  state text primary key,
  user_email text not null,
  platform text not null,
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.social_connections enable row level security;
alter table public.social_oauth_states enable row level security;

-- Chaque utilisateur ne voit et ne gère que SES connexions.
drop policy if exists "social_connections_owner" on public.social_connections;
create policy "social_connections_owner" on public.social_connections
  for all
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

-- social_oauth_states : aucune policy publique -> seul le service_role
-- (la Edge Function) peut lire/écrire. C'est volontaire.
