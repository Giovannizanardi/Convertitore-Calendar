import { GoogleGenAI, Type } from "@google/genai";
import type { Part } from "@google/genai";
// FIX: Import EventObject from lib/types.ts
import type { EventObject } from "../lib/types";

// The service will return a raw object without the `id` field.
// It will be added in App.tsx after receiving the data.
export type ApiEventObject = Omit<EventObject, 'id'>; // EventObject è in lib/types.ts

export interface FilterParams {
    startDate: string;
    endDate: string;
    text: string;
    location: string;
}

const getAiClient = () => {
    // FIX: Allineato all'uso di `import.meta.env.VITE_API_KEY` per ambienti Vite frontend.
    // Le linee guida `@google/genai` relative a `process.env.API_KEY` sono primariamente per ambienti Node.js.
    // In un'app Vite, `import.meta.env` è il meccanismo corretto per le variabili d'ambiente.
    const apiKey = import.meta.env.VITE_API_KEY;
    
    if (!apiKey) {
        throw new Error("La variabile d'ambiente VITE_API_KEY non è impostata. Assicurati che sia definita nel tuo file .env (es. VITE_API_KEY=LaTuaChiaveAPI).");
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
Sei un assistente intelligente per l'estrazione di dati. Il tuo compito è analizzare il contenuto fornito ed estrarrre tutti gli eventi in un formato JSON strutturato conforme allo schema fornito.

Segui queste regole con precisione:
1.  Il tuo output DEVE essere un array JSON valido di oggetti evento. Non includere altro testo, spiegazioni o formattazione markdown.
2.  Estrai i seguenti campi per ogni evento: subject, startDate, startTime, endDate, endTime, description, location.
3.  Sii molto flessibile con i formati di data e ora di input (es. GG/MM/AAAA, MM-GG-AAAA, AAAA.MM.GG, Mese GG, AAAA, 2pm, 14:00).
4.  Quando fornisci le date, normalizzale rigorosamente nel formato AAAA-MM-GG. Se l'anno non è specificato, assumi l'anno corrente (${currentYear}).
5.  Quando fornisci gli orari, normalizzale rigorosamente nel formato HH:mm (24-hour). Se l'ora non è specificata, assumi le 09:00. Se viene specificata solo l'ora di inizio, assumi che l'evento duri un'ora.
6.  Se la data di fine non è specificata, assumi che sia la stessa della data di inizio.
7.  Se non ci sono eventi da estrarre, restituisci un array vuoto: [].
8.  Considera i nomi dei mesi e dei giorni della settimana in italiano.
9.  Se il contenuto contiene immagini, concentrati sul testo all'interno delle immagini per gli eventi.

Contenuto da analizzare:
`;
};

// Helper function to convert a File to a base64 encoded string.
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Aggiunta la funzione `extractEvents` per estrarre eventi da testo o file utilizzando l'API Gemini.
// La funzione gestisce l'input di testo e immagini, strutturando la richiesta per l'estrazione JSON.
export async function extractEvents(input: string | File): Promise<ApiEventObject[]> {
    const ai = getAiClient();
    const extractionPrompt = getExtractionPrompt();
    let contents: Part[] = []; // Deve essere sempre un array di Part
    let modelName = 'gemini-3-flash-preview'; // Default for text tasks

    if (typeof input === 'string') {
        contents = [{ text: extractionPrompt + input }];
    } else { // File input
        const mimeType = input.type;
        const base64Data = (await fileToBase64(input)).split(',')[1]; // Remove data:mime/type;base64, prefix

        if (mimeType.startsWith('image/')) {
            modelName = 'gemini-2.5-flash-image'; // Use image model for image inputs
            contents = [
                { text: extractionPrompt }, // Send the prompt as text part
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                    },
                },
            ];
        } else if (mimeType === 'text/plain' || mimeType === 'application/pdf' || mimeType.includes('officedocument')) {
            // For text-based files, read content and send as text part
            const textContent = await input.text();
            contents = [{ text: extractionPrompt + textContent }];
        } else {
            throw new Error(`Tipo di file non supportato per l'estrazione: ${mimeType}`);
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: contents }, // Wrap contents in a 'parts' object for multiple parts
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: eventSchema
                },
            },
        });

        const jsonStr = response.text?.trim();
        if (!jsonStr) {
            throw new Error("La risposta dell'IA non contiene dati JSON validi.");
        }
        
        // Ensure the response is an array
        const parsedResponse = JSON.parse(jsonStr);
        if (!Array.isArray(parsedResponse)) {
            throw new Error("La risposta dell'IA non è un array di eventi.");
        }
        return parsedResponse as ApiEventObject[];
    } catch (error) {
        console.error("Errore nell'estrazione degli eventi dall'IA:", error);
        // Custom error message for API overload
        if ((error as any).status === 500 || ((error as any).message?.includes('Internal Server Error') || (error as any).message?.includes('The service is currently overloaded or unavailable.'))) {
            throw new Error("Il servizio IA è attualmente sovraccarico o non disponibile. Riprova tra qualche istante.");
        }
        throw error;
    }
}

// Aggiunta la funzione `suggestCorrection` per suggerire correzioni a un campo specifico di un evento utilizzando l'API Gemini.
// La funzione invia un prompt all'IA per ottenere un valore corretto per il campo invalidato.
export async function suggestCorrection(event: EventObject, field: keyof Omit<EventObject, 'id'>): Promise<string | undefined> {
    const ai = getAiClient();
    const prompt = `
Hai un evento con i seguenti dettagli:
Oggetto: ${event.subject}
Data Inizio: ${event.startDate}
Ora Inizio: ${event.startTime}
Data Fine: ${event.endDate}
Ora Fine: ${event.endTime}
Luogo: ${event.location}
Descrizione: ${event.description}

Il campo "${field}" è invalido o formattato in modo errato. Il valore corrente è: "${
    // FIX: Explicitly convert field to string when accessing event properties to avoid implicit conversion errors.
    event[String(field) as keyof EventObject]
}".
Per favore, suggerisci un valore corretto per il campo "${field}" basandoti sul contesto dell'evento.
Normalizza le date al formato AAAA-MM-GG e gli orari al formato HH:mm.
Rispondi SOLO con il valore corretto per il campo, senza spiegazioni o testo aggiuntivo.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{text: prompt}],
            config: {
                // We expect a simple string response for the correction
                responseMimeType: "text/plain",
            }
        });

        const correction = response.text?.trim();
        if (correction) {
            return correction;
        }
        return undefined;
    } catch (error) {
        console.error(`Errore nel suggerire la correzione per il campo ${field}:`, error);
        throw error;
    }
}

// Aggiunta la funzione `parseFilterFromQuery` per estrarre i parametri di filtro da una query testuale.
// Utilizza l'IA per interpretare una query in linguaggio naturale e convertirla in un oggetto `FilterParams`.
export async function parseFilterFromQuery(query: string): Promise<FilterParams> {
    const ai = getAiClient();
    const currentYear = new Date().getFullYear();
    const prompt = `
Analizza la seguente query e estrai i parametri per filtrare gli eventi del calendario.
Normalizza le date al formato AAAA-MM-GG. Se l'anno non è specificato, assumi l'anno corrente (${currentYear}).
Se un parametro non è menzionato nella query, lascia il suo valore come stringa vuota.

Query: "${query}"`;

    const filterSchema = {
        type: Type.OBJECT,
        properties: {
            startDate: { type: Type.STRING, description: 'Data di inizio filtro (AAAA-MM-GG). Stringa vuota se non specificata.' },
            endDate: { type: Type.STRING, description: 'Data di fine filtro (AAAA-MM-GG). Stringa vuota se non specificata.' },
            text: { type: Type.STRING, description: 'Testo da cercare nel riepilogo o nella descrizione. Stringa vuota se non specificata.' },
            location: { type: Type.STRING, description: 'Luogo dell\'evento da filtrare. Stringa vuota se non specificata.' },
        },
        required: [], // All fields are optional from the query perspective
        // FIX: Ensure propertyOrdering is correctly typed as string[]
        propertyOrdering: ['startDate', 'endDate', 'text', 'location'] as string[]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{text: prompt}],
            config: {
                responseMimeType: "application/json",
                responseSchema: filterSchema,
            },
        });

        const jsonStr = response.text?.trim();
        if (!jsonStr) {
            throw new Error("La risposta dell'IA non contiene dati JSON validi per i filtri.");
        }
        
        const parsedResponse = JSON.parse(jsonStr);
        // Ensure all properties are present, even if empty, to match FilterParams
        const result: FilterParams = {
            startDate: parsedResponse.startDate || '',
            endDate: parsedResponse.endDate || '',
            text: parsedResponse.text || '',
            location: parsedResponse.location || '',
        };
        
        return result;

    } catch (error) {
        console.error("Errore nell'analisi della query di filtro dall'IA:", error);
        throw error;
    }
}