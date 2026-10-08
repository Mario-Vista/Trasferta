import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProposteList } from '@/hooks/useProposteList'
import { supabase } from '@/lib/supabase'
import { formattaDataBreve } from '@/lib/format'

export default function Proposte() {
  const { proposte } = useProposteList()
  const [caricamentoId, setCaricamentoId] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function approva(viaggioId: string) {
    setCaricamentoId(viaggioId)
    setErrore(null)
    const { error } = await supabase.rpc('approva_proposta', { p_viaggio_id: viaggioId })
    setCaricamentoId(null)
    if (error) setErrore(error.message)
  }

  async function rifiuta(viaggioId: string) {
    setCaricamentoId(viaggioId)
    setErrore(null)
    const { error } = await supabase.rpc('rifiuta_proposta', { p_viaggio_id: viaggioId })
    setCaricamentoId(null)
    if (error) setErrore(error.message)
  }

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <h1 className="font-display text-2xl mb-1">PROPOSTE</h1>
      <p className="text-text-muted text-sm mb-6">
        Trasferte in auto proposte dai passeggeri, in attesa di un autista.
      </p>

      {errore && <p className="text-danger text-sm mb-4">{errore}</p>}

      {proposte !== null && proposte.length === 0 && (
        <p className="text-text-muted text-center py-12">Nessuna proposta in attesa.</p>
      )}

      <div className="space-y-3">
        {(proposte ?? []).map((p) => (
          <div key={p.id} className="card">
            <Link to={`/evento/${p.evento.id}`} className="block mb-3">
              <p className="font-heading font-semibold">{p.evento.nome}</p>
              <p className="text-text-muted text-sm">
                {formattaDataBreve(p.evento.data)} — {p.evento.luogo}
              </p>
            </Link>

            <div className="flex items-center gap-2 mb-4">
              {p.proponente.avatar_url ? (
                <img src={p.proponente.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent/20" />
              )}
              <span className="text-sm text-text-muted">{p.proponente.nome} propone l'auto</span>
            </div>

            <div className="flex gap-2">
              <button
                disabled={caricamentoId === p.id}
                onClick={() => rifiuta(p.id)}
                className="btn-secondary flex-1"
              >
                Rifiuta
              </button>
              <button
                disabled={caricamentoId === p.id}
                onClick={() => approva(p.id)}
                className="btn-primary flex-1"
              >
                Ci vado io
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
