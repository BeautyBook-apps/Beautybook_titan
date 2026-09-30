-- Photos « Prestations réalisées » : vitrine photo par service / bundle,
-- alimentée par le pro après validation d'une prestation (code client).
create table if not exists public.prestation_showcase (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  is_bundle boolean not null default false,
  photo_url text not null,
  caption text default '',
  position integer not null default 0,
  pro_email text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_prestation_showcase_target
  on public.prestation_showcase (service_id, is_bundle, position);

alter table public.prestation_showcase enable row level security;

-- Lecture publique (vitrine visible par les clients)
drop policy if exists "Lecture publique vitrine" on public.prestation_showcase;
create policy "Lecture publique vitrine"
  on public.prestation_showcase for select
  using (true);

-- Insertion / suppression par utilisateurs connectés (le pro gère sa vitrine)
drop policy if exists "Pro gère sa vitrine" on public.prestation_showcase;
create policy "Pro gère sa vitrine"
  on public.prestation_showcase for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── Lien avec l'avis du client : chaque photo est associée à la réservation
-- (et donc à l'avis laissé par le client pour ce RDV).
alter table public.prestation_showcase
  add column if not exists reservation_id text default '';
alter table public.prestation_showcase
  add column if not exists client_name text default '';
create index if not exists idx_prestation_showcase_reservation
  on public.prestation_showcase (reservation_id);
