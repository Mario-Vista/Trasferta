import { useEffect, useState } from 'react'
import { Bell, BellOff, Share } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  attivaPush,
  disattivaPush,
  eIOS,
  eStandalone,
  pushAttiva,
  pushSupportata,
} from '@/lib/push'

export default function AttivaNotifiche() {
  const { user } = useAuth()
  const [attiva, setAttiva] = useState<boolean | null>(null)
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    pushAttiva().then(setAttiva)
  }, [])

  // Su iPhone le push funzionano solo se l'app è stata aggiunta alla Home
  // (iOS 16.4+): mostriamo le istruzioni invece del pulsante, com'è inutile
  // chiedere un permesso che Safari in scheda normale non concederà mai.
  if (eIOS() && !eStandalone()) {
    return (
      <div className="card flex items-start gap-3">
        <Share size={20} className="text-accent shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm mb-1">Attiva le notifiche su iPhone</p>
          <p className="text-text-muted text-sm">
            Tocca <strong>Condividi</strong> nella barra di Safari, poi{' '}
            <strong>"Aggiungi alla schermata Home"</strong>. Riapri Trasferta da lì per attivare le
            notifiche.
          </p>
        </div>
      </div>
    )
  }

  if (!pushSupportata()) return null
  if (!user || attiva === null) return null

  async function alterna() {
    setCaricamento(true)
    setErrore(null)
    if (attiva) {
      await disattivaPush()
      setAttiva(false)
    } else {
      const risultato = await attivaPush(user!.id)
      if (risultato.ok) {
        setAttiva(true)
      } else {
        setErrore(risultato.errore ?? 'Non sono riuscito ad attivare le notifiche.')
      }
    }
    setCaricamento(false)
  }

  return (
    <div className="card">
      <button
        onClick={alterna}
        disabled={caricamento}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-3">
          {attiva ? <Bell size={20} className="text-accent" /> : <BellOff size={20} className="text-text-muted" />}
          <span className="font-medium">{attiva ? 'Notifiche attive' : 'Attiva notifiche'}</span>
        </span>
        <span className="text-xs text-text-muted">{attiva ? 'Disattiva' : ''}</span>
      </button>
      {errore && <p className="text-danger text-xs mt-2">{errore}</p>}
    </div>
  )
}
