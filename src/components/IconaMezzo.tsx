import { Car, TrainFront, Bus, Plane } from 'lucide-react'
import type { TipoViaggio } from '@/lib/database.types'

const ICONE: Record<TipoViaggio, typeof Car> = {
  auto: Car,
  treno: TrainFront,
  pullman: Bus,
  aereo: Plane,
}

export const ETICHETTA_MEZZO: Record<TipoViaggio, string> = {
  auto: 'Auto',
  treno: 'Treno',
  pullman: 'Pullman',
  aereo: 'Aereo',
}

export default function IconaMezzo({
  tipo,
  size = 18,
  className = '',
}: {
  tipo: TipoViaggio
  size?: number
  className?: string
}) {
  const Icona = ICONE[tipo]
  return <Icona size={size} className={className} />
}
