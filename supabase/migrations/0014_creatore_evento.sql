-- ============================================================================
-- Trasferta — 0014_creatore_evento.sql
-- La pagina di dettaglio evento non mostra da nessuna parte chi ha creato
-- l'evento (solo i viaggi mostrano il loro proponente/autista). Si ricrea
-- eventi_con_media (0001_schema.sql, poi 0005_drive.sql) aggiungendo un LEFT
-- JOIN su profiles per esporre nome e avatar del creatore.
-- ============================================================================

drop view if exists public.eventi_con_media;

create view public.eventi_con_media as
select
  e.*,
  coalesce(round(avg(v.stelle)::numeric * 2) / 2, 0) as media_stelle,
  count(v.stelle) as numero_voti,
  creatore.nome as creatore_nome,
  creatore.avatar_url as creatore_avatar_url
from public.eventi e
left join public.voti_evento v on v.evento_id = e.id
left join public.profiles creatore on creatore.id = e.creato_da
group by e.id, creatore.nome, creatore.avatar_url;
