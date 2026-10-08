import { useMemo, useState } from 'react'
import { useEventi } from '@/hooks/useEventi'
import { formattaMese } from '@/lib/format'
import EventoCard from '@/components/EventoCard'
import type { EventoConMedia } from '@/lib/database.types'

export default function Calendario() {
  const [periodo, setPeriodo] = useState<'prossimi' | 'passati'>('prossimi')
  const { eventi, errore } = useEventi(periodo)

  const gruppi = useMemo(() => raggruppaPerMese(eventi ?? []), [eventi])

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl tracking-tight">
          TRASFERTA<span className="text-accent">→</span>
        </h1>
      </div>

      <div className="flex bg-surface border border-border rounded-full p-1 mb-6">
        <ToggleBtn attivo={periodo === 'prossimi'} onClick={() => setPeriodo('prossimi')}>
          Prossimi
        </ToggleBtn>
        <ToggleBtn attivo={periodo === 'passati'} onClick={() => setPeriodo('passati')}>
          Passati
        </ToggleBtn>
      </div>

      {errore && <p className="text-danger text-sm mb-4">{errore}</p>}

      {eventi === null && <p className="text-text-muted text-center py-12">Carico...</p>}

      {eventi !== null && eventi.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted">
            {periodo === 'prossimi' ? 'Nessuna trasferta in programma.' : 'Nessun evento passato.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {gruppi.map(([mese, eventiDelMese]) => (
          <section key={mese}>
            <h2 className="text-text-muted text-sm font-semibold uppercase tracking-wide mb-3">
              {mese}
            </h2>
            <div className="space-y-3">
              {eventiDelMese.map((e) => (
                <EventoCard key={e.id} evento={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ToggleBtn({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors duration-150 ${
        attivo ? 'bg-accent text-bg' : 'text-text-muted'
      }`}
    >
      {children}
    </button>
  )
}

function raggruppaPerMese(eventi: EventoConMedia[]): [string, EventoConMedia[]][] {
  const mappa = new Map<string, EventoConMedia[]>()
  for (const e of eventi) {
    const chiave = formattaMese(e.data)
    if (!mappa.has(chiave)) mappa.set(chiave, [])
    mappa.get(chiave)!.push(e)
  }
  return Array.from(mappa.entries())
}
