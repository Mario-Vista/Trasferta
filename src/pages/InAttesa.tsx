import { Hourglass } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfilo } from '@/hooks/useProfilo'

export default function InAttesa() {
  const { esci } = useAuth()
  const { profilo } = useProfilo()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      {profilo?.avatar_url ? (
        <img
          src={profilo.avatar_url}
          alt=""
          className="w-20 h-20 rounded-full mb-5 border-2 border-accent object-cover"
        />
      ) : (
        <div className="w-20 h-20 rounded-full mb-5 border-2 border-accent bg-surface flex items-center justify-center">
          <Hourglass className="text-accent" size={28} />
        </div>
      )}
      <h1 className="text-xl font-heading mb-2">Ciao {profilo?.nome || ''}!</h1>
      <p className="text-text-muted max-w-xs mb-8">
        Sei dentro, ma l'admin deve ancora abilitarti come autista o passeggero. Appena lo fa,
        vedrai subito il calendario.
      </p>
      <button className="btn-secondary" onClick={esci}>
        Esci
      </button>
    </div>
  )
}
