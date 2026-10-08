-- ============================================================================
-- Trasferta — 0005_drive.sql
-- Foto ricordo su Google Drive: una cartella per evento, creata nel Drive di
-- chi crea l'evento (consenso incrementale drive.file, vedi SPEC §9 task
-- "Foto ricordo"). Il refresh token resta leggibile SOLO dalle Edge
-- Function (service role): nessuna policy RLS lo rende visibile al client.
-- ============================================================================

create table public.google_drive_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text not null,
  cartella_radice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_tokens enable row level security;
-- Nessuna policy: solo le Edge Function (service role, che bypassa le RLS)
-- possono leggere o scrivere questa tabella. Il client non vi accede mai
-- direttamente, nemmeno per il proprio utente.

create or replace function public.drive_connesso()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.google_drive_tokens where user_id = auth.uid());
$$;

comment on function public.drive_connesso is
  'Dice al client se l''utente corrente ha già collegato il proprio Google Drive, senza esporre il token.';

alter table public.eventi
  add column drive_folder_url text,
  add column drive_folder_id text,
  add column drive_cartella_proprietario uuid references public.profiles (id);

comment on column public.eventi.drive_cartella_proprietario is
  'Chi ha creato la cartella Drive per questo evento: le foto vivono nel SUO spazio gratuito.';

-- La vista eventi_con_media (0001_schema.sql) espande "e.*" alla creazione:
-- le colonne aggiunte dopo con ALTER TABLE non compaiono in automatico.
-- CREATE OR REPLACE non basta: le nuove colonne Drive finiscono prima di
-- media_stelle/numero_voti nell'espansione di e.*, il che sposterebbe
-- colonne già esistenti — Postgres lo vieta. Si ricrea da zero: in un vero
-- progetto Supabase questa vista riprende da sola i permessi di default
-- (stessa alter default privileges che vale per ogni nuovo oggetto creato
-- dal ruolo che applica le migration).
drop view if exists public.eventi_con_media;

create view public.eventi_con_media as
select
  e.*,
  coalesce(round(avg(v.stelle)::numeric * 2) / 2, 0) as media_stelle,
  count(v.stelle) as numero_voti
from public.eventi e
left join public.voti_evento v on v.evento_id = e.id
group by e.id;
