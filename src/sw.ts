/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope

import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

interface PayloadPush {
  titolo: string
  corpo?: string
  link?: string
  tag?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let dati: PayloadPush = { titolo: 'Trasferta' }
  try {
    if (event.data) dati = event.data.json()
  } catch {
    // payload non JSON, si usa il titolo di default
  }

  event.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.corpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: dati.tag,
      data: { link: dati.link ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const link = (event.notification.data?.link as string) ?? '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await (client as WindowClient).navigate(link)
          return
        }
      }

      await self.clients.openWindow(link)
    })()
  )
})
