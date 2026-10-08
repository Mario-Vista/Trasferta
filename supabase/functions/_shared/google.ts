// Helper per parlare con le API di Google (OAuth token refresh + Drive v3),
// condivisi tra crea-cartella-drive e, in futuro, altre function che
// tocchino il Drive dell'utente. Nessuna chiave o token qui dentro: arrivano
// sempre da chi chiama.

const GOOGLE_BASE = Deno.env.get('GOOGLE_BASE_URL') ?? 'https://oauth2.googleapis.com'
const DRIVE_BASE = Deno.env.get('DRIVE_BASE_URL') ?? 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = Deno.env.get('DRIVE_UPLOAD_BASE_URL') ?? 'https://www.googleapis.com/upload/drive/v3'

export class ErroreGoogle extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

/** Scambia un refresh token per un access token valido ~1 ora. */
export async function ottieniAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new ErroreGoogle('Credenziali Google non configurate sul server.', 500)
  }

  const res = await fetch(`${GOOGLE_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new ErroreGoogle(`Rifiuto nel rinnovare l'accesso a Google Drive: ${corpo}`, 502)
  }

  const dati = await res.json()
  return dati.access_token as string
}

/** Trova la cartella "Trasferta" nella radice del Drive dell'utente, o la crea se non c'è. */
export async function trovaOCreaCartellaRadice(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    "name = 'Trasferta' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false"
  )
  const res = await fetch(`${DRIVE_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new ErroreGoogle('Ricerca della cartella radice fallita.', 502)

  const dati = await res.json()
  if (dati.files?.[0]?.id) return dati.files[0].id

  return await creaCartella(accessToken, 'Trasferta', null)
}

/** Crea una cartella Drive, eventualmente dentro un'altra (parentId). */
export async function creaCartella(
  accessToken: string,
  nome: string,
  parentId: string | null
): Promise<string> {
  const res = await fetch(`${DRIVE_BASE}/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: nome,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new ErroreGoogle(`Creazione cartella fallita: ${corpo}`, 502)
  }

  const dati = await res.json()
  return dati.id as string
}

/** Condivide una cartella come "chiunque abbia il link può caricare/modificare". */
export async function condividiCartellaConLink(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'writer', type: 'anyone' }),
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new ErroreGoogle(`Condivisione della cartella fallita: ${corpo}`, 502)
  }
}

export function linkCartella(fileId: string): string {
  return `https://drive.google.com/drive/folders/${fileId}`
}

// DRIVE_UPLOAD_BASE non è ancora usata (nessun upload diretto dall'app in
// questa versione: si apre semplicemente il link della cartella), ma resta
// qui pronta per un'eventuale v2 con upload in-app.
void DRIVE_UPLOAD_BASE
