import { useState } from 'react'
import { useUtenti } from '@/hooks/useUtenti'
import { useAuth } from '@/hooks/useAuth'
import type { Ruolo } from '@/lib/database.types'

const RUOLI: { valore: Ruolo; etichetta: string }[] = [
  { valore: 'in_attesa', etichetta: 'In attesa' },
  { valore: 'passeggero', etichetta: 'Passeggero' },
  { valore: 'autista', etichetta: 'Autista' },
  { valore: 'admin', etichetta: 'Admin' },
]

export default function Utenti() {
  const { user } = useAuth()
  const { utenti, cambiaRuolo } = useUtenti()
  const [caricamentoId, setCaricamentoId] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function gestisciCambio(userId: string, ruolo: Ruolo) {
    setCaricamentoId(userId)
    setErrore(null)
    try {
      await cambiaRuolo(userId, ruolo)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore nel cambiare ruolo.')
    } finally {
      setCaricamentoId(null)
    }
  }

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <h1 className="font-display text-2xl mb-1">UTENTI</h1>
      <p className="text-text-muted text-sm mb-6">Assegna chi può guidare e chi aspetta ancora.</p>

      {errore && <p className="text-danger text-sm mb-4">{errore}</p>}

      <div className="space-y-3">
        {(utenti ?? []).map((u) => (
          <div
            key={u.id}
            className={`card ${u.ruolo === 'in_attesa' ? 'border-accent/50 bg-accent/5' : ''}`}
          >
            <div className="flex items-center gap-3 mb-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-bg border border-border" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {u.nome} {u.id === user?.id && <span className="text-text-muted text-xs">(tu)</span>}
                </p>
                <p className="text-text-muted text-xs truncate">{u.email}</p>
              </div>
              {u.ruolo === 'in_attesa' && (
                <span className="ml-auto text-xs font-semibold text-accent">Nuovo</span>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {RUOLI.map((r) => (
                <button
                  key={r.valore}
                  disabled={caricamentoId === u.id || u.id === user?.id}
                  onClick={() => gestisciCambio(u.id, r.valore)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors duration-150 disabled:opacity-40 ${
                    u.ruolo === r.valore
                      ? 'bg-accent text-bg border-accent'
                      : 'bg-transparent text-text-muted border-border'
                  }`}
                >
                  {r.etichetta}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
