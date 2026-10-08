-- ============================================================================
-- Trasferta — 0003_rpc.sql
-- RPC security definer: prenota, lascia, approva_proposta, rifiuta_proposta,
-- imposta_ruolo. Tutte le scritture su partecipazioni/ruolo passano da qui.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- prenota(viaggio_id): l'utente corrente chiede un posto su un viaggio.
-- Auto → resta 'in_attesa' finché l'autista non accetta (vedi
-- accetta_passeggero/rifiuta_passeggero). Treno/pullman/aereo → 'confermata'
-- subito, nessun limite di posti.
-- ----------------------------------------------------------------------------
create or replace function public.prenota(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
  v_posti_occupati int;
  v_gia_in_evento boolean;
  v_stato_richiesta text;
begin
  if not public.is_approvato() then
    raise exception 'Non sei abilitato a prenotarti.';
  end if;

  -- Lock sulla riga del viaggio per evitare race condition sull'ultimo posto.
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null then
    raise exception 'Viaggio non trovato.';
  end if;

  if v_viaggio.stato <> 'confermato' then
    raise exception 'Questo viaggio non è ancora confermato.';
  end if;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id;

  if v_evento.data < current_date then
    raise exception 'Questo evento è già passato.';
  end if;

  if v_viaggio.autista_id = auth.uid() then
    raise exception 'Sei già l''autista di questo viaggio.';
  end if;

  -- Un solo viaggio per evento a persona (come passeggero, anche in attesa
  -- di accettazione, o come autista).
  select exists (
    select 1 from public.partecipazioni p
    join public.viaggi vi on vi.id = p.viaggio_id
    where p.user_id = auth.uid() and vi.evento_id = v_viaggio.evento_id
      and p.stato in ('in_attesa', 'confermata')
  ) or exists (
    select 1 from public.viaggi vi
    where vi.evento_id = v_viaggio.evento_id and vi.autista_id = auth.uid() and vi.stato <> 'annullato'
  ) into v_gia_in_evento;

  if v_gia_in_evento then
    raise exception 'Sei già in un viaggio per questo evento.';
  end if;

  if v_viaggio.tipo = 'auto' then
    select count(*) into v_posti_occupati
    from public.partecipazioni where viaggio_id = p_viaggio_id and stato = 'confermata';

    if v_posti_occupati >= v_viaggio.posti_passeggeri then
      raise exception 'Auto piena.';
    end if;
    v_stato_richiesta := 'in_attesa';
  else
    v_stato_richiesta := 'confermata';
  end if;

  insert into public.partecipazioni (viaggio_id, user_id, stato)
  values (p_viaggio_id, auth.uid(), v_stato_richiesta);

  if v_viaggio.tipo = 'auto' and v_viaggio.autista_id is not null then
    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    values (
      v_viaggio.autista_id,
      'richiesta_posto',
      'Nuova richiesta di posto',
      'Qualcuno vuole salire sulla tua auto per ' || v_evento.nome,
      '/evento/' || v_evento.id
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- lascia(viaggio_id): l'utente corrente esce da un viaggio (o ritira la
-- propria richiesta, se era ancora in attesa).
-- ----------------------------------------------------------------------------
create or replace function public.lascia(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.viaggi where id = p_viaggio_id for update;

  delete from public.partecipazioni
  where viaggio_id = p_viaggio_id and user_id = auth.uid();

  if not found then
    raise exception 'Non eri prenotato su questo viaggio.';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- accetta_passeggero(viaggio_id, user_id): l'autista accetta una richiesta
-- di posto in auto, in qualunque ordine gliela mostri la UI (che le elenca
-- dalla prima richiesta cronologicamente all'ultima).
-- ----------------------------------------------------------------------------
create or replace function public.accetta_passeggero(p_viaggio_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
  v_posti_occupati int;
begin
  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null or v_viaggio.tipo <> 'auto' then
    raise exception 'Viaggio non valido.';
  end if;

  if v_viaggio.autista_id <> auth.uid() and not public.is_admin() then
    raise exception 'Solo l''autista può accettare un passeggero.';
  end if;

  if not exists (
    select 1 from public.partecipazioni
    where viaggio_id = p_viaggio_id and user_id = p_user_id and stato = 'in_attesa'
  ) then
    raise exception 'Questa richiesta non è più in attesa.';
  end if;

  select count(*) into v_posti_occupati
  from public.partecipazioni where viaggio_id = p_viaggio_id and stato = 'confermata';

  if v_posti_occupati >= v_viaggio.posti_passeggeri then
    raise exception 'Auto piena.';
  end if;

  update public.partecipazioni set stato = 'confermata'
  where viaggio_id = p_viaggio_id and user_id = p_user_id;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id;

  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  values (
    p_user_id, 'posto_confermato', 'Posto confermato',
    'Sei confermato in auto per ' || v_evento.nome,
    '/evento/' || v_evento.id
  );

  select count(*) into v_posti_occupati
  from public.partecipazioni where viaggio_id = p_viaggio_id and stato = 'confermata';

  if v_posti_occupati = v_viaggio.posti_passeggeri then
    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    values (
      v_viaggio.autista_id, 'auto_piena', 'Auto piena',
      'La tua auto per ' || v_evento.nome || ' è piena',
      '/evento/' || v_evento.id
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- rifiuta_passeggero(viaggio_id, user_id): l'autista rifiuta una richiesta.
-- ----------------------------------------------------------------------------
create or replace function public.rifiuta_passeggero(p_viaggio_id uuid, p_user_id uuid)
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
    raise exception 'Solo l''autista può rifiutare un passeggero.';
  end if;

  delete from public.partecipazioni
  where viaggio_id = p_viaggio_id and user_id = p_user_id and stato = 'in_attesa';

  if not found then
    raise exception 'Questa richiesta non è più in attesa.';
  end if;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id;

  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  values (
    p_user_id, 'posto_rifiutato', 'Richiesta non accettata',
    'Il posto in auto per ' || v_evento.nome || ' è stato dato a qualcun altro',
    '/evento/' || v_evento.id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- approva_proposta(viaggio_id): un autista approva una proposta/richiesta auto.
-- ----------------------------------------------------------------------------
create or replace function public.approva_proposta(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
begin
  if not public.is_autista() then
    raise exception 'Solo un autista può approvare una proposta.';
  end if;

  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null or v_viaggio.tipo <> 'auto' or v_viaggio.stato <> 'in_attesa' then
    raise exception 'Questa proposta non è più disponibile.';
  end if;

  update public.viaggi
  set autista_id = auth.uid(), stato = 'confermato'
  where id = p_viaggio_id;

  -- Il proponente (se diverso dall'autista) viene prenotato automaticamente.
  if v_viaggio.proposto_da <> auth.uid() then
    insert into public.partecipazioni (viaggio_id, user_id)
    values (p_viaggio_id, v_viaggio.proposto_da)
    on conflict do nothing;
  end if;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id for update;

  if v_evento.stato = 'proposto' then
    update public.eventi set stato = 'attivo' where id = v_evento.id;

    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    select p.id, 'nuovo_evento', 'Nuova trasferta: ' || v_evento.nome,
           to_char(v_evento.data, 'DD/MM') || ' — ' || v_evento.luogo,
           '/evento/' || v_evento.id
    from public.profiles p
    where p.ruolo <> 'in_attesa' and p.id <> v_evento.creato_da;
  end if;

  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  values (
    v_viaggio.proposto_da,
    'proposta_approvata',
    'Si parte!',
    'Guidi tu per ' || v_evento.nome || ', sei dentro',
    '/evento/' || v_evento.id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- rifiuta_proposta(viaggio_id): un autista rifiuta una proposta/richiesta auto.
-- ----------------------------------------------------------------------------
create or replace function public.rifiuta_proposta(p_viaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viaggio public.viaggi%rowtype;
  v_evento public.eventi%rowtype;
  v_altri_viaggi int;
begin
  if not public.is_autista() then
    raise exception 'Solo un autista può rifiutare una proposta.';
  end if;

  select * into v_viaggio from public.viaggi where id = p_viaggio_id for update;

  if v_viaggio.id is null or v_viaggio.tipo <> 'auto' or v_viaggio.stato <> 'in_attesa' then
    raise exception 'Questa proposta non è più disponibile.';
  end if;

  update public.viaggi set stato = 'annullato' where id = p_viaggio_id;

  select * into v_evento from public.eventi where id = v_viaggio.evento_id for update;

  if v_evento.stato = 'proposto' then
    select count(*) into v_altri_viaggi
    from public.viaggi
    where evento_id = v_evento.id and stato <> 'annullato';

    if v_altri_viaggi = 0 then
      update public.eventi set stato = 'annullato' where id = v_evento.id;
    end if;
  end if;

  insert into public.notifiche (user_id, tipo, titolo, corpo, link)
  values (
    v_viaggio.proposto_da,
    'proposta_rifiutata',
    'Proposta rifiutata',
    'Nessun autista disponibile per ora per ' || v_evento.nome,
    '/evento/' || v_evento.id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- imposta_ruolo(user_id, ruolo): solo admin, assegna un ruolo a un utente.
-- ----------------------------------------------------------------------------
create or replace function public.imposta_ruolo(p_user_id uuid, p_ruolo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''admin può cambiare i ruoli.';
  end if;

  if p_ruolo not in ('in_attesa', 'passeggero', 'autista', 'admin') then
    raise exception 'Ruolo non valido.';
  end if;

  update public.profiles set ruolo = p_ruolo where id = p_user_id;
end;
$$;
