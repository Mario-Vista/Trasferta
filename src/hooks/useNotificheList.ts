import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Notifica } from '@/lib/database.types'

export function useNotificheList() {
  const { user } = useAuth()
  const [notifiche, setNotifiche] = useState<Notifica[] | null>(null)

  const carica = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifiche')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifiche(data ?? [])
  }, [user])

  useEffect(() => {
    carica()
    if (!user) return
    const canale = supabase
      .channel(`notifiche-lista-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifiche', filter: `user_id=eq.${user.id}` },
        carica
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canale)
    }
  }, [user, carica])

  async function segnaLetta(id: string) {
    await supabase.from('notifiche').update({ letta: true }).eq('id', id)
  }

  async function segnaTutteLette() {
    if (!user) return
    await supabase.from('notifiche').update({ letta: true }).eq('user_id', user.id).eq('letta', false)
  }

  return { notifiche, segnaLetta, segnaTutteLette }
}
