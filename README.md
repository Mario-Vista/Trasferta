# Trasferta

App per organizzare le trasferte della crew: calendario eventi, prenotazioni auto/treno/pullman/aereo, proposte da approvare, notifiche, cartelle foto automatiche su Google Drive. Tutto gratuito.

Questa guida presume che tu non abbia mai usato Supabase, Google Cloud o Netlify: segui i passi in ordine, non serve altro.

---

## Prima di iniziare

Ti servirà creare, tutti gratis:
1. Un account [Supabase](https://supabase.com) (il database e il backend)
2. Un progetto su [Google Cloud Console](https://console.cloud.google.com) (login con Google + foto su Drive)
3. Una chiave gratuita su [OpenRouteService](https://openrouteservice.org) (calcolo del percorso in auto)
4. Un account [Netlify](https://netlify.com) (dove vive il sito)
5. Un repository GitHub con questo codice

Tieni questa pagina aperta: ogni sezione ti dice esattamente dove cliccare.

---

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com), crea un account e poi un **nuovo progetto** (scegli una password per il database e tienila da parte, servirà raramente ma è bene salvarla).
2. Aspetta che il progetto finisca di provisionarsi (un paio di minuti).
3. Nel menu a sinistra vai su **SQL Editor** → **New query**.
4. Apri, nell'ordine, i file dentro `supabase/migrations/` di questo repository (`0001_schema.sql`, `0002_rls.sql`, `0003_rpc.sql`, `0004_notifiche.sql`, `0005_drive.sql`, `0006_link_biglietto.sql`), incolla il contenuto di ciascuno nell'editor e premi **Run**. Uno alla volta, nell'ordine numerico: ognuno si appoggia al precedente.
5. Vai su **Project Settings → API**. Ti serviranno due valori più avanti:
   - **Project URL**
   - **anon public key**

Non chiudere questa scheda, torneremo qui.

---

## 2. Credenziali Google (login + Drive)

### 2.1 Crea il progetto Google Cloud

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) e crea un nuovo progetto (es. "Trasferta").
2. Nel menu vai su **API e servizi → Schermata consenso OAuth**.
   - Tipo utente: **Esterno**.
   - Nome app: "Trasferta". Email di supporto: la tua. Logo facoltativo.
   - Nella sezione **Ambiti (scopes)**, aggiungi `.../auth/userinfo.email`, `.../auth/userinfo.profile` e `https://www.googleapis.com/auth/drive.file`.
   - Salva. L'app resterà in stato **"Testing"**: va benissimo, anzi è quello che vogliamo (vedi riquadro sotto).
3. Vai su **API e servizi → Utenti di test** e aggiungi l'email Google di ogni persona della crew che userà l'app (compresa la tua). Un'app in "Testing" funziona **solo** per le email che metti qui, fino a 100.
4. Vai su **API e servizi → Libreria**, cerca **Google Drive API** e attivala (pulsante "Abilita").
5. Vai su **API e servizi → Credenziali → Crea credenziali → ID client OAuth**.
   - Tipo applicazione: **Applicazione web**.
   - URI di reindirizzamento autorizzati: aggiungi `https://<il-tuo-project-ref>.supabase.co/auth/v1/callback` (trovi `<il-tuo-project-ref>` nel Project URL di Supabase, è la parte prima di `.supabase.co`).
   - Crea, e **copia Client ID e Client secret**: ti servono sia per Supabase (punto 2.2) sia per le Edge Function di Drive (punto 5).

> **Perché l'app resta "non verificata" e va bene così.** Finché l'app è in modalità Testing, chi prova ad accedere con un'email che non hai aggiunto come "utente di test" non riesce a entrare, e chi hai aggiunto vede una schermata "App non verificata da Google" prima del consenso: è normale, basta cliccare **Avanzate → Vai su Trasferta (non sicuro)**. Per un gruppo di amici è l'opzione giusta: la verifica ufficiale di Google serve solo se l'app diventasse pubblica per sconosciuti, ed è un processo lungo che qui non serve.

### 2.2 Collega Google a Supabase (per il login)

1. In Supabase vai su **Authentication → Providers → Google**.
2. Attivalo, incolla **Client ID** e **Client secret** presi al punto precedente.
3. Salva.

---

## 3. Chiave OpenRouteService

1. Vai su [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup) e crea un account gratuito.
2. Crea una nuova **token/API key** (piano gratuito, decine di migliaia di richieste al mese: più che sufficienti).
3. Copia la chiave, ti serve al punto 5.

---

## 4. Chiavi VAPID (per le notifiche push)

Sul tuo computer, con Node.js installato:

```bash
npx web-push generate-vapid-keys
```

Ti stampa una **Public Key** e una **Private Key**. Tienile da parte.

---

## 5. Edge Functions: secrets e deploy

Installa la [CLI di Supabase](https://supabase.com/docs/guides/cli) se non l'hai già, poi da dentro la cartella di questo progetto:

```bash
supabase login
supabase link --project-ref <il-tuo-project-ref>
```

Imposta i secrets (sostituisci con i tuoi valori reali):

```bash
supabase secrets set ORS_API_KEY=xxxxx
supabase secrets set VAPID_PUBLIC_KEY=xxxxx
supabase secrets set VAPID_PRIVATE_KEY=xxxxx
supabase secrets set VAPID_SUBJECT=mailto:tuaemail@esempio.it
supabase secrets set GOOGLE_CLIENT_ID=xxxxx
supabase secrets set GOOGLE_CLIENT_SECRET=xxxxx
```

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili automaticamente in ogni Edge Function, non vanno impostate a mano.)

Poi fai il deploy delle quattro funzioni:

```bash
supabase functions deploy calcola-percorso
supabase functions deploy invia-push
supabase functions deploy salva-token-drive
supabase functions deploy crea-cartella-drive
```

---

## 6. Database Webhook (notifiche → push)

1. In Supabase vai su **Database → Webhooks → Create a new webhook**.
2. Nome: "invia-push". Tabella: `notifiche`. Evento: **solo Insert**.
3. Tipo: **Edge Function**. Seleziona `invia-push`.
4. Salva.

Da ora, ogni volta che una riga viene inserita in `notifiche` (succede automaticamente dai trigger già nel database), questo webhook chiama la funzione che manda le notifiche push.

---

## 7. Deploy del frontend su Netlify

1. Metti il codice di questo progetto su un repository GitHub (se non l'hai già fatto).
2. Su [netlify.com](https://netlify.com), **Add new site → Import an existing project**, collega il repository.
3. Impostazioni di build:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In **Site settings → Environment variables**, aggiungi:
   - `VITE_SUPABASE_URL` = il Project URL di Supabase (punto 1.5)
   - `VITE_SUPABASE_ANON_KEY` = la anon public key (punto 1.5)
   - `VITE_VAPID_PUBLIC_KEY` = la Public Key VAPID (punto 4)
5. Fai partire il deploy (il file `public/_redirects` già nel repository dice a Netlify di servire sempre `index.html`, necessario perché l'app è una SPA).
6. Prendi l'URL che Netlify ti assegna (es. `https://trasferta-crew.netlify.app`) e torna un attimo su Google Cloud Console → le tue credenziali OAuth → aggiungi quell'URL anche tra le **Origini JavaScript autorizzate**. Poi torna su Supabase → **Authentication → URL Configuration** e aggiungi lo stesso URL in **Redirect URLs**.

---

## 8. Primo accesso e admin

1. Apri il sito Netlify, **"Entra con Google"** (deve essere un'email che hai aggiunto come utente di test al punto 2.1.3).
2. Vedrai la schermata "L'admin deve ancora abilitarti": è normale, nessuno ha ancora un ruolo.
3. Torna su Supabase → **SQL Editor** e lancia:
   ```sql
   update public.profiles set ruolo = 'admin' where email = 'tuaemail@esempio.it';
   ```
4. Ricarica l'app: ora sei admin. Da **Profilo → Gestione utenti** puoi abilitare gli altri come autisti o passeggeri man mano che entrano.

---

## 9. (Facoltativo) Foto su Google Drive

Non serve altro setup oltre a quanto già fatto: ogni persona, quando crea un evento, può premere **"Crea cartella foto"** nel dettaglio dell'evento. La prima volta le verrà chiesto di collegare il proprio Google Drive (stesso schermo di consenso Google, stavolta con il permesso aggiuntivo per i file): dopo quel singolo consenso, ogni nuovo evento che quella persona crea ottiene da sola una cartella dentro una cartella "Trasferta" sul suo Drive, condivisa come "chiunque abbia il link può caricare".

Le foto restano nello spazio gratuito di chi ha creato l'evento (15GB per account Google). Se un giorno si riempie, quella persona può liberare spazio o passare a Google One; non è un problema dell'app.

---

## Problemi comuni

- **"App non verificata" bloccante, non c'è "Avanzate"**: controlla di aver aggiunto quell'email tra gli utenti di test (punto 2.1.3).
- **Le notifiche push non arrivano su iPhone**: su iOS funzionano solo se l'app è stata aggiunta alla schermata Home (richiede iOS 16.4+). L'app lo spiega da sola nella pagina Profilo.
- **Il progetto Supabase "si è addormentato"**: il piano gratuito mette in pausa i progetti dopo circa una settimana senza nessuna richiesta. Si riattiva da solo al primo accesso, con qualche secondo di attesa in più.
- **"Calcola percorso" non funziona**: controlla di aver impostato `ORS_API_KEY` nei secrets (punto 5) e di aver fatto il deploy della funzione `calcola-percorso`.
