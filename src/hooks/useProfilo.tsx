import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'
import { useAuth } from './useAuth'

interface ProfiloContextValue {
  profilo: Profile | null
  caricamento: boolean
  ricarica: () => Promise<void>
  isAutista: boolean
  isAdmin: boolean
  isApprovato: boolean
}

const ProfiloContext = createContext<ProfiloContextValue | undefined>(undefined)

export function ProfiloProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profilo, setProfilo] = useState<Profile | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  async function carica() {
    if (!user) {
      setProfilo(null)
      setCaricamento(false)
      return
    }
    setCaricamento(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Errore nel caricare il profilo', error)
    }
    setProfilo(data ?? null)
    setCaricamento(false)
  }

  useEffect(() => {
    carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Tiene il profilo aggiornato se l'admin cambia il ruolo mentre sei dentro.
  useEffect(() => {
    if (!user) return
    const canale = supabase
      .channel(`profilo-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => setProfilo(payload.new as Profile)
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canale)
    }
  }, [user?.id])

  const ruolo = profilo?.ruolo
  const value: ProfiloContextValue = {
    profilo,
    caricamento,
    ricarica: carica,
    isAutista: ruolo === 'autista' || ruolo === 'admin',
    isAdmin: ruolo === 'admin',
    isApprovato: ruolo === 'passeggero' || ruolo === 'autista' || ruolo === 'admin',
  }

  return <ProfiloContext.Provider value={value}>{children}</ProfiloContext.Provider>
}

export function useProfilo() {
  const ctx = useContext(ProfiloContext)
  if (!ctx) throw new Error('useProfilo va usato dentro <ProfiloProvider>')
  return ctx
}
