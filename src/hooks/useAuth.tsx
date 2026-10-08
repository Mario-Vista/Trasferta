import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { salvaRefreshTokenDrive } from '@/lib/drive'

interface AuthContextValue {
  session: Session | null
  user: User | null
  caricamento: boolean
  entraConGoogle: () => Promise<void>
  esci: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCaricamento(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuovaSession) => {
      setSession(nuovaSession)

      // Il refresh token del provider arriva da Google SOLO nel giro subito
      // dopo un consenso con access_type=offline (es. connessione a Drive),
      // e solo qui: Supabase non lo ripropone ai login successivi. Va
      // salvato subito o si perde.
      const refreshTokenProvider = (nuovaSession as unknown as { provider_refresh_token?: string })
        ?.provider_refresh_token
      if (refreshTokenProvider) {
        salvaRefreshTokenDrive(refreshTokenProvider)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function entraConGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function esci() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, caricamento, entraConGoogle, esci }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro <AuthProvider>')
  return ctx
}
