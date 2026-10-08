// Logica pura di invio/pulizia, separata da index.ts per poterla testare
// senza dipendere dalla rete reale (vedi logica.test.ts).

export interface Iscrizione {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface RisultatoInvio {
  inviateOk: number
  fallite: number
  idDaRimuovere: string[]
}

/**
 * Prova a inviare `corpoPush` a ogni iscrizione con `inviaFn` (di solito
 * webpush.sendNotification). Le iscrizioni che rispondono 404/410 (non più
 * valide) finiscono in idDaRimuovere, da cancellare dal database; gli altri
 * errori vengono solo loggati, la riga resta (potrebbe essere un problema
 * temporaneo del push service).
 */
export async function elaboraIscrizioni(
  iscrizioni: Iscrizione[],
  corpoPush: string,
  inviaFn: (iscrizione: Iscrizione, corpo: string) => Promise<void>,
  log: (...args: unknown[]) => void = console.error
): Promise<RisultatoInvio> {
  const idDaRimuovere: string[] = []
  let inviateOk = 0
  let fallite = 0

  await Promise.all(
    iscrizioni.map(async (iscrizione) => {
      try {
        await inviaFn(iscrizione, corpoPush)
        inviateOk++
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          idDaRimuovere.push(iscrizione.id)
        } else {
          fallite++
          log('invia-push: invio fallito', status, e)
        }
      }
    })
  )

  return { inviateOk, fallite, idDaRimuovere }
}
