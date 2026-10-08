import { supabase } from './supabase'

export function pushSupportata(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iOS richiede che la PWA sia stata aggiunta alla Home per ricevere le push. */
export function eStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function eIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function statoPermesso(): Promise<NotificationPermission | 'non-supportato'> {
  if (!pushSupportata()) return 'non-supportato'
  return Notification.permission
}

/** Attiva le notifiche push: chiede il permesso (solo dopo un tap dell'utente,
 * come richiesto dalla SPEC) e salva l'iscrizione su Supabase. */
export async function attivaPush(userId: string): Promise<{ ok: boolean; errore?: string }> {
  if (!pushSupportata()) {
    return { ok: false, errore: 'Il tuo browser non supporta le notifiche push.' }
  }

  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') {
    return { ok: false, errore: 'Permesso negato. Puoi riattivarlo dalle impostazioni del browser.' }
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    return { ok: false, errore: 'Configurazione mancante (chiave VAPID).' }
  }

  const registrazione = await navigator.serviceWorker.ready
  let subscription = await registrazione.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registrazione.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidKey) as BufferSource,
    })
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, errore: 'Iscrizione non valida.' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )

  if (error) return { ok: false, errore: 'Non sono riuscito a salvare l\'iscrizione.' }

  return { ok: true }
}

export async function disattivaPush(): Promise<void> {
  if (!pushSupportata()) return
  const registrazione = await navigator.serviceWorker.ready
  const subscription = await registrazione.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

export async function pushAttiva(): Promise<boolean> {
  if (!pushSupportata()) return false
  const registrazione = await navigator.serviceWorker.ready
  const subscription = await registrazione.pushManager.getSubscription()
  return !!subscription
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
