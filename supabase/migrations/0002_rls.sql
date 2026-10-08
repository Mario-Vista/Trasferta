-- ============================================================================
-- Trasferta — 0002_rls.sql
-- Funzioni helper + Row Level Security su tutte le tabelle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Funzioni helper (security definer per evitare ricorsione nelle policy)
-- ----------------------------------------------------------------------------
create or replace function public.ruolo_corrente()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select ruolo from public.profiles where id = auth.uid();
$$;

create or replace function public.is_approvato()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.ruolo_corrente() in ('passeggero', 'autista', 'admin'), false);
$$;

create or replace function public.is_autista()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.ruolo_corrente() in ('autista', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.ruolo_corrente() = 'admin', false);
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select
  using (auth.uid() = id or public.is_approvato());

create policy profiles_update_self on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and ruolo = (select ruolo from public.profiles where id = auth.uid())
  );

-- Insert riservato al trigger handle_new_user (security definer), nessuna policy di insert pubblica.

-- ----------------------------------------------------------------------------
-- eventi
-- ----------------------------------------------------------------------------
alter table public.eventi enable row level security;

create policy eventi_select on public.eventi
  for select
  using (
    stato in ('attivo', 'annullato')
    or creato_da = auth.uid()
    or public.is_autista()
  );

create policy eventi_insert on public.eventi
  for insert
  with check (public.is_approvato() and creato_da = auth.uid());

create policy eventi_update on public.eventi
  for update
  using (creato_da = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- voti_evento
-- ----------------------------------------------------------------------------
alter table public.voti_evento enable row level security;

create policy voti_select on public.voti_evento
  for select
  using (public.is_approvato());

create policy voti_insert on public.voti_evento
  for insert
  with check (public.is_approvato() and user_id = auth.uid());

create policy voti_update on public.voti_evento
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy voti_delete on public.voti_evento
  for delete
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- viaggi
-- ----------------------------------------------------------------------------
alter table public.viaggi enable row level security;

create policy viaggi_select on public.viaggi
  for select
  using (
    exists (
      select 1 from public.eventi e
      where e.id = viaggi.evento_id
        and (e.stato in ('attivo', 'annullato') or e.creato_da = auth.uid() or public.is_autista())
    )
  );

create policy viaggi_insert on public.viaggi
  for insert
  with check (
    proposto_da = auth.uid()
    and (
      -- auto confermata direttamente: solo un autista, per sé stesso
      (tipo = 'auto' and stato = 'confermato' and public.is_autista() and autista_id = auth.uid())
      -- auto proposta/richiesta, in attesa di approvazione: chiunque sia approvato
      or (tipo = 'auto' and stato = 'in_attesa' and autista_id is null and public.is_approvato())
      -- altri mezzi: chiunque sia approvato
      or (tipo <> 'auto' and public.is_approvato())
    )
  );

create policy viaggi_update on public.viaggi
  for update
  using (
    autista_id = auth.uid()
    or (proposto_da = auth.uid() and tipo <> 'auto')
    or public.is_admin()
    or (tipo = 'auto' and stato = 'in_attesa' and public.is_autista())
  );

-- ----------------------------------------------------------------------------
-- partecipazioni (scrittura solo via RPC security definer)
-- ----------------------------------------------------------------------------
alter table public.partecipazioni enable row level security;

create policy partecipazioni_select on public.partecipazioni
  for select
  using (public.is_approvato());

-- Nessuna policy insert/update/delete: tutte le scritture passano dalle RPC.

-- ----------------------------------------------------------------------------
-- notifiche
-- ----------------------------------------------------------------------------
alter table public.notifiche enable row level security;

create policy notifiche_select on public.notifiche
  for select
  using (user_id = auth.uid());

create policy notifiche_update on public.notifiche
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nessuna policy insert: scrittura solo dai trigger (security definer).

-- ----------------------------------------------------------------------------
-- push_subscriptions
-- ----------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

create policy push_select on public.push_subscriptions
  for select
  using (user_id = auth.uid());

create policy push_insert on public.push_subscriptions
  for insert
  with check (user_id = auth.uid());

create policy push_delete on public.push_subscriptions
  for delete
  using (user_id = auth.uid());
