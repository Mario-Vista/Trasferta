-- ============================================================================
-- Trasferta — 0007_realtime.sql
-- Creare una tabella via SQL (come fanno queste migration) non la aggiunge
-- automaticamente al canale Realtime di Supabase: va fatto esplicitamente,
-- tabella per tabella, altrimenti le sottoscrizioni `.channel(...).on(
-- 'postgres_changes', ...)` nel frontend (useProfilo, useEventi, useEvento,
-- useNotifiche*, useProposte*, useUtenti) non ricevono mai nulla e l'unico
-- modo per vedere un aggiornamento resta ricaricare la pagina a mano.
-- ============================================================================

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.eventi;
alter publication supabase_realtime add table public.viaggi;
alter publication supabase_realtime add table public.partecipazioni;
alter publication supabase_realtime add table public.notifiche;
alter publication supabase_realtime add table public.voti_evento;

-- Nota: push_subscriptions e google_drive_tokens restano fuori di proposito,
-- nessuna UI li ascolta in realtime.
