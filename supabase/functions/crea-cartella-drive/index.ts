// Edge Function: crea-cartella-drive
//
// Crea la cartella foto di un evento nel Google Drive di CHI HA CREATO
// L'EVENTO (eventi.creato_da) — ogni trasferta usa lo spazio gratuito di chi
// l'ha organizzata, non quello dell'admin (vedi SPEC task "Foto ricordo").
// La cartella finisce dentro una cartella radice "Trasferta" (creata la
// prima volta) e viene condivisa come "chiunque abbia il link può caricare".
//
// Richiesta:  POST { "evento_id": "..." }  con Authorization: Bearer <JWT utente>
// Risposta:   { url } oppure { errore, codice } — codice "manca_token" se il
//             creatore dell'evento non ha ancora collegato il suo Drive.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import {
  ErroreGoogle,
  condividiCartellaConLink,
  creaCartella,
  linkCartella,
  ottieniAccessToken,
  trovaOCreaCartellaRadice,
} from '../_shared/google.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return erroreRisposta('Metodo non supportato.', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return erroreRisposta('Manca il token di autenticazione.', 401)

  const clienteUtente = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: erroreUtente } = await clienteUtente.auth.getUser()
  if (erroreUtente || !userData?.user) return erroreRisposta('Utente non riconosciuto.', 401)

  let body: { evento_id?: string }
  try {
    body = await req.json()
  } catch {
    return erroreRisposta('Corpo della richiesta non valido.', 400)
  }
  if (!body.evento_id) return erroreRisposta('Manca l\'evento.', 400)

  const servizio = createClient(supabaseUrl, serviceRoleKey)

  const { data: evento, error: erroreEvento } = await servizio
    .from('eventi')
    .select('id, nome, data, creato_da, drive_folder_url')
    .eq('id', body.evento_id)
    .maybeSingle()

  if (erroreEvento || !evento) return erroreRisposta('Evento non trovato.', 404)

  if (evento.drive_folder_url) {
    return new Response(JSON.stringify({ url: evento.drive_folder_url }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { data: tokenRow } = await servizio
    .from('google_drive_tokens')
    .select('refresh_token, cartella_radice_id')
    .eq('user_id', evento.creato_da)
    .maybeSingle()

  if (!tokenRow) {
    return erroreRisposta(
      'Chi ha creato questo evento non ha ancora collegato il suo Google Drive.',
      409,
      'manca_token'
    )
  }

  try {
    const accessToken = await ottieniAccessToken(tokenRow.refresh_token)

    let cartellaRadiceId = tokenRow.cartella_radice_id
    if (!cartellaRadiceId) {
      cartellaRadiceId = await trovaOCreaCartellaRadice(accessToken)
      await servizio
        .from('google_drive_tokens')
        .update({ cartella_radice_id: cartellaRadiceId })
        .eq('user_id', evento.creato_da)
    }

    const nomeCartella = `${evento.nome} — ${evento.data}`
    const folderId = await creaCartella(accessToken, nomeCartella, cartellaRadiceId)
    await condividiCartellaConLink(accessToken, folderId)

    const url = linkCartella(folderId)

    await servizio
      .from('eventi')
      .update({
        drive_folder_url: url,
        drive_folder_id: folderId,
        drive_cartella_proprietario: evento.creato_da,
      })
      .eq('id', evento.id)

    return new Response(JSON.stringify({ url }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('crea-cartella-drive:', e)
    const status = e instanceof ErroreGoogle ? e.status : 502
    return erroreRisposta(
      'Non sono riuscito a creare la cartella su Google Drive. Riprova più tardi.',
      status
    )
  }
})

function erroreRisposta(messaggio: string, status: number, codice?: string): Response {
  return new Response(JSON.stringify({ errore: messaggio, codice }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
