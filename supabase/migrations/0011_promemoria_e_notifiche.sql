-- ============================================================================
-- Trasferta — 0011_promemoria_e_notifiche.sql
-- Tre cose emerse da un'analisi completa dell'app:
--  1. lascia(): chi era confermato su un'auto e se ne tira fuori avvisa
--     l'autista (prima lascia() cancellava la prenotazione senza dirlo a
--     nessuno).
--  2. imposta_ruolo(): chi viene abilitato (o il cui ruolo cambia) ora lo
--     sa — prima un "in_attesa" appena approvato non aveva alcun modo di
--     scoprirlo se non riaprendo l'app a caso.
--  3. Promemoria automatico 4 giorni prima di ogni evento a chi è
--     confermato su un viaggio (passeggeri e autisti), via pg_cron: è
--     l'unica notifica dell'app che non parte da un'azione di qualcuno,
--     quindi serve un lavoro schedulato invece di un trigger.
--  4. rimuovi_passeggero(): un passeggero confermato può togliersi da solo
--     (punto 1), ma mancava il contrario — l'autista non poteva togliere un
--     passeggero già confermato (solo una richiesta ancora in attesa, con
--     rifiuta_passeggero in 0003_rpc.sql). Notifica chi viene tolto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lascia(viaggio_id): invariata nei permessi, in più notifica l'autista
-- quando chi esce era confermato su un'auto.
-- ----------------------------------------------------------------------------
create or replace function public.lascia(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_partecipazione public.partecipazioni%rowtype;
  v_evento public.eventi%rowtype;
  v_nome text;
begin
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  select * into v_partecipazione from public.partecipazioni
  where viaggio_id = p_viaggio_id and user_id = auth.uid();

  delete from public.partecipazioni
  where viaggio_id = p_viaggio_id and user_id = auth.uid();

  if not found then
    raise exception 'Non eri prenotato su questo viaggio.';
  end if;

  if v_viaggio.tipo = 'auto'
     and v_viaggio.autista_id is not null
     and v_partecipazione.stato = 'confermata'
  then
    select * into v_evento from public.eventi where id = v_viaggio.evento_id;
    select nome into v_nome from public.profiles where id = auth.uid();

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    values (
      v_viaggio.autista_id,
      'passeggero_ha_lasciato',
      'Un posto si è liberato',
      coalesce(v_nome, 'Qualcuno') || ' non viene più con te per ' || v_evento.nome,
      '/evento/' || v_evento.id
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. imposta_ruolo(user_id, ruolo): invariata nei permessi, in più notifica
-- l'utente quando il suo ruolo cambia davvero (non quando l'admin "cambia"
-- allo stesso ruolo che aveva già).
-- ----------------------------------------------------------------------------
create or replace function public.imposta_ruolo(p_user_id uuid, p_ruolo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruolo_precedente text;
  v_titolo text;
  v_corpo text;
begin
  if not public.is_admin() then
    raise exception 'Solo l''admin può cambiare i ruoli.';
  end if;

  if p_ruolo not in ('in_attesa', 'passeggero', 'autista', 'admin') then
    raise exception 'Ruolo non valido.';
  end if;

  select ruolo into v_ruolo_precedente from public.profiles where id = p_user_id;

  update public.profiles set ruolo = p_ruolo where id = p_user_id;

  if v_ruolo_precedente is distinct from p_ruolo then
    v_titolo := case p_ruolo
      when 'passeggero' then 'Sei stato abilitato!'
      when 'autista' then 'Ora sei autista'
      when 'admin' then 'Ora sei admin'
      else 'Il tuo accesso è stato sospeso'
    end;
    v_corpo := case p_ruolo
      when 'passeggero' then 'Puoi prenotarti per le trasferte.'
      when 'autista' then 'Puoi proporre la tua auto per le trasferte.'
      when 'admin' then 'Puoi gestire utenti ed eventi.'
      else 'Un admin ha rimesso il tuo account in attesa.'
    end;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    values (p_user_id, 'ruolo_cambiato', v_titolo, v_corpo, '/profilo');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Promemoria 4 giorni prima dell'evento, a chi è confermato (passeggeri e
-- autisti) su un viaggio. Richiede l'estensione pg_cron (gratuita, va
-- abilitata una volta sola: lo fa già la riga qui sotto via SQL Editor,
-- nessun passaggio da dashboard necessario, come per pg_net).
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.eventi add column if not exists promemoria_inviato boolean not null default false;

create or replace function public.invia_promemoria_eventi()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento record;
begin
  for v_evento in
    select * from public.eventi
    where stato = 'attivo' and data = current_date + 4 and not promemoria_inviato
  loop
    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select destinatari.user_id, 'promemoria_evento', 'Tra 4 giorni: ' || v_evento.nome,
           to_char(v_evento.data, 'DD/MM') || ' — ' || v_evento.luogo,
           '/evento/' || v_evento.id
    from (
      select p.user_id
      from public.partecipazioni p
      join public.viaggi v on v.id = p.viaggio_id
      where v.evento_id = v_evento.id and p.stato = 'confermata'
      union
      select v.autista_id
      from public.viaggi v
      where v.evento_id = v_evento.id and v.autista_id is not null and v.stato = 'confermato'
    ) destinatari;

    update public.eventi set promemoria_inviato = true where id = v_evento.id;
  end loop;
end;
$$;

-- "0 7 * * *" = ogni giorno alle 7:00 UTC (le 8-9 del mattino in Italia, a
-- seconda dell'ora legale): non è l'unico orario possibile, ma è mattina
-- presto per tutti e non richiede di gestire il cambio ora legale/solare.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'trasferta_promemoria_eventi') then
    perform cron.unschedule('trasferta_promemoria_eventi');
  end if;
end $$;

select cron.schedule(
  'trasferta_promemoria_eventi',
  '0 7 * * *',
  $$select public.invia_promemoria_eventi();$$
);

-- ----------------------------------------------------------------------------
-- 4. rimuovi_passeggero(viaggio_id, user_id): l'autista (o un admin) toglie
-- un passeggero già confermato (non solo in attesa, quello è già coperto da
-- rifiuta_passeggero). Il posto torna libero, il passeggero viene avvisato.
-- ----------------------------------------------------------------------------
create or replace function public.rimuovi_passeggero(p_viaggio_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
begin
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null or v_viaggio.tipo <> 'auto' then
    raise exception 'Viaggio non valido.';
  end if;

  if v_viaggio.autista_id <> auth.uid() and not public.is_admin() then
    raise exception 'Solo l''autista può togliere un passeggero.';
  end if;

  delete from public.partecipazioni
  where viaggio_id = p_viaggio_id and user_id = p_user_id and stato = 'confermata';

  if not found then
    raise exception 'Questo passeggero non era confermato.';
  end if;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id;

  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  values (
    p_user_id, 'passeggero_rimosso', 'Sei stato tolto dall''auto',
    'L''autista ti ha tolto dal viaggio per ' || v_evento.nome,
    '/evento/' || v_evento.id
  );
end;
$$;
