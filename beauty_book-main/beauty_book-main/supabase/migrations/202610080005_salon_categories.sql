alter table if exists public."DemandeProV2"
  add column if not exists categorie text;

alter table if exists public."ProfilPro"
  add column if not exists categorie text;
