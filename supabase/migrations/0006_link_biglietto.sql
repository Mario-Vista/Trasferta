-- ============================================================================
-- Trasferta — 0006_link_biglietto.sql
-- Per i viaggi non in auto (treno/pullman/aereo) si può salvare il link al
-- biglietto acquistato (es. il PDF o la pagina di Trenitalia/FlixBus/volo),
-- utile a chi partecipa per ritrovarlo senza chiedere in chat.
-- ============================================================================

alter table public.viaggi
  add column link_biglietto text;

alter table public.viaggi
  add constraint viaggi_link_biglietto_solo_non_auto check (
    link_biglietto is null or tipo <> 'auto'
  );

comment on column public.viaggi.link_biglietto is
  'Link al biglietto (treno/pullman/aereo), facoltativo. Mai per i viaggi in auto.';
