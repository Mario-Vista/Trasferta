-- ============================================================================
-- Trasferta — 0004_notifiche.sql
-- Trigger che scrivono in notifiche. L'insert in notifiche fa poi scattare
-- il Database Webhook → Edge Function invia-push (configurato nel pannello
-- Supabase, vedi README §10.6).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nuovo evento creato direttamente attivo (da autista/admin, o passeggero
-- senza auto) → notifica a tutti gli approvati tranne il creatore.
-- (Il caso "evento approvato da proposto ad attivo" è già gestito dentro
-- approva_proposta, in 0003_rpc.sql, per evitare doppie notifiche.)
-- ----------------------------------------------------------------------------
create or replace function public.notifica_nuovo_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'attivo' then
    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.id, 'nuovo_evento', 'Nuova trasferta: ' || new.nome,
           to_char(new.data, 'DD/MM') || ' — ' || new.luogo,
           '/evento/' || new.id
    from public.profiles p
    where p.ruolo <> 'in_attesa' and p.id <> new.creato_da;
  end if;
  return new;
end;
$$;

create trigger trg_notifica_nuovo_evento
  after insert on public.eventi
  for each row execute function public.notifica_nuovo_evento();

-- ----------------------------------------------------------------------------
-- Proposta/richiesta auto da un passeggero → notifica a tutti gli autisti
-- e all'admin.
-- ----------------------------------------------------------------------------
create or replace function public.notifica_proposta_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
  v_nome_proponente text;
begin
  if new.tipo = 'auto' and new.stato = 'in_attesa' then
    select * into v_evento from public.eventi where id = new.evento_id;
    select nome into v_nome_proponente from public.profiles where id = new.proposto_da;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.id, 'proposta_auto', 'Proposta di trasferta in auto',
           v_nome_proponente || ' propone di andare in auto a ' || v_evento.nome,
           '/proposte'
    from public.profiles p
    where p.ruolo in ('autista', 'admin');
  end if;
  return new;
end;
$$;

create trigger trg_notifica_proposta_auto
  after insert on public.viaggi
  for each row execute function public.notifica_proposta_auto();

-- ----------------------------------------------------------------------------
-- Auto annullata (dall'autista o dall'admin) → notifica ai passeggeri
-- prenotati.
-- ----------------------------------------------------------------------------
create or replace function public.notifica_auto_annullata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
  v_nome_autista text;
begin
  if old.tipo = 'auto' and old.stato = 'confermato' and new.stato = 'annullato' then
    select * into v_evento from public.eventi where id = new.evento_id;
    select nome into v_nome_autista from public.profiles where id = new.autista_id;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.user_id, 'auto_annullata', 'Auto annullata',
           'L''auto di ' || coalesce(v_nome_autista, 'un autista') || ' per ' || v_evento.nome || ' è stata annullata',
           '/evento/' || v_evento.id
    from public.partecipazioni p
    where p.viaggio_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_notifica_auto_annullata
  after update on public.viaggi
  for each row execute function public.notifica_auto_annullata();

-- ----------------------------------------------------------------------------
-- Orario di partenza impostato o cambiato (all'inserimento del viaggio o in
-- un secondo momento) → notifica a tutti i partecipanti già confermati su
-- quel viaggio. Il semplice avviso "aggiungi orario dopo" passa da qui senza
-- bisogno di codice applicativo dedicato: basta un update di ora_partenza.
-- ----------------------------------------------------------------------------
create or replace function public.notifica_orario_partenza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
  v_orario text;
begin
  if new.ora_partenza is not null
     and (old.ora_partenza is null or old.ora_partenza <> new.ora_partenza)
  then
    select * into v_evento from public.eventi where id = new.evento_id;
    v_orario := to_char(new.ora_partenza at time zone 'Europe/Rome', 'HH24:MI');

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.user_id, 'orario_partenza',
           'Orario di partenza: ' || v_orario,
           v_evento.nome || ' — partenza da ' || new.partenza || ' alle ' || v_orario,
           '/evento/' || v_evento.id
    from public.partecipazioni p
    where p.viaggio_id = new.id and p.stato = 'confermata';
  end if;
  return new;
end;
$$;

create trigger trg_notifica_orario_partenza
  after update on public.viaggi
  for each row execute function public.notifica_orario_partenza();

-- ----------------------------------------------------------------------------
-- Nuovo utente registrato → notifica a tutti gli admin.
-- ----------------------------------------------------------------------------
create or replace function public.notifica_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  select p.id, 'nuovo_utente', 'Nuovo utente da abilitare',
         coalesce(nullif(new.nome, ''), new.email) || ' si è appena registrato',
         '/utenti'
  from public.profiles p
  where p.ruolo = 'admin';
  return new;
end;
$$;

create trigger trg_notifica_nuovo_utente
  after insert on public.profiles
  for each row execute function public.notifica_nuovo_utente();
