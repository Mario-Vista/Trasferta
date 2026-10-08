import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventoConMedia } from '@/lib/database.types'
import { eventoPassato } from '@/lib/format'

/** Elenco eventi (prossimi o passati), con media stelle, aggiornato in tempo reale. */
export function useEventi(periodo: 'prossimi' | 'passati') {
  const [eventi, setEventi] = useState<EventoConMedia[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function carica() {
    const { data, error } = await supabase
      .from('eventi_con_media')
      .select('*')
      .order('data', { ascending: periodo === 'prossimi' })

    if (error) {
      setErrore(error.message)
      return
    }

    const filtrati = (data ?? []).filter((e) =>
      periodo === 'prossimi' ? !eventoPassato(e.data) : eventoPassato(e.data)
    )
    setEventi(filtrati)
  }

  useEffect(() => {
    carica()
    const canale = supabase
      .channel(`eventi-${periodo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventi' }, () => carica())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viaggi' }, () => carica())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voti_evento' }, () => carica())
      .subscribe()
    return () => {
      supabase.removeChannel(canale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  return { eventi, errore }
}

/** Cerca eventi per nome o data, per evitare doppioni in fase di creazione. */
export async function cercaEventiSimili(nome: string, data: string | null) {
  let query = supabase.from('eventi').select('id, nome, data, luogo').order('data')

  if (nome.trim().length >= 2 && data) {
    query = query.or(`nome.ilike.%${nome.trim()}%,data.eq.${data}`)
  } else if (nome.trim().length >= 2) {
    query = query.ilike('nome', `%${nome.trim()}%`)
  } else if (data) {
    query = query.eq('data', data)
  } else {
    return []
  }

  const { data: righe, error } = await query.limit(5)
  if (error) return []
  return righe ?? []
}
