import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

/** "3 ore fa" */
export function formattaTempoFa(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { locale: it, addSuffix: true })
}

/** "sab 14 nov" */
export function formattaDataBreve(data: string): string {
  return format(parseISO(data), 'EEE d MMM', { locale: it })
}

/** "Sabato 14 Novembre 2026" */
export function formattaDataEstesa(data: string): string {
  const s = format(parseISO(data), 'EEEE d MMMM yyyy', { locale: it })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formattaMese(data: string): string {
  const s = format(parseISO(data), 'MMMM yyyy', { locale: it })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function eventoPassato(data: string): boolean {
  return isPast(parseISO(data + 'T23:59:59'))
}

/** 275 -> "4 h 35 min", 45 -> "45 min" */
export function formattaDurata(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export function formattaOrario(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

export function formattaEuro(valore: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore)
}

export function formattaKm(km: number): string {
  return `${Math.round(km)} km`
}
