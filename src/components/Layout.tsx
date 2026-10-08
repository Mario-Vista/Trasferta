import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Calendar, Car, Bell, User, Plus } from 'lucide-react'
import { useProfilo } from '@/hooks/useProfilo'
import { useNotificheNonLette } from '@/hooks/useNotifiche'
import { useProposteInAttesa } from '@/hooks/useProposte'

export default function Layout() {
  const { isAutista } = useProfilo()
  const navigate = useNavigate()
  const nonLette = useNotificheNonLette()
  const proposte = useProposteInAttesa(isAutista)

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-24 safe-top">
        <Outlet />
      </main>

      <button
        onClick={() => navigate('/nuovo-evento')}
        aria-label="Nuovo evento"
        className="fixed right-5 bottom-24 z-20 w-14 h-14 rounded-full bg-accent text-bg flex items-center justify-center shadow-lg active:scale-95 transition-transform duration-150"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-surface border-t border-border safe-bottom">
        <div className="flex items-stretch max-w-lg mx-auto">
          <TabLink to="/" label="Calendario" icon={<Calendar size={22} />} />
          {isAutista && (
            <TabLink to="/proposte" label="Proposte" icon={<Car size={22} />} badge={proposte} />
          )}
          <TabLink to="/notifiche" label="Notifiche" icon={<Bell size={22} />} badge={nonLette} />
          <TabLink to="/profilo" label="Profilo" icon={<User size={22} />} />
        </div>
      </nav>
    </div>
  )
}

function TabLink({
  to,
  label,
  icon,
  badge,
}: {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[44px] relative transition-colors duration-150 ${
          isActive ? 'text-accent' : 'text-text-muted'
        }`
      }
    >
      <span className="relative">
        {icon}
        {!!badge && (
          <span className="badge absolute -top-1.5 -right-2.5">{badge > 9 ? '9+' : badge}</span>
        )}
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </NavLink>
  )
}
