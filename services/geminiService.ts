import { GoogleGenAI, Type } from "@google/genai";
import type { Part, GenerateContentParameters } from "@google/genai";
import type { EventObject } from "../lib/types";

export type ApiEventObject = Omit<EventObject, 'id'>;

export interface FilterParams {
    startDate: string;
    endDate: string;
    text: string;
    location: string;
}

const getAiClient = () => {
    // FIX: Allineato alle linee guida `@google/genai` che richiedono l'uso di `process.env.API_KEY`.
    // Questa variabile d'ambiente deve essere disponibile nell'ambiente di esecuzione (ad esempio, tramite un loader di variabili d'ambiente).
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        // FIX: Aggiornato il messaggio di errore per riflettere il nome della variabile d'ambiente API_KEY.
        throw new Error("La variabile d'ambiente API_KEY non è impostata. Assicurati che sia definita nel tuo ambiente.");
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
1.  Il tuo output DEVE essere un array JSON valido di oggetti evento. Non includi altre informazioni o testo.
2.  Estrai i seguenti campi per ogni evento: subject, startDate, startTime, endDate, endTime, description, location.
3.  Sii molto flessibile con i formati di data e ora di input (es. GG/MM/AAAA, MM-GG-AAAA, AAAA.MM.GG, Mese GG, AAAA, 2pm, 14:00).
4.  Quando fornisci le date, normalizzale rigorosamente nel formato AAAA-MM-GG. Se l'anno non è specificato, assumi l'anno corrente (${currentYear}).
5.  Quando fornisci gli orari, normalizzale rigorosamente nel formato HH:mm (24-hour). Se l'ora non è specificata, assumi le 09:00. Se viene specificata solo l'ora di inizio, assumi che l'evento duri un'ora.
6.  Se la data di fine non è specificata, assumi che sia la stessa della data di inizio.
7.  Se non ci sono eventi da estrarre, restituisci un array vuoto: [].
8.  Considera i nomi dei mesi e dei giorni della settimana in italiano.
9.  Se il contenuto contiene immagini o documenti scansionati, concentrati sul testo all'interno delle immagini/documenti per gli eventi.

Contenuto da analizzare:
`;
};

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

export async function extractEvents(input: string | File): Promise<ApiEventObject[]> {
    const ai = getAiClient();
    const extractionPrompt = getExtractionPrompt();
    let contents: Part[] = [];
    let modelName = 'gemini-3-flash-preview'; // Default for text tasks
    let config: GenerateContentParameters['config'] = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: eventSchema
        },
    };

    if (typeof input === 'string') {
        contents = [{ text: extractionPrompt + input }];
    } else { // File input
        const mimeType = input.type;
        const base64Data = (await fileToBase64(input)).split(',')[1];

        // MIME types che dovrebbero essere trattati come input multimodali (visivi)
        const multiModalMimeTypes = [
            'image/png', 'image/jpeg', 'image/gif', 'image/webp', // Immagini
            'application/pdf', // Documenti PDF
            'application/msword', // .doc (Word 97-2003)
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx (Word)
            'application/vnd.ms-excel', // .xls (Excel 97-2003)
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx (Excel)
            'application/vnd.ms-powerpoint', // .ppt (PowerPoint 97-2003)
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx (PowerPoint)
        ];

        // Se il tipo MIME del file di input è considerato multimodale
        if (multiModalMimeTypes.some(type => mimeType.includes(type))) {
            modelName = 'gemini-2.5-flash-image'; // Usa il modello per immagini/multimodale
            contents = [
                { text: extractionPrompt },
                { inlineData: { mimeType: mimeType, data: base64Data } },
            ];
            config = {}; // CRITICAL: Rimuovi responseMimeType e responseSchema per i modelli multimodali
        } else if (mimeType === 'text/plain' || mimeType === 'text/csv') { // File di testo semplice o CSV
            const textContent = await input.text();
            contents = [{ text: extractionPrompt + textContent }];
            // La configurazione rimane quella predefinita per i modelli di testo
        } else {
            throw new Error(`Tipo di file non supportato o non riconosciuto per l'elaborazione IA: ${mimeType}. Assicurati che il file sia un'immagine, PDF, documento Word/Excel/PowerPoint o testo semplice.`);
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: contents },
            config: config,
        });

        let jsonStr = response.text?.trim();
        if (!jsonStr) {
            throw new Error("La risposta dell'IA non contiene dati JSON validi.");
        }
        
        if (modelName === 'gemini-2.5-flash-image' || !config.responseMimeType) {
            const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                jsonStr = jsonMatch[1];
            } else {
                const firstBracket = jsonStr.indexOf('[');
                const firstCurly = jsonStr.indexOf('{');
                
                let startIndex = -1;
                if (firstBracket !== -1 && (firstCurly === -1 || firstBracket < firstCurly)) {
                    startIndex = firstBracket;
                } else if (firstCurly !== -1) {
                    startIndex = firstCurly;
                }

                if (startIndex !== -1) {
                    let endIndex = -1;
                    let balance = 0;
                    const opener = jsonStr[startIndex];
                    const closer = opener === '[' ? ']' : '}';

                    for (let i = startIndex; i < jsonStr.length; i++) {
                        const char = jsonStr[i];
                        if (char === '"' && (i === 0 || jsonStr[i-1] !== '\\')) {
                            let j = i + 1;
                            while(j < jsonStr.length && (jsonStr[j] !== '"' || jsonStr[j-1] === '\\')) {
                                j++;
                            }
                            i = j;
                        } else if (char === opener) {
                            balance++;
                        } else if (char === closer) {
                            balance--;
                        }
                        if (balance === 0 && char === closer) {
                            endIndex = i;
                            break;
                        }
                    }
                    
                    if (endIndex !== -1) {
                        jsonStr = jsonStr.substring(startIndex, endIndex + 1);
                    } else {
                        console.warn("Could not find a balanced JSON structure after prompt instruction, attempting direct parse.");
                    }
                }
            }
        }
        
        const parsedResponse = JSON.parse(jsonStr);
        if (!Array.isArray(parsedResponse)) {
            throw new Error("La risposta dell'IA non è un array di eventi.");
        }
        return parsedResponse as ApiEventObject[];
    } catch (error) {
        console.error("Errore nell'estrazione degli eventi dall'IA:", error);
        if ((error as any).status === 500 || ((error as any).message?.includes('Internal Server Error') || (error as any).message?.includes('The service is currently overloaded or unavailable.'))) {
            throw new Error("Il servizio IA è attualmente sovraccarico o non disponibile. Riprova tra qualche istante.");
        }
        throw error;
    }
}

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
        required: [],
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