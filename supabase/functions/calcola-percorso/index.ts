// Edge Function: calcola-percorso
//
// Dato il nome di un luogo, calcola durata e distanza del tragitto in auto
// da Napoli Centrale (partenza fissa dell'app) usando OpenRouteService:
// prima geocodifica il testo in coordinate, poi chiede il percorso
// "driving-car". La chiave ORS resta solo qui nei secrets, mai nel
// frontend (vedi SPEC §9/§10).
//
// Richiesta:  POST { "luogo": "Arci Bellezza, Milano" }
// Risposta:   { durata_minuti, distanza_km, lat, lng, luogo_trovato }
//             oppure { errore: "..." } con status 422/502 se non si riesce
//             a calcolare (il frontend deve offrire l'inserimento manuale).

const NAPOLI_CENTRALE = { lat: 40.8527, lng: 14.2726 }

// Permette di puntare a un host ORS alternativo nei test locali (vedi
// supabase/functions/calcola-percorso/test_locale.ts). In produzione questa
// variabile non viene impostata, quindi si usa sempre l'host ufficiale.
const ORS_BASE = Deno.env.get('ORS_BASE_URL') ?? 'https://api.openrouteservice.org'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RichiestaBody {
  luogo?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return rispondiErrore('Metodo non supportato.', 405)
  }

  const orsKey = Deno.env.get('ORS_API_KEY')
  if (!orsKey) {
    return rispondiErrore('Chiave OpenRouteService non configurata sul server.', 500)
  }

  let body: RichiestaBody
  try {
    body = await req.json()
  } catch {
    return rispondiErrore('Corpo della richiesta non valido.', 400)
  }

  const luogo = body.luogo?.trim()
  if (!luogo) {
    return rispondiErrore('Manca il luogo da geocodificare.', 400)
  }

  try {
    const destinazione = await geocodifica(luogo, orsKey)
    if (!destinazione) {
      return rispondiErrore(`Non ho trovato "${luogo}" sulla mappa. Inserisci i dati a mano.`, 422)
    }

    const percorso = await calcolaDirezioni(NAPOLI_CENTRALE, destinazione, orsKey)
    if (!percorso) {
      return rispondiErrore('Non sono riuscito a calcolare il percorso in auto. Inserisci i dati a mano.', 422)
    }

    return new Response(
      JSON.stringify({
        durata_minuti: Math.round(percorso.durataSecondi / 60),
        distanza_km: Math.round((percorso.distanzaMetri / 1000) * 10) / 10,
        lat: destinazione.lat,
        lng: destinazione.lng,
        luogo_trovato: destinazione.etichetta,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('calcola-percorso:', e)
    return rispondiErrore('Il servizio di calcolo percorso non ha risposto. Inserisci i dati a mano.', 502)
  }
})

async function geocodifica(
  testo: string,
  apiKey: string
): Promise<{ lat: number; lng: number; etichetta: string } | null> {
  const url = new URL(`${ORS_BASE}/geocode/search`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('text', testo)
  url.searchParams.set('size', '1')
  // Senza boundary.country: le trasferte possono essere anche fuori Italia.

  const res = await fetch(url.toString())
  if (!res.ok) return null

  const dati = await res.json()
  const primo = dati?.features?.[0]
  if (!primo) return null

  const [lng, lat] = primo.geometry.coordinates
  return { lat, lng, etichetta: primo.properties?.label ?? testo }
}

async function calcolaDirezioni(
  partenza: { lat: number; lng: number },
  arrivo: { lat: number; lng: number },
  apiKey: string
): Promise<{ durataSecondi: number; distanzaMetri: number } | null> {
  const res = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [partenza.lng, partenza.lat],
        [arrivo.lng, arrivo.lat],
      ],
    }),
  })

  if (!res.ok) return null

  const dati = await res.json()
  const sommario = dati?.routes?.[0]?.summary
  if (!sommario) return null

  return { durataSecondi: sommario.duration, distanzaMetri: sommario.distance }
}

function rispondiErrore(errore: string, status: number): Response {
  return new Response(JSON.stringify({ errore }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
