import { useRef, useState } from 'react'
import { Loader2, Pencil, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/lib/database.types'

const DIMENSIONE_AVATAR = 512
const DIMENSIONE_MAX_FILE = 8 * 1024 * 1024 // 8MB, prima della compressione

/**
 * Nome utente e foto profilo sono sempre modificabili (RLS lo permette già,
 * vedi profiles_update_self in 0002_rls.sql) e sempre ripristinabili al
 * valore originale di Google (nome_google/avatar_url_google, salvati al
 * primo login — migration 0009_profilo_custom.sql).
 */
export default function ModificaProfilo({
  profilo,
  onAggiornato,
}: {
  profilo: Profile
  onAggiornato: () => void
}) {
  const { user } = useAuth()
  const inputFileRef = useRef<HTMLInputElement>(null)

  const [modificaNome, setModificaNome] = useState(false)
  const [nome, setNome] = useState(profilo.nome)
  const [salvataggioNome, setSalvataggioNome] = useState(false)

  const [caricamentoFoto, setCaricamentoFoto] = useState(false)
  const [erroreFoto, setErroreFoto] = useState<string | null>(null)

  const [ripristino, setRipristino] = useState(false)

  const personalizzato =
    profilo.nome !== (profilo.nome_google ?? profilo.nome) ||
    (profilo.avatar_url ?? '').split('?')[0] !== (profilo.avatar_url_google ?? '')

  async function salvaNome() {
    const pulito = nome.trim()
    if (!pulito) return
    setSalvataggioNome(true)
    const { error } = await supabase.from('profiles').update({ nome: pulito }).eq('id', profilo.id)
    setSalvataggioNome(false)
    if (!error) {
      setModificaNome(false)
      onAggiornato()
    }
  }

  async function caricaFoto(file: File) {
    setErroreFoto(null)

    if (!file.type.startsWith('image/')) {
      setErroreFoto('Scegli un\'immagine.')
      return
    }
    if (file.size > DIMENSIONE_MAX_FILE) {
      setErroreFoto('Immagine troppo grande (max 8MB).')
      return
    }
    if (!user) return

    setCaricamentoFoto(true)
    try {
      const blob = await ritagliaECompromi(file)

      const { error: erroreUpload } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })

      if (erroreUpload) throw erroreUpload

      const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`)
      const urlConCacheBust = `${data.publicUrl}?v=${Date.now()}`

      const { error: erroreUpdate } = await supabase
        .from('profiles')
        .update({ avatar_url: urlConCacheBust })
        .eq('id', profilo.id)

      if (erroreUpdate) throw erroreUpdate

      onAggiornato()
    } catch {
      setErroreFoto('Non sono riuscito a caricare la foto. Riprova.')
    } finally {
      setCaricamentoFoto(false)
    }
  }

  async function ripristina() {
    setRipristino(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: profilo.nome_google || profilo.nome,
        avatar_url: profilo.avatar_url_google,
      })
      .eq('id', profilo.id)
    setRipristino(false)
    if (!error) onAggiornato()
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputFileRef.current?.click()}
          disabled={caricamentoFoto}
          className="relative w-16 h-16 shrink-0 active:scale-95 transition-transform duration-150"
          aria-label="Cambia foto profilo"
        >
          {profilo.avatar_url ? (
            <img src={profilo.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface border border-border" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-accent text-bg flex items-center justify-center">
            {caricamentoFoto ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Pencil size={12} />
            )}
          </span>
        </button>
        <input
          ref={inputFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) caricaFoto(file)
            e.target.value = ''
          }}
        />

        <div className="flex-1 min-w-0">
          {!modificaNome ? (
            <button
              type="button"
              onClick={() => {
                setNome(profilo.nome)
                setModificaNome(true)
              }}
              className="flex items-center gap-1.5 active:opacity-70"
            >
              <p className="font-heading font-semibold text-lg truncate">{profilo.nome}</p>
              <Pencil size={13} className="text-text-muted shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input flex-1"
                maxLength={40}
                autoFocus
              />
              <button
                onClick={salvaNome}
                disabled={salvataggioNome || !nome.trim()}
                className="text-accent font-semibold text-sm shrink-0 disabled:opacity-40"
              >
                {salvataggioNome ? <Loader2 size={16} className="animate-spin" /> : 'Salva'}
              </button>
            </div>
          )}
          <p className="text-text-muted text-sm">{profilo.email}</p>
        </div>
      </div>

      {erroreFoto && <p className="text-danger text-xs mt-2">{erroreFoto}</p>}

      {personalizzato && (
        <button
          type="button"
          onClick={ripristina}
          disabled={ripristino}
          className="flex items-center gap-1.5 text-text-muted text-xs mt-2 disabled:opacity-50"
        >
          {ripristino ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Ripristina nome e foto di Google
        </button>
      )}
    </div>
  )
}

// Ritaglia al centro in un quadrato e ricomprime, per non riempire lo
// storage gratuito con foto enormi scattate da un telefono.
function ritagliaECompromi(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const lato = Math.min(img.width, img.height)
      const sx = (img.width - lato) / 2
      const sy = (img.height - lato) / 2

      const canvas = document.createElement('canvas')
      canvas.width = DIMENSIONE_AVATAR
      canvas.height = DIMENSIONE_AVATAR
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas non supportato.'))
        return
      }
      ctx.drawImage(img, sx, sy, lato, lato, 0, 0, DIMENSIONE_AVATAR, DIMENSIONE_AVATAR)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Conversione fallita.'))),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Immagine non valida.'))
    }
    img.src = url
  })
}
