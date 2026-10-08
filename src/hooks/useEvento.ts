import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventoConMedia, TipoViaggio } from '@/lib/database.types'

export interface PersonaMinima {
  id: string
  nome: string
  avatar_url: string | null
}

export interface PartecipazioneConProfilo {
  user_id: string
  stato: 'in_attesa' | 'confermata' | 'rifiutata'
  created_at: string
  profiles: PersonaMinima
}

export interface ViaggioConDettagli {
  id: string
  evento_id: string
  tipo: TipoViaggio
  stato: 'in_attesa' | 'confermato' | 'annullato'
  autista_id: string | null
  proposto_da: string
  posti_passeggeri: number | null
  ora_partenza: string | null
  partenza: string
  durata_minuti: number | null
  distanza_km: number | null
  durata_calcolata: boolean
  costo_viaggio: number | null
  costo_biglietto: number | null
  link_biglietto: string | null
  note: string | null
  created_at: string
  autista: PersonaMinima | null
  proponente: PersonaMinima
  partecipazioni: PartecipazioneConProfilo[]
}

const SELECT_VIAGGIO = `
  id, evento_id, tipo, stato, autista_id, proposto_da, posti_passeggeri,
  ora_partenza, partenza, durata_minuti, distanza_km, durata_calcolata,
  costo_viaggio, costo_biglietto, link_biglietto, note, created_at,
  autista:profiles!viaggi_autista_id_fkey(id, nome, avatar_url),
  proponente:profiles!viaggi_proposto_da_fkey(id, nome, avatar_url),
  partecipazioni(user_id, stato, created_at, profiles(id, nome, avatar_url))
`

export function useEvento(eventoId: string | undefined) {
  const [evento, setEvento] = useState<EventoConMedia | null>(null)
  const [viaggi, setViaggi] = useState<ViaggioConDettagli[] | null>(null)
  const [erroreNonTrovato, setErroreNonTrovato] = useState(false)
  const [caricamento, setCaricamento] = useState(true)

  const carica = useCallback(async () => {
    if (!eventoId) return

    const [{ data: ev, error: errEv }, { data: vi, error: errVi }] = await Promise.all([
      supabase.from('eventi_con_media').select('*').eq('id', eventoId).maybeSingle(),
      supabase
        .from('viaggi')
        .select(SELECT_VIAGGIO)
        .eq('evento_id', eventoId)
        .neq('stato', 'annullato')
        .order('created_at', { ascending: true }),
    ])

    if (errEv || !ev) {
      setErroreNonTrovato(true)
      setCaricamento(false)
      return
    }

    setEvento(ev)

    if (!errVi && vi) {
      // Le richieste (partecipazioni) di ogni viaggio in ordine cronologico:
      // dalla prima alla più recente, così l'autista le vede e decide in ordine.
      const viaggiOrdinati = (vi as unknown as ViaggioConDettagli[]).map((v) => ({
        ...v,
        partecipazioni: [...v.partecipazioni].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }))
      setViaggi(viaggiOrdinati)
    }

    setCaricamento(false)
  }, [eventoId])

  useEffect(() => {
    carica()
    if (!eventoId) return

    const canale = supabase
      .channel(`evento-${eventoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventi' }, carica)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'viaggi', filter: `evento_id=eq.${eventoId}` },
        carica
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partecipazioni' }, carica)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voti_evento', filter: `evento_id=eq.${eventoId}` },
        carica
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canale)
    }
  }, [eventoId, carica])

  return { evento, viaggi, caricamento, erroreNonTrovato, ricarica: carica }
}

// ----------------------------------------------------------------------------
// Azioni (wrapper sulle RPC, con messaggi d'errore pronti per la UI)
// ----------------------------------------------------------------------------

export async function prenotaViaggio(viaggioId: string) {
  const { error } = await supabase.rpc('prenota', { p_viaggio_id: viaggioId })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function lasciaViaggio(viaggioId: string) {
  const { error } = await supabase.rpc('lascia', { p_viaggio_id: viaggioId })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function accettaPasseggero(viaggioId: string, userId: string) {
  const { error } = await supabase.rpc('accetta_passeggero', {
    p_viaggio_id: viaggioId,
    p_user_id: userId,
  })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function rifiutaPasseggero(viaggioId: string, userId: string) {
  const { error } = await supabase.rpc('rifiuta_passeggero', {
    p_viaggio_id: viaggioId,
    p_user_id: userId,
  })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function rimuoviPasseggero(viaggioId: string, userId: string) {
  const { error } = await supabase.rpc('rimuovi_passeggero', {
    p_viaggio_id: viaggioId,
    p_user_id: userId,
  })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function eliminaViaggio(viaggioId: string) {
  const { error } = await supabase.rpc('elimina_viaggio', { p_viaggio_id: viaggioId })
  if (error) throw new Error(tradurriErrore(error.message))
}

export async function eliminaEvento(eventoId: string) {
  const { error } = await supabase.rpc('elimina_evento', { p_evento_id: eventoId })
  if (error) throw new Error(tradurriErrore(error.message))
}

function tradurriErrore(messaggio: string): string {
  // I messaggi delle RPC sono già in italiano (vedi 0003_rpc.sql);
  // qui si ripulisce solo un eventuale suffisso tecnico di Postgres.
  return messaggio.replace(/^P[0-9]{4}: /, '')
}
