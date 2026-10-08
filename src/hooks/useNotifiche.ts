import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/** Conta le notifiche non lette dell'utente corrente, aggiornato in tempo reale. */
export function useNotificheNonLette(): number {
  const { user } = useAuth()
  const [conteggio, setConteggio] = useState(0)

  useEffect(() => {
    if (!user) {
      setConteggio(0)
      return
    }

    let attivo = true

    async function carica() {
      const { count } = await supabase
        .from('notifiche')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('letta', false)
      if (attivo) setConteggio(count ?? 0)
    }

    carica()

    const canale = supabase
      .channel(`notifiche-badge-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifiche', filter: `user_id=eq.${user.id}` },
        () => carica()
      )
      .subscribe()

    return () => {
      attivo = false
      supabase.removeChannel(canale)
    }
  }, [user?.id])

  return conteggio
}
