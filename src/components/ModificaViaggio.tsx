import { useState } from 'react'
import { Loader2, Route as RouteIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { eliminaViaggio, type ViaggioConDettagli } from '@/hooks/useEvento'

export default function ModificaViaggio({
  viaggio,
  luogoEvento,
  onChiudi,
  ricarica,
}: {
  viaggio: ViaggioConDettagli
  luogoEvento: string
  onChiudi: () => void
  ricarica: () => void | Promise<void>
}) {
  const isAuto = viaggio.tipo === 'auto'
  // Proposta auto ancora senza autista: chi l'ha proposta può solo ritirarla
  // (non ha senso riempire orario/costi/note per un viaggio che nessun
  // autista ha ancora approvato, e non avrebbe comunque i permessi per
  // salvarli: la RLS su viaggi lascia modificare un'auto 'in_attesa' solo a
  // un autista, vedi 0002_rls.sql).
  const soloRitiro = isAuto && viaggio.stato === 'in_attesa'

  const [ora, setOra] = useState(toLocalInput(viaggio.ora_partenza))
  const [durataOre, setDurataOre] = useState(
    viaggio.durata_minuti != null ? Math.floor(viaggio.durata_minuti / 60).toString() : ''
  )
  const [durataMin, setDurataMin] = useState(
    viaggio.durata_minuti != null ? (viaggio.durata_minuti % 60).toString() : ''
  )
  const [distanzaKm, setDistanzaKm] = useState(viaggio.distanza_km?.toString() ?? '')
  const [calcolato, setCalcolato] = useState(viaggio.durata_calcolata)
  const [calcolando, setCalcolando] = useState(false)
  const [erroreCalcolo, setErroreCalcolo] = useState<string | null>(null)
  const [costoViaggio, setCostoViaggio] = useState(viaggio.costo_viaggio?.toString() ?? '')
  const [biglietto, setBiglietto] = useState(viaggio.costo_biglietto?.toString() ?? '')
  const [linkBiglietto, setLinkBiglietto] = useState(viaggio.link_biglietto ?? '')
  const [note, setNote] = useState(viaggio.note ?? '')
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [eliminazione, setEliminazione] = useState(false)
  const nessunoConfermato = !viaggio.partecipazioni.some((p) => p.stato === 'confermata')

  async function calcolaPercorso() {
    setCalcolando(true)
    setErroreCalcolo(null)
    const { data, error } = await supabase.functions.invoke('calcola-percorso', {
      body: { luogo: luogoEvento },
    })
    setCalcolando(false)

    if (error) {
      // Con status diverso da 2xx il client Supabase non mette il corpo in
      // `data`: il messaggio della Edge Function va letto dalla Response.
      let messaggio = 'Non sono riuscito a calcolare il percorso. Inseriscilo a mano.'
      const contesto = (error as { context?: Response }).context
      if (contesto) {
        try {
          const corpo = await contesto.json()
          if (corpo?.errore) messaggio = corpo.errore
        } catch {
          // corpo non leggibile come JSON: resta il messaggio generico
        }
      }
      setErroreCalcolo(messaggio)
      return
    }

    if (data?.errore) {
      setErroreCalcolo(data.errore)
      return
    }

    setDurataOre(Math.floor(data.durata_minuti / 60).toString())
    setDurataMin((data.durata_minuti % 60).toString())
    setDistanzaKm(data.distanza_km.toString())
    setCalcolato(true)
  }

  async function salva() {
    setErrore(null)

    const linkPulito = linkBiglietto.trim()
    if (!isAuto && linkPulito && !/^https?:\/\/.+/i.test(linkPulito)) {
      setErrore('Il link del biglietto deve iniziare con http:// o https://')
      return
    }

    setSalvataggio(true)

    const minuti =
      durataOre || durataMin ? (parseInt(durataOre || '0', 10) * 60 + parseInt(durataMin || '0', 10)) : null

    const { error } = await supabase
      .from('viaggi')
      .update({
        ora_partenza: ora ? new Date(ora).toISOString() : null,
        durata_minuti: minuti,
        distanza_km: isAuto ? parseEuro(distanzaKm) : null,
        durata_calcolata: calcolato,
        costo_viaggio: isAuto ? parseEuro(costoViaggio) : null,
        costo_biglietto: !isAuto ? parseEuro(biglietto) : null,
        link_biglietto: !isAuto ? linkBiglietto.trim() || null : null,
        note: note.trim() || null,
      })
      .eq('id', viaggio.id)

    setSalvataggio(false)
    if (error) {
      setErrore('Non sono riuscito a salvare. Riprova.')
      return
    }
    await ricarica()
    onChiudi()
  }

  async function elimina() {
    setErrore(null)
    setEliminazione(true)
    try {
      await eliminaViaggio(viaggio.id)
      await ricarica()
      onChiudi()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a togliere il viaggio.')
      setEliminazione(false)
    }
  }

  if (soloRitiro) {
    return (
      <div className="border-t border-border mt-3 pt-3 space-y-3">
        <p className="text-sm text-text-muted">
          In attesa che un autista accetti. Puoi ritirarla finché nessuno l'ha ancora presa in carico.
        </p>

        {errore && <p className="text-danger text-sm">{errore}</p>}

        {!confermaElimina ? (
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={onChiudi}>
              Chiudi
            </button>
            <button
              className="flex-1 rounded-xl bg-danger text-white font-semibold py-2.5 active:scale-95 transition-transform duration-150"
              onClick={() => setConfermaElimina(true)}
            >
              Ritira la proposta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-muted text-center">
              Sicuro? Un autista non potrà più accettarla.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => setConfermaElimina(false)}
                disabled={eliminazione}
              >
                No, torna indietro
              </button>
              <button
                className="flex-1 rounded-xl bg-danger text-white font-semibold py-2.5 active:scale-95 transition-transform duration-150 disabled:opacity-50"
                onClick={elimina}
                disabled={eliminazione}
              >
                {eliminazione ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Sì, ritira'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-border mt-3 pt-3 space-y-3">
      <div>
        <label className="label">Orario di partenza</label>
        <input
          type="datetime-local"
          value={ora}
          onChange={(e) => setOra(e.target.value)}
          className="input"
        />
      </div>

      {isAuto && (
        <div>
          <button
            type="button"
            onClick={calcolaPercorso}
            disabled={calcolando}
            className="btn-secondary w-full"
          >
            {calcolando ? <Loader2 size={16} className="animate-spin" /> : <RouteIcon size={16} />}
            Calcola percorso da Napoli Centrale
          </button>
          {erroreCalcolo && <p className="text-danger text-xs mt-1.5">{erroreCalcolo}</p>}
          {calcolato && !erroreCalcolo && (
            <p className="text-accent text-xs mt-1.5">Calcolato automaticamente, puoi comunque correggerlo.</p>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${isAuto ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <label className="label">Durata (ore)</label>
          <input
            type="number"
            min={0}
            value={durataOre}
            onChange={(e) => {
              setDurataOre(e.target.value)
              setCalcolato(false)
            }}
            className="input"
            placeholder="0"
          />
        </div>
        <div>
          <label className="label">Durata (min)</label>
          <input
            type="number"
            min={0}
            max={59}
            value={durataMin}
            onChange={(e) => {
              setDurataMin(e.target.value)
              setCalcolato(false)
            }}
            className="input"
            placeholder="0"
          />
        </div>
        {isAuto && (
          <div>
            <label className="label">Km</label>
            <input
              type="number"
              min={0}
              value={distanzaKm}
              onChange={(e) => {
                setDistanzaKm(e.target.value)
                setCalcolato(false)
              }}
              className="input"
              placeholder="0"
            />
          </div>
        )}
      </div>

      {isAuto ? (
        <div>
          <label className="label">Costo totale viaggio (benzina + casello) €</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={costoViaggio}
            onChange={(e) => setCostoViaggio(e.target.value)}
            className="input"
            placeholder="0"
          />
        </div>
      ) : (
        <div>
          <label className="label">Biglietto a persona €</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={biglietto}
            onChange={(e) => setBiglietto(e.target.value)}
            className="input"
            placeholder="andata + ritorno"
          />
        </div>
      )}

      {!isAuto && (
        <div>
          <label className="label">Link biglietto</label>
          <input
            type="url"
            inputMode="url"
            value={linkBiglietto}
            onChange={(e) => setLinkBiglietto(e.target.value)}
            className="input"
            placeholder="https://..."
          />
        </div>
      )}

      <div>
        <label className="label">Note</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          placeholder="es. Frecciarossa 9:15"
        />
      </div>

      {errore && <p className="text-danger text-sm">{errore}</p>}

      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onChiudi} disabled={salvataggio || eliminazione}>
          Chiudi
        </button>
        <button className="btn-primary flex-1" onClick={salva} disabled={salvataggio || eliminazione}>
          Salva
        </button>
      </div>

      {viaggio.stato === 'confermato' && (
        <div className="border-t border-border pt-3">
          {!confermaElimina ? (
            <button
              type="button"
              className="text-danger text-sm w-full text-center py-1"
              onClick={() => setConfermaElimina(true)}
              disabled={eliminazione}
            >
              {nessunoConfermato ? 'Elimina questo viaggio' : 'Annulla questo viaggio'}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-text-muted text-center">
                {nessunoConfermato
                  ? 'Sicuro? Verrà tolto del tutto, nessuno è ancora confermato.'
                  : 'Sicuro? Chi era confermato verrà avvisato.'}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setConfermaElimina(false)}
                  disabled={eliminazione}
                >
                  No, torna indietro
                </button>
                <button
                  className="flex-1 rounded-xl bg-danger text-white font-semibold py-2.5 active:scale-95 transition-transform duration-150 disabled:opacity-50"
                  onClick={elimina}
                  disabled={eliminazione}
                >
                  {eliminazione ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : nessunoConfermato ? (
                    'Sì, elimina'
                  ) : (
                    'Sì, annulla'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseEuro(v: string): number | null {
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}
