-- ============================================================================
-- Trasferta — 0001_schema.sql
-- Tabelle, vista, indici, trigger di creazione profilo.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text not null default '',
  avatar_url text,
  ruolo text not null default 'in_attesa'
    check (ruolo in ('in_attesa', 'passeggero', 'autista', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profilo utente, creato automaticamente al primo login Google.';

-- Trigger: crea una riga in profiles quando un utente si registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- eventi
-- ----------------------------------------------------------------------------
create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data date not null,
  ora time,
  luogo text not null,
  lat double precision,
  lng double precision,
  organizzatore text,
  premio text,
  stato text not null default 'attivo'
    check (stato in ('proposto', 'attivo', 'annullato')),
  creato_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index eventi_data_idx on public.eventi (data);
create index eventi_stato_idx on public.eventi (stato);
create index eventi_creato_da_idx on public.eventi (creato_da);

-- ----------------------------------------------------------------------------
-- voti_evento
-- ----------------------------------------------------------------------------
create table public.voti_evento (
  evento_id uuid not null references public.eventi (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stelle smallint not null check (stelle between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (evento_id, user_id)
);

-- Vista con media voti e conteggio, arrotondata a mezze stelle.
create view public.eventi_con_media as
select
  e.*,
  coalesce(round(avg(v.stelle)::numeric * 2) / 2, 0) as media_stelle,
  count(v.stelle) as numero_voti
from public.eventi e
left join public.voti_evento v on v.evento_id = e.id
group by e.id;

-- ----------------------------------------------------------------------------
-- viaggi
-- ----------------------------------------------------------------------------
create table public.viaggi (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventi (id) on delete cascade,
  tipo text not null check (tipo in ('auto', 'treno', 'pullman', 'aereo')),
  stato text not null default 'confermato'
    check (stato in ('in_attesa', 'confermato', 'annullato')),
  autista_id uuid references public.profiles (id),
  proposto_da uuid not null references public.profiles (id),
  posti_passeggeri smallint,
  ora_partenza timestamptz,
  partenza text not null default 'Napoli Centrale',
  durata_minuti int,
  distanza_km numeric,
  durata_calcolata boolean not null default false,
  costo_carburante numeric,
  costo_pedaggio numeric,
  costo_biglietto numeric,
  note text,
  created_at timestamptz not null default now(),
  constraint viaggi_auto_posti check (
    (tipo = 'auto' and posti_passeggeri is not null)
    or (tipo <> 'auto' and posti_passeggeri is null)
  ),
  constraint viaggi_auto_autista check (
    (tipo = 'auto' and (autista_id is not null or stato = 'in_attesa'))
    or (tipo <> 'auto' and autista_id is null)
  )
);

create index viaggi_evento_idx on public.viaggi (evento_id);
create index viaggi_autista_idx on public.viaggi (autista_id);
create index viaggi_stato_idx on public.viaggi (stato);

-- ----------------------------------------------------------------------------
-- partecipazioni
-- ----------------------------------------------------------------------------
-- Per i mezzi senza posti limitati (treno/pullman/aereo) una richiesta è
-- 'confermata' all'istante. Per l'auto resta 'in_attesa' finché l'autista
-- non la accetta: l'ordine cronologico di `created_at` è quello con cui
-- l'autista le vede e le decide, dalla prima richiesta all'ultima.
create table public.partecipazioni (
  viaggio_id uuid not null references public.viaggi (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stato text not null default 'confermata'
    check (stato in ('in_attesa', 'confermata', 'rifiutata')),
  created_at timestamptz not null default now(),
  primary key (viaggio_id, user_id)
);

create index partecipazioni_user_idx on public.partecipazioni (user_id);
create index partecipazioni_ordine_idx on public.partecipazioni (viaggio_id, created_at);

-- ----------------------------------------------------------------------------
-- notifiche
-- ----------------------------------------------------------------------------
create table public.notifiche (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  titolo text not null,
  corpo text,
  link text,
  letta boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifiche_user_idx on public.notifiche (user_id, letta);

-- ----------------------------------------------------------------------------
-- push_subscriptions
-- ----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
