import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Conta le proposte/richieste auto in attesa di approvazione (solo per autisti/admin). */
export function useProposteInAttesa(abilitato: boolean): number {
  const [conteggio, setConteggio] = useState(0)

  useEffect(() => {
    if (!abilitato) {
      setConteggio(0)
      return
    }

    let attivo = true

    async function carica() {
      const { count } = await supabase
        .from('viaggi')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'auto')
        .eq('stato', 'in_attesa')
      if (attivo) setConteggio(count ?? 0)
    }

    carica()

    const canale = supabase
      .channel('proposte-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viaggi' }, () => carica())
      .subscribe()

    return () => {
      attivo = false
      supabase.removeChannel(canale)
    }
  }, [abilitato])

  return conteggio
}
