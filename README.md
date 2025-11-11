# ForMa - Convertitore di Eventi per Google Calendar

Questa è un'applicazione intelligente per estrarre eventi da file (Word, Excel, testo) o testo incollato, rivederli e importarli facilmente in Google Calendar o esportarli in formato CSV. Realizzata con l'IA di Gemini.

## Come eseguire l'applicazione in ambiente locale

Per eseguire questa applicazione sul tuo computer, segui questi passaggi.

### Prerequisiti

- **Node.js**: Assicurati di avere una versione recente di Node.js installata (preferibilmente v18 o superiore). Puoi scaricarla da [nodejs.org](https://nodejs.org/).

### 1. Clona o Scarica il Progetto

Se hai il progetto in un repository Git, clonalo. Altrimenti, scarica e decomprimi tutti i file in una cartella sul tuo computer.

### 2. Installa le Dipendenze

Apri un terminale o un prompt dei comandi nella cartella principale del progetto ed esegui il seguente comando per installare tutte le librerie necessarie:

```bash
npm install
```

### 3. Imposta la tua API Key di Gemini

L'applicazione richiede una chiave API di Google Gemini per funzionare.

1.  Crea un file chiamato `.env` nella cartella principale del progetto (allo stesso livello di `package.json`).
2.  Aggiungi la tua chiave API al file in questo formato:

```
VITE_API_KEY=LA_TUA_CHIAVE_API_GEMINI_QUI
```

**Importante:** Sostituisci `LA_TUA_CHIAVE_API_GEMINI_QUI` con la tua vera chiave. Il file `.env` è già incluso nel `.gitignore` per evitare che la tua chiave venga accidentalmente condivisa.

### 4. Avvia il Server di Sviluppo

Una volta completata l'installazione e configurata l'API key, avvia il server di sviluppo con questo comando:

```bash
npm run dev
```

Il terminale mostrerà un messaggio che indica che il server è in esecuzione e accessibile sulla tua rete locale. Cerca un output simile a questo:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.123:5173/  <-- Usa questo indirizzo dagli altri dispositivi
  ➜  press h to show help
```

### 5. Apri l'App nel Browser

*   **Sullo stesso computer:** Apri il tuo browser e naviga all'indirizzo `Local` (es. `http://localhost:5173`).
*   **Su altri dispositivi (telefono, tablet, altro computer):** Assicurati che il dispositivo sia connesso alla stessa rete Wi-Fi/LAN del computer che esegue il server. Apri il browser su quel dispositivo e naviga all'indirizzo `Network` (es. `http://192.168.1.123:5173`).

L'applicazione ForMa dovrebbe essere visibile e pronta all'uso.
