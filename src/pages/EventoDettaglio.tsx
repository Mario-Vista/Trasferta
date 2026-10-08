import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapPin, User, Trophy, ChevronLeft } from 'lucide-react'
import { useEvento } from '@/hooks/useEvento'
import { useProfilo } from '@/hooks/useProfilo'
import { formattaDataEstesa, eventoPassato } from '@/lib/format'
import ViaggioCard from '@/components/ViaggioCard'
import AggiungiViaggio from '@/components/AggiungiViaggio'
import EventoStelle from '@/components/EventoStelle'
import FotoEvento from '@/components/FotoEvento'

export default function EventoDettaglio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAutista } = useProfilo()
  const { evento, viaggi, caricamento, erroreNonTrovato, ricarica } = useEvento(id)

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

  return (
    <div className="px-5 pt-4 max-w-lg mx-auto pb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-text-muted text-sm mb-4 -ml-1 py-1"
      >
        <ChevronLeft size={18} /> Indietro
      </button>

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
          <ViaggioCard key={v.id} viaggio={v} eventoPassato={passato} luogoEvento={evento.luogo} />
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
