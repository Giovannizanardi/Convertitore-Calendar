import { GoogleGenAI, Type } from "@google/genai";
import type { EventObject } from '../lib/types';
import type { Part } from "@google/genai";
import type { GCalEvent } from './googleCalendarService';


// The service will return a raw object without the `id` field.
// It will be added in App.tsx after receiving the data.
export type ApiEventObject = Omit<EventObject, 'id'>;

// FIX: Switched to process.env.API_KEY to comply with guidelines and fix TypeScript error.
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        // Updated error message to refer to the correct environment variable.
        throw new Error("La variabile d'ambiente API_KEY non è impostata. Assicurati che sia configurata nel tuo ambiente di esecuzione.");
    }
    return new GoogleGenAI({ apiKey });
};

const eventSchema = {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING, description: 'The title or subject of the event. This is a required field.' },
      startDate: { type: Type.STRING, description: 'The start date of the event. Normalize to YYYY-MM-DD format.' },
      startTime: { type: Type.STRING, description: 'The start time of the event. Normalize to HH:mm (24-hour) format.' },
      endDate: { type: Type.STRING, description: 'The end date of the event. Should be the same as startDate if not specified. Normalize to YYYY-MM-DD format.' },
      endTime: { type: Type.STRING, description: 'The end time of the event. If not specified, assume a 1-hour duration. Normalize to HH:mm (24-hour) format.' },
      description: { type: Type.STRING, description: 'A brief description of the event. Can be an empty string.' },
      location: { type: Type.STRING, description: 'The location of the event. Can be an empty string.' },
    },
    required: ['subject', 'startDate', 'startTime', 'endDate', 'endTime'],
  };

const getExtractionPrompt = (): string => {
  const currentYear = new Date().getFullYear();
  return `
Sei un assistente intelligente per l'estrazione di dati. Il tuo compito è analizzare il contenuto fornito ed estrarre tutti gli eventi in un formato JSON strutturato conforme allo schema fornito.

Segui queste regole con precisione:
1.  Il tuo output DEVE essere un array JSON valido di oggetti evento. Non includere altro testo, spiegazioni o formattazione markdown.
2.  Estrai i seguenti campi per ogni evento: subject, startDate, startTime, endDate, endTime, description, location.
3.  Sii molto flessibile con i formati di data e ora di input (es. GG/MM/AAAA, MM-GG-AAAA, AAAA.MM.GG, Mese GG, AAAA, 2pm, 14:00).
4.  Quando fornisci le date, normalizzale rigorosamente nel formato AAAA-MM-GG.
5.  Quando fornisci gli orari, normalizzale rigorosamente nel formato HH:mm (24 ore).
6.  Se un anno non è specificato per una data, supponi che l'anno corrente sia ${currentYear}.
7.  Se l'orario di fine o la durata di un evento non sono specificati, calcola un orario di fine che sia esattamente 1 ora dopo l'orario di inizio.
8.  Se una data di fine non è specificata, supponi che sia la stessa della data di inizio.
9.  Se un campo come 'description' o 'location' non è presente per un evento, devi restituire una stringa vuota "" per quel campo.
10. Il campo 'subject' è obbligatorio. Se non riesci a determinare un oggetto per una riga o una sezione, salta completamente quel record e non includerlo nell'array di output.
`;
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
    
    return {
      inlineData: {
        mimeType: file.type,
        data: base64EncodedData
      }
    };
  };

export const extractEvents = async (input: File | string): Promise<ApiEventObject[]> => {
  if (!input) {
    throw new Error("L'input non può essere vuoto.");
  }

  try {
    const ai = getAiClient();
    
    const contents = typeof input === 'string'
      ? { parts: [{ text: input }] }
      : { parts: [await fileToGenerativePart(input)] };

    const systemInstruction = getExtractionPrompt();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: eventSchema
          }
      }
    });
    
    try {
      const jsonText = (response.text ?? '').trim();
      if (!jsonText) {
        return [];
      }
      const parsedEvents: ApiEventObject[] = JSON.parse(jsonText);
      return parsedEvents;
    } catch (e) {
        console.error("Impossibile analizzare la risposta JSON dall'IA:", response.text);
        throw new Error("Il modello IA ha restituito una struttura dati non valida. Controlla il contenuto del file e riprova.");
    }
  } catch (err: any) {
      console.error("Errore API Gemini:", err);
      // Passa attraverso il messaggio di errore specifico della chiave API.
      // FIX: Check for API_KEY instead of VITE_API_KEY.
      if (err.message?.includes('API_KEY')) {
          throw err;
      }
      // Controlla errori specifici come sovraccarico o indisponibilità
      if (err.message && (err.message.includes('503') || /overload|unavailable|rate limit/i.test(err.message))) {
          throw new Error("Il servizio di intelligenza artificiale è attualmente sovraccarico o non disponibile. Per favore, attendi un momento e riprova.");
      }
      // Lancia un errore più generico per altri problemi API
      throw new Error("Si è verificato un errore di comunicazione con il servizio AI. Controlla la tua connessione o la configurazione della chiave API.");
  }
};

export const suggestCorrection = async (event: EventObject, fieldToCorrect: keyof Omit<EventObject, 'id'>): Promise<string | null> => {
  const ai = getAiClient();
  const systemInstruction = `
Sei un assistente intelligente per la correzione dei dati. Il tuo compito è correggere un campo specifico che è stato contrassegnato come non valido. Fornisci una correzione plausibile per il campo specificato.

Basandoti sul contesto dell'intero evento, suggerisci un valore corretto.
- Per le date (startDate, endDate), usa rigorosamente il formato GG-MM-AAAA.
- Per gli orari (startTime, endTime), usa rigorosamente il formato HH:mm.
- Sii il più logico possibile. Ad esempio, se la data di inizio è "30/02/2024", una buona correzione sarebbe "29-02-2024".

Restituisci SOLO un oggetto JSON con una singola chiave "suggestion" contenente il valore stringa corretto. Non includere altro testo o markdown.
`;
  const userPrompt = `
Dati originali dell'evento:
${JSON.stringify(event, null, 2)}

Il campo da correggere è: "${fieldToCorrect}".
Il valore non valido corrente è: "${event[fieldToCorrect]}".
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestion: { type: Type.STRING }
          },
          required: ['suggestion']
        }
      }
    });

    const jsonText = (response.text ?? '').trim();
    if (!jsonText) {
      return null;
    }
    const parsedResponse = JSON.parse(jsonText);
    return parsedResponse.suggestion || null;

  } catch (e) {
    console.error("Impossibile ottenere il suggerimento di correzione dall'IA:", e);
    return null;
  }
};

export const findEventsToDelete = async (query: string, events: GCalEvent[]): Promise<string[]> => {
  if (!query) throw new Error("La query di ricerca non può essere vuota.");
  if (events.length === 0) return [];

  const ai = getAiClient();
  const systemInstruction = `
Sei un assistente intelligente per la pulizia di calendari. Il tuo compito è analizzare una query dell'utente e un elenco di eventi di Google Calendar (in formato JSON) e restituire gli ID degli eventi che corrispondono alla query.

Regole:
1. La tua risposta DEVE essere un array JSON valido contenente solo le stringhe degli ID degli eventi corrispondenti.
2. Interpreta il linguaggio naturale. Ad esempio, "riunioni vecchie" potrebbe significare eventi passati da molto tempo, "eventi vuoti" potrebbe indicare eventi senza altri partecipanti o descrizione.
3. Se la query è "tutti gli eventi con 'budget' nel titolo", restituisci gli ID di tutti gli eventi il cui 'summary' contiene la parola 'budget'.
4. Se nessun evento corrisponde, restituisci un array vuoto [].
5. Non includere altro testo, spiegazioni o markdown nella risposta. Solo l'array JSON di stringhe di ID.
`;

  const userPrompt = `
Query utente: "${query}"

Elenco eventi (considera solo i campi forniti):
${JSON.stringify(events.map(e => ({id: e.id, summary: e.summary, description: e.description, start: e.start, end: e.end, attendees: e.attendees})), null, 2)}
`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
          }
      }
  });

  try {
      const jsonText = (response.text ?? '').trim();
      if (!jsonText) return [];
      const parsedIds: string[] = JSON.parse(jsonText);
      return parsedIds;
  } catch (e) {
      console.error("Impossibile analizzare la risposta JSON degli ID evento dall'IA:", response.text);
      throw new Error("Il modello IA ha restituito una struttura dati non valida per gli ID evento.");
  }
};