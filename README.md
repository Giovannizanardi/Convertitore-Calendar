# ForMa - Suite per Calendari

Benvenuto in ForMa, la tua suite intelligente per gestire i calendari in modo efficiente. Con ForMa, puoi trasformare elenchi di eventi da vari formati in appuntamenti pronti per essere importati, oppure fare pulizia nel tuo Google Calendar eliminando eventi superflui con l'aiuto dell'intelligenza artificiale.

## Indice

- [Guida per l'Utente](#guida-per-lutente)
  - [Schermata Principale (Dashboard)](#schermata-principale-dashboard)
  - [Aggiungere Eventi in Blocco (Importazione)](#aggiungere-eventi-in-blocco-importazione)
    - [Passaggio 1: Fornire i Dati](#passaggio-1-fornire-i-dati)
    - [Passaggio 2: Revisione e Modifica](#passaggio-2-revisione-e-modifica)
    - [Passaggio 3: Salvataggio ed Esportazione](#passaggio-3-salvataggio-ed-esportazione)
  - [Pulire il Calendario](#pulire-il-calendario)
    - [Passaggio 1: Connessione a Google Calendar](#passaggio-1-connessione-a-google-calendar)
    - [Passaggio 2: Ricerca degli Eventi](#passaggio-2-ricerca-degli-eventi)
    - [Passaggio 3: Eliminazione](#passaggio-3-eliminazione)
  - [Personalizzazione del Tema](#personalizzazione-del-tema)
- [Per Sviluppatori: Eseguire l'Applicazione in Ambiente Locale](#per-sviluppatori-eseguire-lapplicazione-in-ambiente-locale)

---

## Guida per l'Utente

### Schermata Principale (Dashboard)

All'avvio, la Dashboard ti presenta due opzioni principali:

1.  **Aggiungi Eventi in Blocco**: Per creare nuovi eventi da un file o da testo.
2.  **Pulisci Calendario**: Per trovare ed eliminare eventi esistenti dal tuo Google Calendar.

### Aggiungere Eventi in Blocco (Importazione)

Questa funzione, basata sull'IA di Gemini, estrae le informazioni degli eventi da diverse fonti e le prepara per l'importazione.

#### Passaggio 1: Fornire i Dati

Hai due modi per inserire i tuoi dati:

-   **Carica File**: Clicca o trascina uno o più file (Word, Excel, TXT, PDF, immagini) nell'area di caricamento. L'IA analizzerà il contenuto per trovare gli eventi.
-   **Incolla Testo o Immagine**: Incolla direttamente il testo con l'elenco dei tuoi eventi o un'immagine (come uno screenshot) nell'area di testo.

Dopo aver fornito i dati, clicca su **"Elabora e Visualizza Anteprima Eventi"**.

#### Passaggio 2: Revisione e Modifica

In questa schermata vedrai una tabella con tutti gli eventi che l'IA è riuscita a estrarre. Qui puoi:

-   **Correggere i Dati**: Clicca su qualsiasi campo per modificarlo. Le celle con dati non validi (es. una data in formato errato) saranno evidenziate in rosso.
-   **Usare l'IA per le Correzioni**: Se un campo è non valido, apparirà un'icona a forma di scintilla (✨). Cliccandola, l'IA suggerirà una correzione plausibile.
-   **Aggiungere o Eliminare Eventi**: Usa i pulsanti per aggiungere una nuova riga vuota o eliminare un evento.
-   **Selezione Multipla e Modifica in Blocco**: Seleziona più eventi spuntando le caselle. Apparirà un pannello per applicare modifiche (come luogo, descrizione o durata) a tutti gli eventi selezionati contemporaneamente.
-   **Filtrare e Ordinare**: Usa i campi di ricerca sopra la tabella per filtrare gli eventi o clicca sulle intestazioni delle colonne per ordinarli.

Una volta che sei soddisfatto, clicca su **"Procedi..."**. Il pulsante sarà attivo solo se tutti gli eventi selezionati (o tutti, se non ne selezioni nessuno) sono validi.

#### Passaggio 3: Salvataggio ed Esportazione

Hai diverse opzioni per salvare i tuoi eventi:

-   **Importa in Google Calendar (Consigliato)**: Connettiti al tuo account Google e importa gli eventi direttamente in uno dei tuoi calendari.
-   **Scarica come .CSV**: Genera un file CSV formattato per l'importazione manuale in Google Calendar.
-   **Scarica come .ICS (Universale)**: Esporta un file .ics compatibile con la maggior parte delle applicazioni di calendario (Apple Calendar, Outlook, ecc.).
-   **Scarica come .JSON**: Per usi tecnici o di sviluppo.

### Pulire il Calendario

Questa funzione ti aiuta a trovare ed eliminare rapidamente eventi superflui dal tuo Google Calendar.

#### Passaggio 1: Connessione a Google Calendar

Clicca su **"Connetti Google Calendar"** e autorizza l'applicazione ad accedere ai tuoi calendari. Una volta connesso, vedrai l'interfaccia di ricerca.

#### Passaggio 2: Ricerca degli Eventi

Puoi trovare gli eventi in due modi:

1.  **Ricerca con IA**: Scrivi una richiesta in linguaggio naturale nel campo di ricerca "Compilazione Automatica Filtri". Ad esempio:
    -   `"Colloqui dicembre 2024"`
    -   `"Riunioni settimana prossima in ufficio"`
    -   `"Tutte le lezioni di yoga del 2023"`
    L'IA compilerà automaticamente i filtri sottostanti per te ed eseguirà la ricerca.

2.  **Filtri Manuali**: Compila i campi (Data Inizio, Data Fine, Testo, Luogo) e clicca su **"Cerca con questi Filtri"**.

I risultati della ricerca appariranno in una lista sotto i filtri.

#### Passaggio 3: Eliminazione

-   Seleziona gli eventi che desideri rimuovere spuntando le caselle corrispondenti.
-   Puoi usare la casella in cima alla lista per selezionare/deselezionare tutti gli eventi trovati.
-   Clicca sul pulsante **"Elimina X Eventi"**. Ti verrà chiesta una conferma prima di procedere, poiché l'azione è irreversibile.

### Personalizzazione del Tema

Clicca sull'icona della tavolozza (🎨) nell'intestazione per aprire il personalizzatore di temi. Qui puoi:
- Passare da un tema predefinito all'altro (Scuro, Chiaro, Blu).
- Creare nuovi temi personalizzati.
- Modificare i colori di qualsiasi tema e vedere le modifiche applicate in tempo reale.

---

## Per Sviluppatori: Eseguire l'Applicazione in Ambiente Locale

Per eseguire questa applicazione sul tuo computer, segui questi passaggi.

### Prerequisiti

-   **Node.js**: Assicurati di avere una versione recente di Node.js installata (preferibilmente v18 o superiore). Puoi scaricarla da [nodejs.org](https://nodejs.org/).

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

-   **Sullo stesso computer:** Apri il tuo browser e naviga all'indirizzo `Local` (es. `http://localhost:5173`).
-   **Su altri dispositivi (telefono, tablet, altro computer):** Assicurati che il dispositivo sia connesso alla stessa rete Wi-Fi/LAN del computer che esegue il server. Apri il browser su quel dispositivo e naviga all'indirizzo `Network` (es. `http://192.168.1.123:5173`).

L'applicazione ForMa dovrebbe essere visibile e pronta all'uso.
