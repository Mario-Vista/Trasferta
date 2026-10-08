-- ============================================================================
-- Trasferta — 0012_realtime_delete_fix.sql
-- Un DELETE non arriva via Realtime quando il frontend è sottoscritto con un
-- filtro su una colonna che non fa parte della chiave primaria: di default
-- (REPLICA IDENTITY DEFAULT) Postgres include nella "vecchia riga" di un
-- DELETE solo le colonne della chiave primaria, quindi Supabase Realtime non
-- riesce a valutare un filtro su un'altra colonna e scarta l'evento in
-- silenzio (l'INSERT e l'UPDATE non hanno questo problema: mandano sempre
-- la riga intera).
--
-- Caso reale (quello che hai notato): eliminare del tutto un viaggio
-- (elimina_viaggio(), quando nessuno è ancora confermato) è un DELETE sulla
-- tabella viaggi, ma in useEvento.ts quella sottoscrizione è filtrata su
-- evento_id — che non è la chiave primaria di viaggi (lo è id) — quindi chi
-- guardava la pagina non vedeva sparire il viaggio senza ricaricare a mano.
--
-- Stessa causa, non ancora manifestata: notifiche è filtrata su user_id
-- (non sulla sua chiave primaria id) in useNotificheList.ts/useNotifiche.ts.
-- Oggi non si cancella mai una notifica quindi non si è ancora visto, ma se
-- un giorno si aggiungerà, sarebbe rotto allo stesso identico modo.
--
-- La correzione: con REPLICA IDENTITY FULL, Postgres include SEMPRE tutte
-- le colonne nella vecchia riga di un DELETE/UPDATE, qualunque sia il
-- filtro usato lato frontend. Per una tabella di queste dimensioni (poche
-- centinaia di righe in tutto) il costo in più di WAL è irrilevante.
-- ============================================================================

alter table public.viaggi replica identity full;
alter table public.notifiche replica identity full;
