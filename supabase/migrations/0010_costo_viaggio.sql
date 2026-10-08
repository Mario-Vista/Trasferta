-- ============================================================================
-- Trasferta — 0010_costo_viaggio.sql
-- Un solo campo "costo totale viaggio" per l'auto, al posto dei due separati
-- benzina/casello (che si sommavano comunque sempre insieme in ViaggioCard
-- per calcolare la quota a testa, due campi non servivano a niente).
-- ============================================================================

alter table public.viaggi add column if not exists costo_viaggio numeric;

update public.viaggi
set costo_viaggio = coalesce(costo_carburante, 0) + coalesce(costo_pedaggio, 0)
where tipo = 'auto' and (costo_carburante is not null or costo_pedaggio is not null);

alter table public.viaggi drop column if exists costo_carburante;
alter table public.viaggi drop column if exists costo_pedaggio;
