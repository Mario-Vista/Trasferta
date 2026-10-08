import { elaboraIscrizioni, type Iscrizione } from './logica.ts'

function assertEquals(attuale: unknown, atteso: unknown, messaggio?: string) {
  const a = JSON.stringify(attuale)
  const b = JSON.stringify(atteso)
  if (a !== b) {
    throw new Error(`${messaggio ?? 'Assert fallito'}\n  atteso:  ${b}\n  ottenuto: ${a}`)
  }
}

const ISCRIZIONI: Iscrizione[] = [
  { id: 'ok-1', endpoint: 'e1', p256dh: 'p', auth: 'a' },
  { id: 'scaduta-404', endpoint: 'e2', p256dh: 'p', auth: 'a' },
  { id: 'scaduta-410', endpoint: 'e3', p256dh: 'p', auth: 'a' },
  { id: 'errore-temporaneo-500', endpoint: 'e4', p256dh: 'p', auth: 'a' },
  { id: 'ok-2', endpoint: 'e5', p256dh: 'p', auth: 'a' },
]

function erroreConStatus(status: number) {
  const e = new Error('finto') as Error & { statusCode: number }
  e.statusCode = status
  return e
}

async function invioFinto(iscrizione: Iscrizione) {
  if (iscrizione.id === 'scaduta-404') throw erroreConStatus(404)
  if (iscrizione.id === 'scaduta-410') throw erroreConStatus(410)
  if (iscrizione.id === 'errore-temporaneo-500') throw erroreConStatus(500)
  // ok-1 e ok-2: nessun errore, invio riuscito
}

Deno.test('elaboraIscrizioni: conta correttamente successi, rimuove solo 404/410, logga il resto', async () => {
  const logChiamate: unknown[][] = []
  const risultato = await elaboraIscrizioni(ISCRIZIONI, 'payload', invioFinto, (...args) =>
    logChiamate.push(args)
  )

  assertEquals(risultato.inviateOk, 2, 'le due iscrizioni sane devono risultare inviate')
  assertEquals(risultato.fallite, 1, 'solo l\'errore 500 deve contare come fallita (non rimossa)')
  assertEquals(
    risultato.idDaRimuovere.sort(),
    ['scaduta-404', 'scaduta-410'],
    '404 e 410 devono finire tra quelle da rimuovere'
  )
  assertEquals(logChiamate.length, 1, 'solo l\'errore 500 deve essere loggato')
})

Deno.test('elaboraIscrizioni: nessuna iscrizione -> tutto a zero, nessun errore', async () => {
  const risultato = await elaboraIscrizioni([], 'payload', invioFinto)
  assertEquals(risultato.inviateOk, 0)
  assertEquals(risultato.fallite, 0)
  assertEquals(risultato.idDaRimuovere, [])
})

Deno.test('elaboraIscrizioni: tutte riuscite', async () => {
  const soloSane = ISCRIZIONI.filter((i) => i.id.startsWith('ok'))
  const risultato = await elaboraIscrizioni(soloSane, 'payload', invioFinto)
  assertEquals(risultato.inviateOk, 2)
  assertEquals(risultato.fallite, 0)
  assertEquals(risultato.idDaRimuovere, [])
})

Deno.test('elaboraIscrizioni: un errore senza statusCode (es. di rete) conta come fallita, non rimossa', async () => {
  const iscrizione: Iscrizione = { id: 'rete-giu', endpoint: 'e', p256dh: 'p', auth: 'a' }
  const risultato = await elaboraIscrizioni(
    [iscrizione],
    'payload',
    async () => {
      throw new Error('connection error')
    },
    () => {}
  )
  assertEquals(risultato.inviateOk, 0)
  assertEquals(risultato.fallite, 1)
  assertEquals(risultato.idDaRimuovere, [])
})
