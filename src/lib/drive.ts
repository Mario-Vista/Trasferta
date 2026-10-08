import { supabase } from './supabase'

/** Chiede il consenso incrementale per Google Drive (scope drive.file +
 * accesso offline). Fa un redirect vero: al ritorno, onAuthStateChange in
 * useAuth.tsx intercetta il provider_refresh_token e lo salva. */
export async function connettiDrive() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/drive.file',
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: window.location.origin + '/profilo',
    },
  })
}

/** Salva il refresh token appena ottenuto dal consenso, chiamando la Edge
 * Function dedicata (il client non scrive mai direttamente nella tabella).
 * L'autenticazione dell'utente passa in automatico (sessione corrente). */
export async function salvaRefreshTokenDrive(refreshToken: string) {
  const { error } = await supabase.functions.invoke('salva-token-drive', {
    body: { refresh_token: refreshToken },
  })
  return !error
}

export async function creaCartellaFoto(
  eventoId: string
): Promise<{ url?: string; errore?: string; codice?: string }> {
  const { data, error } = await supabase.functions.invoke('crea-cartella-drive', {
    body: { evento_id: eventoId },
  })
  if (error) {
    // Il body dell'errore (con "errore"/"codice") arriva nel context della FunctionsHttpError.
    const corpo = (error as { context?: { errore?: string; codice?: string } }).context
    return { errore: corpo?.errore ?? 'Non sono riuscito a creare la cartella.', codice: corpo?.codice }
  }
  return { url: data?.url }
}

export async function isDriveConnesso(): Promise<boolean> {
  const { data } = await supabase.rpc('drive_connesso')
  return !!data
}
