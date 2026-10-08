import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotificheList } from '@/hooks/useNotificheList'
import { formattaTempoFa } from '@/lib/format'
import type { Notifica } from '@/lib/database.types'

export default function Notifiche() {
  const { notifiche, segnaLetta, segnaTutteLette } = useNotificheList()
  const navigate = useNavigate()

  const nonLette = (notifiche ?? []).filter((n) => !n.letta).length

  async function apri(n: Notifica) {
    if (!n.letta) await segnaLetta(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">NOTIFICHE</h1>
        {nonLette > 0 && (
          <button onClick={segnaTutteLette} className="text-accent text-sm font-semibold">
            Segna tutte come lette
          </button>
        )}
      </div>

      {notifiche !== null && notifiche.length === 0 && (
        <div className="text-center py-16">
          <Bell className="mx-auto text-text-muted mb-3" size={32} />
          <p className="text-text-muted">Nessuna notifica, per ora.</p>
        </div>
      )}

      <div className="space-y-2">
        {(notifiche ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() => apri(n)}
            className={`w-full text-left rounded-card p-4 border transition-colors duration-150 ${
              n.letta ? 'bg-transparent border-border' : 'bg-surface border-accent/30'
            }`}
          >
            <div className="flex items-start gap-2">
              {!n.letta && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
              <div className="min-w-0">
                <p className={`font-medium text-sm ${n.letta ? 'text-text-muted' : 'text-text'}`}>
                  {n.titolo}
                </p>
                {n.corpo && <p className="text-text-muted text-sm mt-0.5">{n.corpo}</p>}
                <p className="text-text-muted text-xs mt-1">{formattaTempoFa(n.created_at)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
