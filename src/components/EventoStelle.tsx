import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { StelleDisplay, StelleInput } from './Stelle'

export default function EventoStelle({
  eventoId,
  media,
  numeroVoti,
}: {
  eventoId: string
  media: number
  numeroVoti: number
}) {
  const { user } = useAuth()
  const [mioVoto, setMioVoto] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('voti_evento')
      .select('stelle')
      .eq('evento_id', eventoId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setMioVoto(data?.stelle ?? 0))
  }, [eventoId, user?.id])

  async function vota(stelle: number) {
    setMioVoto(stelle)
    if (!user) return
    await supabase
      .from('voti_evento')
      .upsert({ evento_id: eventoId, user_id: user.id, stelle }, { onConflict: 'evento_id,user_id' })
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-text-muted mb-1">Qualità della battle</p>
        <StelleDisplay valore={media} numeroVoti={numeroVoti} size={18} />
      </div>
      {mioVoto !== null && (
        <div>
          <p className="text-xs text-text-muted mb-1 text-right">Il tuo voto</p>
          <StelleInput valore={mioVoto} onChange={vota} size={22} />
        </div>
      )}
    </div>
  )
}
