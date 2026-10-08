import { ChevronRight, LogOut, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfilo } from '@/hooks/useProfilo'
import AttivaNotifiche from '@/components/AttivaNotifiche'
import ConnessioneDrive from '@/components/ConnessioneDrive'
import ModificaProfilo from '@/components/ModificaProfilo'

const ETICHETTE_RUOLO: Record<string, string> = {
  in_attesa: 'In attesa',
  passeggero: 'Passeggero',
  autista: 'Autista',
  admin: 'Admin',
}

export default function Profilo() {
  const { esci } = useAuth()
  const { profilo, isAdmin, ricarica } = useProfilo()

  if (!profilo) return null

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <h1 className="font-display text-2xl mb-6">PROFILO</h1>

      <ModificaProfilo profilo={profilo} onAggiornato={ricarica} />

      <span className="inline-block mb-5 text-xs font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5">
        {ETICHETTE_RUOLO[profilo.ruolo]}
      </span>

      <div className="mb-3">
        <AttivaNotifiche />
      </div>

      <div className="mb-3">
        <ConnessioneDrive />
      </div>

      {isAdmin && (
        <Link
          to="/utenti"
          className="card flex items-center justify-between mb-3 active:scale-[0.99] transition-transform duration-150"
        >
          <span className="flex items-center gap-3">
            <Shield size={20} className="text-accent" />
            <span className="font-medium">Gestione utenti</span>
          </span>
          <ChevronRight size={18} className="text-text-muted" />
        </Link>
      )}

      <button onClick={esci} className="btn-secondary w-full mt-6">
        <LogOut size={18} />
        Esci
      </button>
    </div>
  )
}
