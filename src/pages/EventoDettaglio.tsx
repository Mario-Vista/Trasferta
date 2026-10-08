import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Loader2, MapPin, User, Trophy, ChevronLeft, Ban, Trash2 } from 'lucide-react'
import { useEvento, eliminaEvento, eliminaEventoDefinitivo } from '@/hooks/useEvento'
import { useAuth } from '@/hooks/useAuth'
import { useProfilo } from '@/hooks/useProfilo'
import { formattaDataEstesa, eventoPassato } from '@/lib/format'
import ViaggioCard from '@/components/ViaggioCard'
import AggiungiViaggio from '@/components/AggiungiViaggio'
import EventoStelle from '@/components/EventoStelle'
import FotoEvento from '@/components/FotoEvento'

export default function EventoDettaglio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAutista, isAdmin } = useProfilo()
  const { evento, viaggi, caricamento, erroreNonTrovato, ricarica } = useEvento(id)
  // 'annulla' (chi ha creato l'evento o un admin, resta visibile come
  // annullato) e 'elimina' (solo admin, sparisce per sempre) sono due azioni
  // distinte con permessi diversi — prima erano un'unica azione che decideva
  // da sola quale delle due fare, e chi aveva solo il permesso di annullare
  // poteva ritrovarsi a eliminare per sempre senza volerlo.
  const [azione, setAzione] = useState<'annulla' | 'elimina' | null>(null)
  const [eseguendo, setEseguendo] = useState(false)
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)

  if (erroreNonTrovato) {
    return (
      <div className="px-5 pt-6 text-center">
        <p className="text-text-muted mb-4">
          Questo evento non esiste, è stato annullato o non è ancora visibile.
        </p>
        <Link to="/" className="text-accent font-semibold">
          Torna al calendario
        </Link>
      </div>
    )
  }

  if (caricamento || !evento) {
    return <p className="px-5 pt-6 text-text-muted">Carico...</p>
  }

  const passato = eventoPassato(evento.data)
  const linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.luogo)}`
  const possoAnnullare = evento.creato_da === user?.id || isAdmin

  async function esegui() {
    if (!azione) return
    setErroreAzione(null)
    setEseguendo(true)
    try {
      if (azione === 'annulla') await eliminaEvento(evento!.id)
      else await eliminaEventoDefinitivo(evento!.id)
      navigate('/')
    } catch (e) {
      setErroreAzione(e instanceof Error ? e.message : 'Non sono riuscito a completare l\'operazione.')
      setEseguendo(false)
    }
  }

  return (
    <div className="px-5 pt-4 max-w-lg mx-auto pb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-text-muted text-sm -ml-1 py-1"
        >
          <ChevronLeft size={18} /> Indietro
        </button>
        <div className="flex items-center gap-3">
          {possoAnnullare && !azione && evento.stato !== 'annullato' && (
            <button
              onClick={() => setAzione('annulla')}
              className="text-text-muted active:scale-90 transition-transform duration-150"
              aria-label="Annulla evento"
            >
              <Ban size={18} />
            </button>
          )}
          {isAdmin && !azione && (
            <button
              onClick={() => setAzione('elimina')}
              className="text-danger active:scale-90 transition-transform duration-150"
              aria-label="Elimina definitivamente (admin)"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {azione && (
        <div className="card mb-4 space-y-2">
          <p className="text-sm text-center">
            {azione === 'annulla'
              ? `Annullare "${evento.nome}"? Resterà visibile come annullato e tutti verranno avvisati.`
              : `Eliminare DEFINITIVAMENTE "${evento.nome}"? Sparisce senza lasciare traccia, insieme a tutti i suoi viaggi — non si può annullare l'operazione.`}
          </p>
          {erroreAzione && <p className="text-danger text-sm text-center">{erroreAzione}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setAzione(null)} disabled={eseguendo}>
              No, torna indietro
            </button>
            <button
              className="flex-1 rounded-xl bg-danger text-white font-semibold py-2.5 active:scale-95 transition-transform duration-150 disabled:opacity-50"
              onClick={esegui}
              disabled={eseguendo}
            >
              {eseguendo ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : azione === 'annulla' ? (
                'Sì, annulla'
              ) : (
                'Sì, elimina per sempre'
              )}
            </button>
          </div>
        </div>
      )}

      {evento.stato === 'proposto' && (
        <div className="bg-accent/10 text-accent text-sm font-semibold rounded-card px-3 py-2 mb-4">
          In attesa che un autista approvi la proposta
        </div>
      )}
      {evento.stato === 'annullato' && (
        <div className="bg-danger/10 text-danger text-sm font-semibold rounded-card px-3 py-2 mb-4">
          Evento annullato
        </div>
      )}

      <h1 className="font-display text-2xl leading-tight mb-1">{evento.nome}</h1>
      <p className="text-text-muted mb-3">{formattaDataEstesa(evento.data)}</p>

      <a
        href={linkMaps}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-sm text-accent mb-1"
      >
        <MapPin size={15} /> {evento.luogo}
      </a>

      {evento.organizzatore && (
        <p className="flex items-center gap-1.5 text-sm text-text-muted mb-1">
          <User size={15} /> Organizza {evento.organizzatore}
        </p>
      )}
      {evento.premio && (
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <Trophy size={15} /> {evento.premio}
        </p>
      )}

      <div className="card mt-4">
        <EventoStelle eventoId={evento.id} media={evento.media_stelle} numeroVoti={evento.numero_voti} />
      </div>

      <div className="mt-3">
        <FotoEvento
          eventoId={evento.id}
          creatoDa={evento.creato_da}
          driveFolderUrl={evento.drive_folder_url}
          onCreata={ricarica}
        />
      </div>

      <h2 className="font-heading font-semibold text-lg mt-6 mb-3">Viaggi</h2>

      <div className="space-y-3">
        {(viaggi ?? []).map((v) => (
          <ViaggioCard
            key={v.id}
            viaggio={v}
            eventoPassato={passato}
            luogoEvento={evento.luogo}
            ricarica={ricarica}
          />
        ))}

        {(viaggi ?? []).length === 0 && (
          <p className="text-text-muted text-sm">Ancora nessun viaggio organizzato.</p>
        )}

        {!passato && evento.stato === 'attivo' && (
          <AggiungiViaggio eventoId={evento.id} isAutista={isAutista} onFatto={ricarica} />
        )}
      </div>
    </div>
  )
}
