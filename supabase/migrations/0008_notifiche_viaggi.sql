-- ============================================================================
-- Trasferta — 0008_notifiche_viaggi.sql
-- Copertura notifiche più completa sui viaggi, più la possibilità vera e
-- propria di togliere un viaggio (prima non esisteva alcuna azione per
-- farlo, il vecchio trigger trg_notifica_auto_annullata non scattava mai):
--  1. elimina_viaggio(): un'unica RPC che decide da sola cosa fare —
--     se nessuno è ancora confermato a bordo, elimina del tutto la riga
--     (correggere un viaggio aggiunto per sbaglio non deve disturbare
--     nessuno); se qualcuno è già confermato, invece lo annulla (stato =
--     'annullato') e lo notifica, perché contava su quel viaggio.
--  2. notifica_viaggio_annullato: generalizzata a tutti i mezzi (non solo
--     auto) e collegata alla RPC qui sopra.
--  3. notifica_nuovo_viaggio_su_evento: avviso quando viene aggiunto un
--     nuovo modo per arrivare a un evento che ne aveva già almeno uno
--     (il primo viaggio di un evento appena creato resta coperto solo da
--     trg_notifica_nuovo_evento, per non mandare due notifiche uguali).
-- Le altre richieste dell'utente erano già coperte da codice esistente:
--  - "auto piena" → già in accetta_passeggero() (0003_rpc.sql).
--  - "richiesta di posto" → già in prenota() (0003_rpc.sql).
--  - accettazione/rifiuto richiesta → già in accetta_passeggero() /
--    rifiuta_passeggero() (0003_rpc.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. elimina_viaggio(viaggio_id): l'autista (per l'auto), chi ha proposto il
-- viaggio (per treno/pullman/aereo, o una propria proposta auto ancora in
-- attesa) o un admin lo toglie. Nessun passeggero confermato → elimina la
-- riga del tutto (anche una proposta auto 'in_attesa' rientra qui, prima
-- non c'era modo per chi l'ha proposta di ritirarla); se però a toglierlo è
-- un admin e non chi l'aveva proposto, quest'ultimo viene comunque avvisato
-- (altrimenti scoprirebbe in silenzio che il suo viaggio è sparito).
-- Qualcuno già confermato a bordo → lo annulla e lo notifica (trigger sotto).
-- ----------------------------------------------------------------------------
create or replace function public.elimina_viaggio(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
  v_confermati int;
begin
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null then
    raise exception 'Viaggio non trovato.';
  end if;

  if coalesce(v_viaggio.autista_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
     and v_viaggio.proposto_da <> auth.uid()
     and not public.is_admin()
  then
    raise exception 'Non puoi eliminare questo viaggio.';
  end if;

  select count(*) into v_confermati
  from public.partecipazioni where viaggio_id = p_viaggio_id and stato = 'confermata';

  if v_confermati > 0 then
    if v_viaggio.stato <> 'confermato' then
      raise exception 'Questo viaggio non è confermato.';
    end if;
    update public.viaggi set stato = 'annullato' where id = p_viaggio_id;
  else
    if auth.uid() <> v_viaggio.proposto_da then
      select * into v_evento from public.eventi where id = v_viaggio.evento_id;
      insert into public.notifiche (user_id, tipo, titolo, corpo, link)
      values (
        v_viaggio.proposto_da, 'viaggio_eliminato', 'Viaggio rimosso',
        'Un admin ha rimosso il tuo viaggio per ' || v_evento.nome,
        '/evento/' || v_evento.id
      );
    end if;
    delete from public.viaggi where id = p_viaggio_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- elimina_evento(evento_id): stessa logica "intelligente" di elimina_viaggio.
-- Chi ha creato l'evento o un admin lo toglie. Se nessuno è ancora
-- confermato su nessuno dei suoi viaggi (nessuno contava davvero sull'
-- evento) lo elimina del tutto: viaggi, partecipazioni e voti collegati se
-- ne vanno da soli (foreign key "on delete cascade", vedi 0001_schema.sql).
-- Se invece qualcuno è già confermato, l'evento viene annullato (non
-- eliminato: resta visibile con il badge "Evento annullato") e tutti i suoi
-- viaggi vengono annullati con lui, con un'unica notifica collettiva
-- "evento annullato" invece delle singole notifiche per-viaggio (sarebbe
-- stato rumoroso riceverne una per ogni viaggio più quella dell'evento):
-- set_config qui sotto le mette in pausa solo per questa transazione.
-- ----------------------------------------------------------------------------
create or replace function public.elimina_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
  v_confermati int;
begin
  select * into v_evento from public.eventi where id = p_evento_id for update;

  if v_evento.id is null then
    raise exception 'Evento non trovato.';
  end if;

  if v_evento.creato_da <> auth.uid() and not public.is_admin() then
    raise exception 'Solo chi ha creato l''evento o un admin può eliminarlo.';
  end if;

  select count(*) into v_confermati
  from public.partecipazioni p
  join public.viaggi v on v.id = p.viaggio_id
  where v.evento_id = p_evento_id and p.stato = 'confermata';

  if v_confermati > 0 then
    perform set_config('trasferta.sopprimi_notifica_viaggio', 'true', true);

    update public.viaggi set stato = 'annullato'
    where evento_id = p_evento_id and stato <> 'annullato';

    update public.eventi set stato = 'annullato' where id = p_evento_id;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.id, 'evento_annullato', 'Evento annullato: ' || v_evento.nome,
           'La trasferta del ' || to_char(v_evento.data, 'DD/MM') || ' a ' || v_evento.luogo || ' è stata annullata',
           '/evento/' || v_evento.id
    from public.profiles p
    where p.ruolo <> 'in_attesa' and p.id <> auth.uid();
  else
    if auth.uid() <> v_evento.creato_da then
      insert into public.notifiche (user_id, tipo, titolo, corpo, link)
      values (
        v_evento.creato_da, 'evento_eliminato', 'Evento rimosso',
        'Un admin ha rimosso il tuo evento "' || v_evento.nome || '"',
        '/'
      );
    end if;
    delete from public.eventi where id = p_evento_id;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Viaggio annullato (qualunque mezzo) → notifica a chi era confermato a
-- bordo e a chi l'aveva proposto (per treno/pullman/aereo il proponente non
-- ha una riga in partecipazioni, va notificato comunque). Chi lo sta
-- annullando non si autonotifica.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_notifica_auto_annullata on public.viaggi;
drop function if exists public.notifica_auto_annullata();

create or replace function public.notifica_viaggio_annullato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
begin
  if old.stato = 'confermato' and new.stato = 'annullato'
     and coalesce(current_setting('trasferta.sopprimi_notifica_viaggio', true), 'false') <> 'true'
  then
    select * into v_evento from public.eventi where id = new.evento_id;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select distinct u.user_id, 'viaggio_annullato', 'Viaggio annullato',
           'Un viaggio per ' || v_evento.nome || ' è stato annullato, controlla come arrivare',
           '/evento/' || v_evento.id
    from (
      select user_id from public.partecipazioni
      where viaggio_id = new.id and stato = 'confermata'
      union
      select new.proposto_da
    ) u
    where u.user_id <> auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_notifica_viaggio_annullato
  after update on public.viaggi
  for each row execute function public.notifica_viaggio_annullato();

-- ----------------------------------------------------------------------------
-- 3. Nuovo viaggio confermato aggiunto a un evento che ne aveva già almeno
-- un altro → notifica a tutti gli approvati (tranne chi l'ha aggiunto).
-- ----------------------------------------------------------------------------
create or replace function public.notifica_nuovo_viaggio_su_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
  v_altri_viaggi int;
begin
  if new.stato = 'confermato' then
    select count(*) into v_altri_viaggi
    from public.viaggi
    where evento_id = new.evento_id and id <> new.id;

    if v_altri_viaggi > 0 then
      select * into v_evento from public.eventi where id = new.evento_id;

      insert into public.notifiche (user_id, tipo, titolo, corpo, link)
      select p.id, 'nuovo_viaggio', 'Nuovo modo per arrivare: ' || v_evento.nome,
             'È stato aggiunto un nuovo viaggio per ' || v_evento.nome,
             '/evento/' || v_evento.id
      from public.profiles p
      where p.ruolo <> 'in_attesa'
        and p.id <> new.proposto_da
        and (new.autista_id is null or p.id <> new.autista_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notifica_nuovo_viaggio_su_evento
  after insert on public.viaggi
  for each row execute function public.notifica_nuovo_viaggio_su_evento();
