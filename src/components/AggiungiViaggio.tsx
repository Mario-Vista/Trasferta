import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TipoViaggio } from '@/lib/database.types'
import IconaMezzo, { ETICHETTA_MEZZO } from './IconaMezzo'

const MEZZI_NON_AUTO: TipoViaggio[] = ['treno', 'pullman', 'aereo']

/**
 * Azioni per aggiungere un viaggio a un evento esistente:
 * - chiunque sia autista: può aggiungere direttamente la propria auto (confermata)
 *   ("Auto (personale)"), oppure chiedere comunque che sia qualcun altro a guidare
 *   ("Auto (chiedi agli altri)") — anche un autista, per questo evento, può voler
 *   essere passeggero.
 * - chi non è autista: solo "Auto (chiedi agli altri)", in attesa che un autista
 *   la prenda in carico.
 * - chiunque: aggiunge treno/pullman/aereo (confermato, nessun limite posti)
 * I dettagli (orario, durata, costi) si riempiono dopo con "Modifica" sulla card.
 */
export default function AggiungiViaggio({
  eventoId,
  isAutista,
  onFatto,
}: {
  eventoId: string
  isAutista: boolean
  onFatto: () => void
}) {
  const { user } = useAuth()
  const [aperto, setAperto] = useState(false)
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function aggiungiAutoMia() {
    if (!user) return
    await esegui(async () => {
      const { error } = await supabase.from('viaggi').insert({
        evento_id: eventoId,
        tipo: 'auto',
        stato: 'confermato',
        autista_id: user.id,
        proposto_da: user.id,
        posti_passeggeri: 4,
      })
      if (error) throw error
    })
  }

  async function chiediAuto() {
    if (!user) return
    await esegui(async () => {
      const { error } = await supabase.from('viaggi').insert({
        evento_id: eventoId,
        tipo: 'auto',
        stato: 'in_attesa',
        autista_id: null,
        proposto_da: user.id,
        posti_passeggeri: 4,
      })
      if (error) throw error
    })
  }

  async function aggiungiMezzo(tipo: TipoViaggio) {
    if (!user) return
    await esegui(async () => {
      const { error } = await supabase.from('viaggi').insert({
        evento_id: eventoId,
        tipo,
        stato: 'confermato',
        autista_id: null,
        proposto_da: user.id,
        posti_passeggeri: null,
      })
      if (error) throw error
    })
  }

  async function esegui(azione: () => Promise<void>) {
    setCaricamento(true)
    setErrore(null)
    try {
      await azione()
      setAperto(false)
      onFatto()
    } catch {
      setErrore('Non sono riuscito ad aggiungere il viaggio. Riprova.')
    } finally {
      setCaricamento(false)
    }
  }

  if (!aperto) {
    return (
      <button className="btn-secondary w-full" onClick={() => setAperto(true)}>
        + Aggiungi un modo per arrivare
      </button>
    )
  }

  return (
    <div className="card space-y-2">
      <p className="text-sm font-semibold text-text-muted mb-1">Come ci vai?</p>

      {isAutista && (
        <button disabled={caricamento} onClick={aggiungiAutoMia} className="btn-secondary w-full justify-start">
          <IconaMezzo tipo="auto" /> Auto (personale)
        </button>
      )}
      <button disabled={caricamento} onClick={chiediAuto} className="btn-secondary w-full justify-start">
        <IconaMezzo tipo="auto" /> Auto (chiedi agli altri)
      </button>

      {MEZZI_NON_AUTO.map((tipo) => (
        <button
          key={tipo}
          disabled={caricamento}
          onClick={() => aggiungiMezzo(tipo)}
          className="btn-secondary w-full justify-start"
        >
          <IconaMezzo tipo={tipo} /> Aggiungi {ETICHETTA_MEZZO[tipo].toLowerCase()}
        </button>
      ))}

      {errore && <p className="text-danger text-sm">{errore}</p>}

      <button className="text-text-muted text-sm w-full text-center py-1" onClick={() => setAperto(false)}>
        Annulla
      </button>
    </div>
  )
}
