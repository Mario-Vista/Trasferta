// Tipi scritti a mano sullo schema di supabase/migrations/000*.sql.
// Se cambi le migration, aggiorna anche questo file (o rigeneralo con
// `supabase gen types typescript` una volta collegato al progetto vero).

export type Ruolo = 'in_attesa' | 'passeggero' | 'autista' | 'admin'
export type StatoEvento = 'proposto' | 'attivo' | 'annullato'
export type TipoViaggio = 'auto' | 'treno' | 'pullman' | 'aereo'
export type StatoViaggio = 'in_attesa' | 'confermato' | 'annullato'
export type StatoPartecipazione = 'in_attesa' | 'confermata' | 'rifiutata'

export interface Profile {
  id: string
  email: string
  nome: string
  avatar_url: string | null
  nome_google: string | null
  avatar_url_google: string | null
  ruolo: Ruolo
  created_at: string
}

export interface Evento {
  id: string
  nome: string
  data: string
  ora: string | null
  luogo: string
  lat: number | null
  lng: number | null
  organizzatore: string | null
  premio: string | null
  stato: StatoEvento
  creato_da: string
  created_at: string
  drive_folder_url: string | null
  drive_folder_id: string | null
  drive_cartella_proprietario: string | null
  promemoria_inviato: boolean
}

export interface EventoConMedia extends Evento {
  media_stelle: number
  numero_voti: number
  creatore_nome: string | null
  creatore_avatar_url: string | null
}

export interface VotoEvento {
  evento_id: string
  user_id: string
  stelle: number
  created_at: string
}

export interface Viaggio {
  id: string
  evento_id: string
  tipo: TipoViaggio
  stato: StatoViaggio
  autista_id: string | null
  proposto_da: string
  posti_passeggeri: number | null
  ora_partenza: string | null
  partenza: string
  durata_minuti: number | null
  distanza_km: number | null
  durata_calcolata: boolean
  costo_viaggio: number | null
  costo_biglietto: number | null
  link_biglietto: string | null
  note: string | null
  created_at: string
}

export interface Partecipazione {
  viaggio_id: string
  user_id: string
  stato: StatoPartecipazione
  created_at: string
}

export interface Notifica {
  id: string
  user_id: string
  tipo: string
  titolo: string
  corpo: string | null
  link: string | null
  letta: boolean
  created_at: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      eventi: { Row: Evento; Insert: Partial<Evento>; Update: Partial<Evento> }
      voti_evento: { Row: VotoEvento; Insert: Partial<VotoEvento>; Update: Partial<VotoEvento> }
      viaggi: { Row: Viaggio; Insert: Partial<Viaggio>; Update: Partial<Viaggio> }
      partecipazioni: {
        Row: Partecipazione
        Insert: Partial<Partecipazione>
        Update: Partial<Partecipazione>
      }
      notifiche: { Row: Notifica; Insert: Partial<Notifica>; Update: Partial<Notifica> }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Partial<PushSubscriptionRow>
        Update: Partial<PushSubscriptionRow>
      }
    }
    Views: {
      eventi_con_media: { Row: EventoConMedia }
    }
    Functions: {
      prenota: { Args: { p_viaggio_id: string }; Returns: void }
      lascia: { Args: { p_viaggio_id: string }; Returns: void }
      accetta_passeggero: { Args: { p_viaggio_id: string; p_user_id: string }; Returns: void }
      rifiuta_passeggero: { Args: { p_viaggio_id: string; p_user_id: string }; Returns: void }
      approva_proposta: { Args: { p_viaggio_id: string }; Returns: void }
      rifiuta_proposta: { Args: { p_viaggio_id: string }; Returns: void }
      imposta_ruolo: { Args: { p_user_id: string; p_ruolo: Ruolo }; Returns: void }
    }
  }
}
