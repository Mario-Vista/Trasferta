import { useState } from 'react'
import { Camera, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { connettiDrive, creaCartellaFoto, isDriveConnesso } from '@/lib/drive'

export default function FotoEvento({
  eventoId,
  creatoDa,
  driveFolderUrl,
  onCreata,
}: {
  eventoId: string
  creatoDa: string
  driveFolderUrl: string | null
  onCreata: () => void
}) {
  const { user } = useAuth()
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [serveConnessione, setServeConnessione] = useState(false)

  const sonoIlCreatore = user?.id === creatoDa

  if (driveFolderUrl) {
    return (
      <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="card flex items-center gap-3">
        <Camera size={20} className="text-accent shrink-0" />
        <span className="font-medium flex-1">Foto dell'evento</span>
        <ExternalLink size={16} className="text-text-muted" />
      </a>
    )
  }

  if (!sonoIlCreatore) return null

  async function crea() {
    setCaricamento(true)
    setErrore(null)
    setServeConnessione(false)

    const connesso = await isDriveConnesso()
    if (!connesso) {
      setServeConnessione(true)
      setCaricamento(false)
      return
    }

    const risultato = await creaCartellaFoto(eventoId)
    setCaricamento(false)
    if (risultato.errore) {
      setErrore(risultato.errore)
      return
    }
    onCreata()
  }

  return (
    <div className="card">
      <button onClick={crea} disabled={caricamento} className="w-full flex items-center gap-3">
        <Camera size={20} className="text-text-muted shrink-0" />
        <span className="font-medium flex-1 text-left">
          {caricamento ? 'Creo la cartella...' : 'Crea cartella foto'}
        </span>
      </button>

      {serveConnessione && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-text-muted text-sm mb-2">
            Prima devi collegare il tuo Google Drive (15GB gratis, serve una volta sola).
          </p>
          <button onClick={connettiDrive} className="btn-primary w-full">
            Collega Google Drive
          </button>
        </div>
      )}

      {errore && <p className="text-danger text-sm mt-2">{errore}</p>}
    </div>
  )
}
