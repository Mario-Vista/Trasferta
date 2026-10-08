import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Proposta {
  id: string
  evento_id: string
  created_at: string
  proponente: { id: string; nome: string; avatar_url: string | null }
  evento: { id: string; nome: string; data: string; luogo: string }
}

const SELECT = `
  id, evento_id, created_at,
  proponente:profiles!viaggi_proposto_da_fkey(id, nome, avatar_url),
  evento:eventi!viaggi_evento_id_fkey(id, nome, data, luogo)
`

export function useProposteList() {
  const [proposte, setProposte] = useState<Proposta[] | null>(null)

  const carica = useCallback(async () => {
    const { data } = await supabase
      .from('viaggi')
      .select(SELECT)
      .eq('tipo', 'auto')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: true })
    setProposte((data ?? []) as unknown as Proposta[])
  }, [])

  useEffect(() => {
    carica()
    const canale = supabase
      .channel('proposte-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viaggi' }, carica)
      .subscribe()
    return () => {
      supabase.removeChannel(canale)
    }
  }, [carica])

  return { proposte, ricarica: carica }
}
