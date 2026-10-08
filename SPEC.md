
---

## 13. Modifiche in corso d'opera (rispetto alla v1 originale)

- **Prenotazione auto in due fasi**: `prenota()` su un'auto non conferma subito il posto, lo mette `in_attesa`. L'autista vede le richieste **in ordine cronologico** (dalla prima all'ultima) e le accetta/rifiuta con `accetta_passeggero()` / `rifiuta_passeggero()`. Solo da confermata la richiesta occupa uno dei 4 posti. Treno/pullman/aereo restano a conferma immediata (nessun limite di posti).
- **Notifica orario di partenza**: quando l'orario (`ora_partenza`) di un viaggio viene impostato o cambiato, in qualsiasi momento (alla creazione o dopo), tutti i partecipanti **confermati** di quel viaggio ricevono una notifica con il nuovo orario.
- **Link biglietto per i mezzi non auto**: per i viaggi in treno/pullman/aereo (mai per l'auto) si può salvare un link al biglietto già acquistato (`viaggi.link_biglietto`, migration `0006_link_biglietto.sql`), modificabile dalla stessa card "Modifica viaggio" dove si inseriscono orario, durata e costo. Chi partecipa lo vede come link cliccabile "Vedi il biglietto" sulla card del viaggio.
