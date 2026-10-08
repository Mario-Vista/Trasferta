import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import type { EventoConMedia } from '@/lib/database.types'
import { formattaDataBreve } from '@/lib/format'
import { StelleDisplay } from './Stelle'

export default function EventoCard({ evento }: { evento: EventoConMedia }) {
  const [giorno, mese] = formattaDataBreve(evento.data).split(' ').slice(1)

  return (
    <Link
      to={`/evento/${evento.id}`}
      className="card flex gap-4 items-stretch active:scale-[0.99] transition-transform duration-150"
    >
      <div className="flex flex-col items-center justify-center bg-bg rounded-xl px-3 py-2 min-w-[60px]">
        <span className="font-display text-2xl leading-none text-accent">{giorno}</span>
        <span className="text-[11px] uppercase text-text-muted mt-0.5">{mese}</span>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-heading font-semibold text-base truncate">{evento.nome}</h3>
        <p className="flex items-center gap-1 text-text-muted text-sm mt-0.5 truncate">
          <MapPin size={14} className="shrink-0" />
          {evento.luogo}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {evento.numero_voti > 0 && (
            <StelleDisplay valore={evento.media_stelle} numeroVoti={evento.numero_voti} size={13} />
          )}
          {evento.stato === 'proposto' && (
            <span className="text-xs font-semibold text-accent">Da approvare</span>
          )}
          {evento.stato === 'annullato' && (
            <span className="text-xs font-semibold text-danger">Annullato</span>
          )}
        </div>
      </div>
    </Link>
  )
}
