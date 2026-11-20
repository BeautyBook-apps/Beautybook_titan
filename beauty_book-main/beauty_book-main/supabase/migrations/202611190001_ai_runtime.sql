-- BeautyBook: tables requises par les crédits IA et les simulations Muse.
-- Migration additive et relançable : elle ne supprime ni ne modifie les données existantes.

create table if not exists public.bb_ai_credit_settings (
  id boolean primary key default true check (id = true),
  free_daily_limit integer not null default 5 check (free_daily_limit > 0),
  provider_cost_cents integer not null default 0 check (provider_cost_cents >= 0),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.bb_ai_credit_packages (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents >= 0),
  highlight boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bb_ai_credit_packages (id, name, credits, amount_cents, highlight, display_order)
values
  ('starter', 'Pack Découverte', 10, 499, false, 1),
  ('studio', 'Pack Studio', 30, 999, true, 2),
  ('creator', 'Pack Créateur', 100, 2499, false, 3)
on conflict (id) do nothing;

create table if not exists public.bb_ai_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bb_image_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  request_hash text not null,
  kind text not null check (kind in ('hair', 'article', 'outfit', 'exchange')),
  label text not null default 'Essayage',
  input jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'uncertain', 'deleted')),
  billing_source text not null default 'free' check (billing_source in ('free', 'credits')),
  credit_cost integer not null default 0 check (credit_cost >= 0),
  billing_refunded_at timestamptz,
  output_path text,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);

-- Le tableau peut déjà exister sur les projets ayant reçu une première version
-- du système de simulation. CREATE TABLE IF NOT EXISTS ne complète pas ces tables.
alter table public.bb_image_jobs
  add column if not exists billing_source text not null default 'free',
  add column if not exists credit_cost integer not null default 0,
  add column if not exists billing_refunded_at timestamptz;

create index if not exists bb_image_jobs_queue_idx
  on public.bb_image_jobs (status, created_at) where status in ('queued', 'processing');
create index if not exists bb_image_jobs_user_created_idx
  on public.bb_image_jobs (user_id, created_at desc);

create table if not exists public.bb_ai_credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  image_job_id uuid references public.bb_image_jobs(id) on delete set null,
  stripe_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bb_ai_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null unique,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  checkout_url text,
  package_id text not null references public.bb_ai_credit_packages(id),
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bb_audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  resource text not null,
  resource_id text,
  changes jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

-- Les écritures passent par le backend privé. Les clients ne peuvent pas lire
-- ou modifier directement les quotas, crédits, jobs ou achats.
alter table public.bb_ai_credit_settings enable row level security;
alter table public.bb_ai_credit_packages enable row level security;
alter table public.bb_ai_credit_wallets enable row level security;
alter table public.bb_image_jobs enable row level security;
alter table public.bb_ai_credit_ledger enable row level security;
alter table public.bb_ai_credit_purchases enable row level security;
alter table public.bb_audit_log enable row level security;

revoke all on table public.bb_ai_credit_settings from anon, authenticated;
revoke all on table public.bb_ai_credit_packages from anon, authenticated;
revoke all on table public.bb_ai_credit_wallets from anon, authenticated;
revoke all on table public.bb_image_jobs from anon, authenticated;
revoke all on table public.bb_ai_credit_ledger from anon, authenticated;
revoke all on table public.bb_ai_credit_purchases from anon, authenticated;
revoke all on table public.bb_audit_log from anon, authenticated;
grant select, insert, update, delete on table public.bb_ai_credit_settings to service_role;
grant select, insert, update, delete on table public.bb_ai_credit_packages to service_role;
grant select, insert, update, delete on table public.bb_ai_credit_wallets to service_role;
grant select, insert, update, delete on table public.bb_image_jobs to service_role;
grant select, insert, update, delete on table public.bb_ai_credit_ledger to service_role;
grant select, insert, update, delete on table public.bb_ai_credit_purchases to service_role;
grant select, insert, update, delete on table public.bb_audit_log to service_role;
grant usage, select on sequence public.bb_ai_credit_ledger_id_seq to service_role;
grant usage, select on sequence public.bb_audit_log_id_seq to service_role;

insert into public.bb_ai_credit_settings (id, free_daily_limit, provider_cost_cents)
values (true, 5, 0)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
