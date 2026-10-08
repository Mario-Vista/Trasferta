import { useState } from 'react'
import { Loader2, Route as RouteIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ViaggioConDettagli } from '@/hooks/useEvento'

export default function ModificaViaggio({
  viaggio,
  luogoEvento,
  onChiudi,
}: {
  viaggio: ViaggioConDettagli
  luogoEvento: string
  onChiudi: () => void
}) {
  const isAuto = viaggio.tipo === 'auto'

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
  const [carburante, setCarburante] = useState(viaggio.costo_carburante?.toString() ?? '')
  const [pedaggio, setPedaggio] = useState(viaggio.costo_pedaggio?.toString() ?? '')
  const [biglietto, setBiglietto] = useState(viaggio.costo_biglietto?.toString() ?? '')
  const [linkBiglietto, setLinkBiglietto] = useState(viaggio.link_biglietto ?? '')
  const [note, setNote] = useState(viaggio.note ?? '')
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function calcolaPercorso() {
    setCalcolando(true)
    setErroreCalcolo(null)
    const { data, error } = await supabase.functions.invoke('calcola-percorso', {
      body: { luogo: luogoEvento },
    })
    setCalcolando(false)

    if (error || data?.errore) {
      setErroreCalcolo(data?.errore ?? 'Non sono riuscito a calcolare il percorso. Inseriscilo a mano.')
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
        costo_carburante: isAuto ? parseEuro(carburante) : null,
        costo_pedaggio: isAuto ? parseEuro(pedaggio) : null,
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
    onChiudi()
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Benzina €</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={carburante}
              onChange={(e) => setCarburante(e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Casello €</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={pedaggio}
              onChange={(e) => setPedaggio(e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
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
        <button className="btn-secondary flex-1" onClick={onChiudi} disabled={salvataggio}>
          Annulla
        </button>
        <button className="btn-primary flex-1" onClick={salva} disabled={salvataggio}>
          Salva
        </button>
      </div>
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
