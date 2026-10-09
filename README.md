# Trasferta

App per organizzare le trasferte della crew: calendario eventi, prenotazioni auto/treno/pullman/aereo, proposte da approvare, notifiche, cartelle foto automatiche su Google Drive. Tutto gratuito.

Questa guida presume che tu non abbia mai usato Supabase, Google Cloud o Cloudflare: segui i passi in ordine, non serve altro.

---

## Prima di iniziare

Ti servirà creare, tutti gratis:
1. Un account [Supabase](https://supabase.com) (il database e il backend)
2. Un progetto su [Google Cloud Console](https://console.cloud.google.com) (login con Google + foto su Drive)
3. Una chiave gratuita su [OpenRouteService](https://openrouteservice.org) (calcolo del percorso in auto)
4. Un account [Cloudflare](https://dash.cloudflare.com/sign-up) (dove vive il sito, su Cloudflare Pages)
5. Un repository GitHub con questo codice

Tieni questa pagina aperta: ogni sezione ti dice esattamente dove cliccare.

> **Hai già un progetto Trasferta in produzione e hai solo bisogno dell'ultimo aggiornamento?** Non devi rifare tutta la guida: vai su Supabase → **SQL Editor → New query**, incolla ed esegui **nell'ordine** `0008_notifiche_viaggi.sql`, poi `0009_profilo_custom.sql`, poi `0010_costo_viaggio.sql`, poi `0011_promemoria_e_notifiche.sql`, poi `0012_realtime_delete_fix.sql` (sono gli unici nuovi, i precedenti li hai già lanciati — uno alla volta, **Run** e passa al successivo). Poi ridistribuisci il frontend su Cloudflare Pages (basta una nuova push su GitHub, o **Deployments → ⋯ sull'ultimo deploy → Retry deployment**). Fine.

---

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com), crea un account e poi un **nuovo progetto** (scegli una password per il database e tienila da parte, servirà raramente ma è bene salvarla).
2. Aspetta che il progetto finisca di provisionarsi (un paio di minuti).
3. Nel menu a sinistra vai su **SQL Editor** → **New query**.
4. Apri, nell'ordine, i file dentro `supabase/migrations/` di questo repository (`0001_schema.sql`, `0002_rls.sql`, `0003_rpc.sql`, `0004_notifiche.sql`, `0005_drive.sql`, `0006_link_biglietto.sql`, `0007_realtime.sql`, `0008_notifiche_viaggi.sql`, `0009_profilo_custom.sql`, `0010_costo_viaggio.sql`, `0011_promemoria_e_notifiche.sql`, `0012_realtime_delete_fix.sql`), incolla il contenuto di ciascuno nell'editor e premi **Run**. Uno alla volta, nell'ordine numerico: ognuno si appoggia al precedente.
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

1. In Supabase vai su **Authentication → Sign In / Providers** (il nome della voce nel menu può variare leggermente a seconda della versione della dashboard; l'indirizzo diretto è `https://supabase.com/dashboard/project/<il-tuo-project-ref>/auth/providers`), poi apri **Google** nell'elenco.
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

**Metodo A — dalla dashboard:**

1. In Supabase vai su **Integrations → Webhooks** (il nome/posizione nel menu può variare leggermente a seconda della versione della dashboard; l'indirizzo diretto è `https://supabase.com/dashboard/project/<il-tuo-project-ref>/integrations/webhooks/overview`), poi **Create a new hook**.
2. Nome: "invia-push". Tabella: `notifiche`. Evento: **solo Insert**.
3. Tipo: **Edge Function**. Seleziona `invia-push`.
4. Salva.

Se ti dà errore `schema "supabase_functions" does not exist` (bug noto su alcuni progetti nuovi): prova prima **Settings → General → Restart project**, poi riprova. Se persiste, usa il Metodo B qui sotto, che ottiene lo stesso risultato senza passare da questa pagina.

**Metodo B — via SQL (bypassa il bug del Metodo A):**

In **SQL Editor → New query**, incolla sostituendo `<IL_TUO_PROJECT_URL>` e `<LA_TUA_ANON_KEY>` con i valori del punto 1.5:

```sql
create extension if not exists pg_net;

create or replace function public.notifica_invia_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := '<IL_TUO_PROJECT_URL>/functions/v1/invia-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<LA_TUA_ANON_KEY>',
      'Authorization', 'Bearer <LA_TUA_ANON_KEY>'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifiche',
      'record', row_to_json(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists invia_push_su_notifica on public.notifiche;

create trigger invia_push_su_notifica
after insert on public.notifiche
for each row
execute function public.notifica_invia_push();
```

L'anon key non è un segreto (è già visibile a chiunque usi l'app, nel frontend), quindi non c'è problema a scriverla qui.

Con uno dei due metodi, da ora ogni volta che una riga viene inserita in `notifiche` (succede automaticamente dai trigger già nel database) parte una chiamata alla funzione che manda le notifiche push.

**Per verificare che funzioni davvero** (dopo aver fatto login nell'app ed esserti iscritto alle notifiche dal Profilo): crea un evento di prova e controlla che arrivi la push sul telefono. Se non arriva, in SQL Editor lancia:
```sql
select status_code, content, error_msg from net._http_response order by created desc limit 5;
```
e guarda cosa è successo nell'ultima chiamata.

---

## 7. Deploy del frontend su Cloudflare Pages

1. Metti il codice di questo progetto su un repository GitHub (se non l'hai già fatto).
2. Su [dash.cloudflare.com](https://dash.cloudflare.com), **Workers & Pages → Create → Pages → Connect to Git**, collega il repository.
3. Impostazioni di build:
   - Framework preset: **None** (oppure **Vite**, è uguale)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Sempre in questa schermata, apri **Environment variables** e aggiungi (se il progetto è già creato le trovi in **Settings → Variables and Secrets**):
   - `VITE_SUPABASE_URL` = il Project URL di Supabase (punto 1.5)
   - `VITE_SUPABASE_ANON_KEY` = la anon public key (punto 1.5)
   - `VITE_VAPID_PUBLIC_KEY` = la Public Key VAPID (punto 4)

   Vengono lette **durante la build**: se le aggiungi o le cambi dopo, serve un nuovo deploy perché abbiano effetto.
5. Fai partire il deploy (**Save and Deploy**). Cloudflare Pages serve già da solo `index.html` per qualunque percorso, cosa necessaria perché l'app è una SPA (il file `public/_redirects` nel repository fa la stessa cosa).
6. Prendi l'URL che Cloudflare ti assegna (es. `https://trasferta-crew.pages.dev`) e torna un attimo su Google Cloud Console → le tue credenziali OAuth → aggiungi quell'URL anche tra le **Origini JavaScript autorizzate**. Poi torna su Supabase → **Authentication → URL Configuration**: metti lo stesso URL come **Site URL** e aggiungilo anche in **Redirect URLs** (insieme a `https://trasferta-crew.pages.dev/profilo`, usato quando si collega Google Drive). Se in precedenza il sito stava su un altro dominio (es. Netlify), togli da entrambe le parti il vecchio URL.

> In alternativa al collegamento con GitHub puoi pubblicare dal tuo computer: `npm run build` e poi `npx wrangler pages deploy dist`. In questo caso le variabili `VITE_...` vengono prese dal tuo file `.env` locale al momento della build.

---

## 8. Primo accesso e admin

1. Apri il sito su Cloudflare Pages, **"Entra con Google"** (deve essere un'email che hai aggiunto come utente di test al punto 2.1.3).
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
- **Un elemento sparisce/cambia per chi lo fa ma non per gli altri, finché non ricaricano a mano (in particolare: eliminare un viaggio)**: causa diversa dal punto successivo. Di default Postgres, in un DELETE, dice a Realtime solo la chiave primaria della riga cancellata — se il frontend è sottoscritto con un filtro su un'altra colonna (come `evento_id` su `viaggi`), quel filtro non si può valutare e l'evento viene scartato in silenzio. La migration `0012_realtime_delete_fix.sql` lo corregge impostando `replica identity full` sulle tabelle che ne hanno bisogno; se noti lo stesso sintomo altrove (un altro DELETE che non si propaga), è la stessa causa — serve la stessa correzione sulla tabella coinvolta.
- **Gli aggiornamenti si vedono solo ricaricando la pagina a mano**: hai saltato (o va rifatta) la migration `0007_realtime.sql` — le tabelle create via SQL non entrano da sole nel canale Realtime di Supabase, vanno aggiunte esplicitamente. Vai su SQL Editor e lancia:
  ```sql
  alter publication supabase_realtime add table public.profiles;
  alter publication supabase_realtime add table public.eventi;
  alter publication supabase_realtime add table public.viaggi;
  alter publication supabase_realtime add table public.partecipazioni;
  alter publication supabase_realtime add table public.notifiche;
  alter publication supabase_realtime add table public.voti_evento;
  ```
- **Le notifiche push non arrivano su iPhone**: su iOS funzionano solo se l'app è stata aggiunta alla schermata Home (richiede iOS 16.4+). L'app lo spiega da sola nella pagina Profilo.
- **Nella pagina Profilo non compare affatto il riquadro delle notifiche** (né il pulsante né un messaggio, proprio nulla): bug corretto in `src/lib/push.ts`/`src/components/AttivaNotifiche.tsx` — prima, se il service worker non rispondeva per qualunque motivo, il riquadro restava vuoto per sempre invece di mostrare un errore. Con l'ultimo aggiornamento, entro 5 secondi compare sempre o il pulsante o un messaggio esplicativo. Se dopo l'aggiornamento vedi ancora nulla:
  1. Apri `https://<il-tuo-sito>.pages.dev/sw.js` direttamente nel browser del telefono: deve mostrare del codice JavaScript. Se vedi una pagina bianca, un 404, o la stessa app (segno che il redirect SPA ha intercettato la richiesta), il service worker non è stato pubblicato correttamente — controlla il log dell'ultimo deploy su Cloudflare Pages (**Deployments → View details**) per errori nella build.
  2. Se `/sw.js` si apre correttamente ma il riquadro resta comunque vuoto, prova a disinstallare l'app dalla schermata Home (su iPhone) o a cancellare i dati del sito (su Android, impostazioni del browser → Siti → il tuo sito → Cancella dati) e riaprire da zero: a volte un service worker installato da una versione precedente resta bloccato in uno stato vecchio.
- **Le notifiche compaiono nella sezione "Notifiche" dell'app ma la push sul telefono non arriva mai**: significa che la scrittura in `notifiche` funziona (è quella che la pagina legge) ma la catena notifiche → `invia-push` → push non arriva in fondo. Controlla in ordine:
  1. **Hai davvero premuto "Attiva notifiche" dal Profilo, sul telefono, e accettato il permesso del browser/sistema?** Senza quel passaggio non esiste nessuna iscrizione da usare. Verifica in SQL Editor:
     ```sql
     select * from public.push_subscriptions
     where user_id = (select id from public.profiles where email = 'tuaemail@esempio.it');
     ```
     Se non torna nessuna riga, il problema è qui: ripeti l'attivazione dal telefono (su iPhone solo dopo aver aggiunto l'app alla Home, vedi sopra).
  2. **Il trigger verso `invia-push` esiste davvero?** (rilevante se hai usato il Metodo B): 
     ```sql
     select tgname from pg_trigger where tgname = 'invia_push_su_notifica';
     ```
     Se non c'è, rilancia lo script SQL del punto 6 (Metodo B).
  3. **Cosa ha risposto l'ultima chiamata?** (sempre con Metodo B):
     ```sql
     select status_code, content, error_msg, created from net._http_response order by created desc limit 5;
     ```
     - `status_code` vuoto/null con `error_msg` valorizzato → la chiamata di rete non è nemmeno partita (controlla di aver incollato l'URL giusto, con `https://` e senza `/` finale prima di `/functions/v1/invia-push`).
     - `status_code = 401` → `apikey`/`Authorization` sbagliati nello script SQL, o li hai invertiti con la Service Role Key per sbaglio.
     - `status_code = 500` con nel `content` un messaggio tipo "Chiavi VAPID non configurate" → vedi punto 4.
     - `status_code = 200` ma `content` dice `"ok (nessuna iscrizione)"` → la funzione ha risposto correttamente ma per quell'utente non c'era nessuna riga in `push_subscriptions`: torna al punto 1.
  4. **I secrets della funzione sono impostati davvero sul progetto giusto?**
     ```
     npx supabase secrets list --project-ref <il-tuo-project-ref>
     ```
     Devono comparire `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Se mancano, impostali (punto 5) e rifai il deploy della funzione: `npx supabase functions deploy invia-push --project-ref <il-tuo-project-ref>`.
  5. **I log della funzione**: dashboard Supabase → **Edge Functions → invia-push → Logs**. Qui si vede ogni chiamata ricevuta e ogni eventuale eccezione (es. una chiave VAPID incollata con spazi o a capo di troppo).
- **Il progetto Supabase "si è addormentato"**: il piano gratuito mette in pausa i progetti dopo circa una settimana senza nessuna richiesta. Si riattiva da solo al primo accesso, con qualche secondo di attesa in più.
- **"Calcola percorso" non funziona**: controlla di aver impostato `ORS_API_KEY` nei secrets (punto 5) e di aver fatto il deploy della funzione `calcola-percorso`.
- **Il promemoria "tra 4 giorni" non arriva mai**: la migration `0011_promemoria_e_notifiche.sql` abilita da sola l'estensione `pg_cron` e programma il lavoro giornaliero, ma su alcuni progetti la dashboard blocca `create extension pg_cron` dal SQL Editor. Controlla se è andata a buon fine:
  ```sql
  select * from cron.job where jobname = 'trasferta_promemoria_eventi';
  ```
  Se la query dà errore `relation "cron.job" does not exist`, vai su **Database → Extensions**, cerca "pg_cron", abilitala da lì, poi rilancia solo la parte finale di `0011_promemoria_e_notifiche.sql` (dal blocco `alter table public.eventi add column...` in giù). Per testarlo subito senza aspettare 4 giorni prima di un evento vero: `select public.invia_promemoria_eventi();` in SQL Editor.
