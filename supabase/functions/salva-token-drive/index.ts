// Edge Function: salva-token-drive
//
// Il frontend la chiama subito dopo che l'utente ha dato il consenso
// incrementale per Google Drive (scope drive.file + accesso offline).
// Verifica chi è l'utente dal suo JWT, poi salva il refresh token con la
// service role: il client non scrive mai direttamente in
// google_drive_tokens (vedi 0005_drive.sql, nessuna policy RLS per lui).
//
// Richiesta:  POST { "refresh_token": "..." }  con Authorization: Bearer <JWT utente>
// Risposta:   { ok: true } oppure { errore: "..." }

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return errore('Metodo non supportato.', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errore('Manca il token di autenticazione.', 401)

  // Verifica l'utente con la sua stessa richiesta (anon key + suo JWT),
  // così sappiamo con certezza per chi stiamo salvando il token.
  const clienteUtente = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: erroreUtente } = await clienteUtente.auth.getUser()
  if (erroreUtente || !userData?.user) return errore('Utente non riconosciuto.', 401)

  let body: { refresh_token?: string }
  try {
    body = await req.json()
  } catch {
    return errore('Corpo della richiesta non valido.', 400)
  }

  if (!body.refresh_token) return errore('Manca il refresh token.', 400)

  const clienteServizio = createClient(supabaseUrl, serviceRoleKey)
  const { error: erroreUpsert } = await clienteServizio.from('google_drive_tokens').upsert(
    {
      user_id: userData.user.id,
      refresh_token: body.refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (erroreUpsert) {
    console.error('salva-token-drive:', erroreUpsert)
    return errore('Non sono riuscito a salvare la connessione a Drive.', 500)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})

function errore(messaggio: string, status: number): Response {
  return new Response(JSON.stringify({ errore: messaggio }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
