import { useState } from 'react'
import { Check, X, Pencil, Clock, Route as RouteIcon, Euro, Ticket } from 'lucide-react'
import { useProfilo } from '@/hooks/useProfilo'
import { useAuth } from '@/hooks/useAuth'
import {
  accettaPasseggero,
  lasciaViaggio,
  prenotaViaggio,
  rifiutaPasseggero,
  type ViaggioConDettagli,
} from '@/hooks/useEvento'
import { formattaDurata, formattaEuro, formattaKm, formattaOrario } from '@/lib/format'
import IconaMezzo, { ETICHETTA_MEZZO } from './IconaMezzo'
import ModificaViaggio from './ModificaViaggio'

export default function ViaggioCard({
  viaggio,
  eventoPassato,
  luogoEvento,
}: {
  viaggio: ViaggioConDettagli
  eventoPassato: boolean
  luogoEvento: string
}) {
  const { user } = useAuth()
  const { isAdmin } = useProfilo()
  const [caricamento, setCaricamento] = useState(false)
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)
  const [modificaAperta, setModificaAperta] = useState(false)

  const meId = user?.id
  const confermati = viaggio.partecipazioni.filter((p) => p.stato === 'confermata')
  const inAttesa = viaggio.partecipazioni.filter((p) => p.stato === 'in_attesa')
  const isAuto = viaggio.tipo === 'auto'
  const postiTotali = viaggio.posti_passeggeri ?? 0
  const postiLiberi = isAuto ? postiTotali - confermati.length : null

  const sonoAutista = viaggio.autista_id === meId
  const possoModificare = sonoAutista || (!isAuto && viaggio.proposto_da === meId) || isAdmin
  const mieRichiesteOAutista = sonoAutista
  const miaPartecipazione = viaggio.partecipazioni.find((p) => p.user_id === meId)

  const costoTotale = isAuto
    ? (viaggio.costo_carburante ?? 0) + (viaggio.costo_pedaggio ?? 0)
    : viaggio.costo_biglietto ?? null
  const quotaATesta =
    isAuto && costoTotale !== null ? costoTotale / (confermati.length + 1) : costoTotale

  async function gestisci(azione: () => Promise<void>) {
    setErroreAzione(null)
    setCaricamento(true)
    try {
      await azione()
    } catch (e) {
      setErroreAzione(e instanceof Error ? e.message : 'Qualcosa è andato storto.')
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconaMezzo tipo={viaggio.tipo} className="text-accent" />
          <span className="font-heading font-semibold">{ETICHETTA_MEZZO[viaggio.tipo]}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAuto && (
            <span
              className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                postiLiberi === 0 ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
              }`}
            >
              {postiLiberi === 0 ? 'Piena' : `${postiLiberi} posti liberi`}
            </span>
          )}
          {possoModificare && !eventoPassato && (
            <button
              onClick={() => setModificaAperta((v) => !v)}
              className="text-text-muted active:scale-90 transition-transform duration-150"
              aria-label="Modifica viaggio"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Autista / proponente */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar persona={isAuto ? viaggio.autista : viaggio.proponente} />
        <span className="text-sm text-text-muted">
          {isAuto ? viaggio.autista?.nome ?? 'Autista da definire' : `Aggiunto da ${viaggio.proponente.nome}`}
        </span>
      </div>

      {/* Dettagli: orario, durata, distanza */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-text-muted mb-3">
        {viaggio.ora_partenza && (
          <span className="flex items-center gap-1">
            <Clock size={14} /> Partenza {formattaOrario(viaggio.ora_partenza)}
          </span>
        )}
        {viaggio.durata_minuti != null && (
          <span className="flex items-center gap-1">
            <RouteIcon size={14} />
            {formattaDurata(viaggio.durata_minuti)}
            {viaggio.distanza_km != null && ` · ${formattaKm(viaggio.distanza_km)}`}
          </span>
        )}
        {quotaATesta !== null && quotaATesta > 0 && (
          <span className="flex items-center gap-1">
            <Euro size={14} /> {formattaEuro(quotaATesta)} a testa
          </span>
        )}
      </div>

      {viaggio.note && <p className="text-sm text-text-muted mb-3 italic">"{viaggio.note}"</p>}

      {!isAuto && viaggio.link_biglietto && (
        <a
          href={viaggio.link_biglietto}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-accent mb-3"
        >
          <Ticket size={14} /> Vedi il biglietto
        </a>
      )}

      {/* Avatar dei confermati */}
      {confermati.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {confermati.map((p) => (
            <div key={p.user_id} className="flex items-center gap-1 bg-bg rounded-full pl-1 pr-2 py-1">
              <Avatar persona={p.profiles} size={20} />
              <span className="text-xs">{p.profiles.nome.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Richieste in attesa (solo per chi può accettarle: l'autista dell'auto) */}
      {isAuto && mieRichiesteOAutista && inAttesa.length > 0 && (
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Richieste in attesa
          </p>
          {inAttesa.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar persona={p.profiles} size={24} />
                <span className="text-sm">{p.profiles.nome}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={caricamento}
                  onClick={() => gestisci(() => accettaPasseggero(viaggio.id, p.user_id))}
                  className="w-8 h-8 rounded-full bg-accent text-bg flex items-center justify-center active:scale-90 transition-transform duration-150 disabled:opacity-40"
                  aria-label="Accetta"
                >
                  <Check size={16} />
                </button>
                <button
                  disabled={caricamento}
                  onClick={() => gestisci(() => rifiutaPasseggero(viaggio.id, p.user_id))}
                  className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center active:scale-90 transition-transform duration-150 disabled:opacity-40"
                  aria-label="Rifiuta"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {erroreAzione && <p className="text-danger text-sm mt-3">{erroreAzione}</p>}

      {/* Azione principale per l'utente corrente */}
      {!eventoPassato && !sonoAutista && (
        <div className="mt-3">
          {miaPartecipazione?.stato === 'confermata' && (
            <button
              disabled={caricamento}
              onClick={() => gestisci(() => lasciaViaggio(viaggio.id))}
              className="btn-secondary w-full"
            >
              Esco
            </button>
          )}
          {miaPartecipazione?.stato === 'in_attesa' && (
            <button
              disabled={caricamento}
              onClick={() => gestisci(() => lasciaViaggio(viaggio.id))}
              className="btn-secondary w-full"
            >
              Richiesta inviata — ritira
            </button>
          )}
          {!miaPartecipazione && (
            <button
              disabled={caricamento || viaggio.stato !== 'confermato' || postiLiberi === 0}
              onClick={() => gestisci(() => prenotaViaggio(viaggio.id))}
              className="btn-primary w-full"
            >
              {isAuto ? 'Chiedi un posto' : 'Ci sto'}
            </button>
          )}
        </div>
      )}

      {modificaAperta && (
        <ModificaViaggio
          viaggio={viaggio}
          luogoEvento={luogoEvento}
          onChiudi={() => setModificaAperta(false)}
        />
      )}
    </div>
  )
}

function Avatar({
  persona,
  size = 28,
}: {
  persona: { nome: string; avatar_url: string | null } | null | undefined
  size?: number
}) {
  if (!persona) {
    return (
      <div
        className="rounded-full bg-bg border border-border shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  if (persona.avatar_url) {
    return (
      <img
        src={persona.avatar_url}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {persona.nome.charAt(0).toUpperCase()}
    </div>
  )
}
