import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Ruolo } from '@/lib/database.types'

export function useUtenti() {
  const [utenti, setUtenti] = useState<Profile[] | null>(null)

  const carica = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUtenti(data ?? [])
  }, [])

  useEffect(() => {
    carica()
    const canale = supabase
      .channel('utenti-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, carica)
      .subscribe()
    return () => {
      supabase.removeChannel(canale)
    }
  }, [carica])

  async function cambiaRuolo(userId: string, ruolo: Ruolo) {
    const { error } = await supabase.rpc('imposta_ruolo', { p_user_id: userId, p_ruolo: ruolo })
    if (error) throw new Error(error.message)
  }

  // Gli "in_attesa" prima, poi gli altri per data di iscrizione decrescente.
  const ordinati = utenti
    ? [...utenti].sort((a, b) => {
        if (a.ruolo === 'in_attesa' && b.ruolo !== 'in_attesa') return -1
        if (a.ruolo !== 'in_attesa' && b.ruolo === 'in_attesa') return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    : null

  return { utenti: ordinati, cambiaRuolo }
}
