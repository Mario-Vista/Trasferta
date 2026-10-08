-- ============================================================================
-- Trasferta — 0013_annulla_vs_elimina_evento.sql
-- Prima elimina_evento() decideva da sola se eliminare del tutto l'evento o
-- solo annullarlo, in base a chi era già confermato su un suo viaggio — e
-- chiunque potesse "eliminarlo" (chi l'aveva creato, o un admin) poteva
-- finire per cancellarlo per sempre senza nemmeno accorgersene, semplicemente
-- perché nessuno aveva ancora confermato nulla.
--
-- Ora le due azioni sono separate, con permessi diversi:
--   - elimina_evento(): sempre e solo ANNULLA (resta visibile, badge rosso
--     "Annullato", tutti vengono avvisati) — disponibile a chi ha creato
--     l'evento o a un admin. Non elimina più nulla per davvero.
--   - elimina_evento_definitivo(): elimina per sempre, senza lasciare
--     traccia — riservata solo agli admin.
-- ============================================================================

create or replace function public.elimina_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
begin
  select * into v_evento from public.eventi where id = p_evento_id for update;

  if v_evento.id is null then
    raise exception 'Evento non trovato.';
  end if;

  if v_evento.creato_da <> auth.uid() and not public.is_admin() then
    raise exception 'Solo chi ha creato l''evento o un admin può annullarlo.';
  end if;

  -- Annulla con lui tutti i suoi viaggi, con un'unica notifica collettiva
  -- "evento annullato" invece delle singole notifiche per-viaggio (il
  -- trigger notifica_viaggio_annullato() viene messo in pausa per questa
  -- transazione, altrimenti sarebbe rumoroso riceverne una per ogni viaggio
  -- più quella dell'evento).
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
end;
$$;

-- ----------------------------------------------------------------------------
-- elimina_evento_definitivo(evento_id): solo un admin. Elimina per sempre,
-- viaggi/partecipazioni/voti collegati spariscono da soli (foreign key
-- "on delete cascade", vedi 0001_schema.sql). Nessun controllo su chi è già
-- confermato: è una scelta esplicita e irreversibile di un admin, non più
-- una decisione automatica presa dall'app.
-- ----------------------------------------------------------------------------
create or replace function public.elimina_evento_definitivo(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento public.eventi%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo un admin può eliminare definitivamente un evento.';
  end if;

  select * into v_evento from public.eventi where id = p_evento_id for update;

  if v_evento.id is null then
    raise exception 'Evento non trovato.';
  end if;

  if auth.uid() <> v_evento.creato_da then
    insert into public.notifiche (user_id, tipo, titolo, corpo, link)
    values (
      v_evento.creato_da, 'evento_eliminato', 'Evento rimosso',
      'Un admin ha rimosso definitivamente il tuo evento "' || v_evento.nome || '"',
      '/'
    );
  end if;

  delete from public.eventi where id = p_evento_id;
end;
$$;
