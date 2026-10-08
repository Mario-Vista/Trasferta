import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfilo } from '@/hooks/useProfilo'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import InAttesa from '@/pages/InAttesa'
import Calendario from '@/pages/Calendario'
import EventoDettaglio from '@/pages/EventoDettaglio'
import NuovoEvento from '@/pages/NuovoEvento'
import Proposte from '@/pages/Proposte'
import Notifiche from '@/pages/Notifiche'
import Profilo from '@/pages/Profilo'
import Utenti from '@/pages/Utenti'

export default function App() {
  const { user, caricamento: caricamentoAuth } = useAuth()

  if (caricamentoAuth) return <SchermataDiCaricamento />

  if (!user) return <Login />

  return <AppApprovata />
}

function AppApprovata() {
  const { profilo, caricamento, isApprovato, isAutista, isAdmin } = useProfilo()

  if (caricamento || !profilo) return <SchermataDiCaricamento />

  if (!isApprovato) return <InAttesa />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Calendario />} />
        <Route path="/evento/:id" element={<EventoDettaglio />} />
        <Route path="/nuovo-evento" element={<NuovoEvento />} />
        <Route
          path="/proposte"
          element={isAutista ? <Proposte /> : <Navigate to="/" replace />}
        />
        <Route path="/notifiche" element={<Notifiche />} />
        <Route path="/profilo" element={<Profilo />} />
        <Route path="/utenti" element={isAdmin ? <Utenti /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SchermataDiCaricamento() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="font-display text-2xl text-accent animate-pulse">TRASFERTA→</span>
    </div>
  )
}
