// Edge Function: invia-push
//
// Collegata a un Database Webhook su INSERT di public.notifiche (vedi
// SPEC §5 e README §10.6). Per ogni nuova notifica, manda una push a tutte
// le iscrizioni dell'utente destinatario e ripulisce quelle scadute
// (il browser/OS risponde 404 o 410 quando un'iscrizione non è più valida).
//
// Variabili d'ambiente richieste (secrets, vedi README):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// Iniettate automaticamente da Supabase in ogni Edge Function:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { elaboraIscrizioni } from './logica.ts'

interface NotificaRow {
  id: string
  user_id: string
  tipo: string
  titolo: string
  corpo: string | null
  link: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: NotificaRow
}

function creaClienteSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!
  const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, chiaveServizio)
}

function configuraVapid() {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!pub || !priv || !subject) {
    throw new Error('Chiavi VAPID non configurate sul server.')
  }
  webpush.setVapidDetails(subject, pub, priv)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Metodo non supportato.', { status: 405 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Corpo non valido.', { status: 400 })
  }

  if (payload.table !== 'notifiche' || payload.type !== 'INSERT') {
    return new Response('ok', { status: 200 })
  }

  try {
    configuraVapid()
  } catch (e) {
    console.error('invia-push:', e)
    return new Response('Configurazione mancante.', { status: 500 })
  }

  const supabase = creaClienteSupabase()
  const notifica = payload.record

  const { data: iscrizioni, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notifica.user_id)

  if (error) {
    console.error('invia-push: errore nel leggere le iscrizioni', error)
    return new Response('Errore database.', { status: 500 })
  }

  if (!iscrizioni || iscrizioni.length === 0) {
    return new Response('ok (nessuna iscrizione)', { status: 200 })
  }

  const corpoPush = JSON.stringify({
    titolo: notifica.titolo,
    corpo: notifica.corpo ?? undefined,
    link: notifica.link ?? '/',
    tag: notifica.tipo,
  })

  const risultato = await elaboraIscrizioni(iscrizioni, corpoPush, async (iscrizione, corpo) => {
    await webpush.sendNotification(
      {
        endpoint: iscrizione.endpoint,
        keys: { p256dh: iscrizione.p256dh, auth: iscrizione.auth },
      },
      corpo
    )
  })

  if (risultato.idDaRimuovere.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', risultato.idDaRimuovere)
  }

  return new Response(
    JSON.stringify({
      inviate: risultato.inviateOk,
      fallite: risultato.fallite,
      rimosse: risultato.idDaRimuovere.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
