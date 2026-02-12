import { GoogleGenAI, Type } from "@google/genai";
import type { Part, GenerateContentParameters } from "@google/genai";
import type { EventObject } from "../lib/types";

export type ApiEventObject = Omit<EventObject, 'id'>;

export interface FilterParams {
    startDate: string;
    endDate: string;
    startTime: string;
    text: string;
    location: string;
}

// FIX: Otteniamo la chiave API esclusivamente da process.env.API_KEY.
// Se la chiave è assente, lanciamo un errore specifico che può essere gestito dalla UI.
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
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
9.  Il contenuto potrebbe provenire da un documento, un foglio di calcolo o un'immagine. Estrai le informazioni in formato tabellare anche se la formattazione originale è imperfetta.

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
    let modelName = 'gemini-3-flash-preview';
    let config: GenerateContentParameters['config'] = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: eventSchema
        },
    };

    if (typeof input === 'string') {
        contents = [{ text: extractionPrompt + input }];
    } else {
        const mimeType = input.type;
        const base64Data = (await fileToBase64(input)).split(',')[1];
        const multimodalMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

        if (multimodalMimeTypes.includes(mimeType)) {
            modelName = 'gemini-3-flash-preview';
            contents = [
                { text: extractionPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                    },
                },
            ];
            // I modelli più recenti supportano JSON anche con input multimodali
        } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
            const textContent = await input.text();
            contents = [{ text: extractionPrompt + textContent }];
        } else {
            throw new Error(`Tipo di file "${mimeType}" non supportato.`);
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: contents },
            config: config,
        });

        let jsonStr = response.text?.trim();
        if (!jsonStr) throw new Error("La risposta dell'IA è vuota.");
        
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) jsonStr = jsonMatch[1];
        
        const parsedResponse = JSON.parse(jsonStr);
        if (!Array.isArray(parsedResponse)) throw new Error("Formato JSON non valido.");
        return parsedResponse as ApiEventObject[];
    } catch (error: any) {
        if (error.message === 'API_KEY_MISSING') throw error;
        console.error("Errore GenAI:", error);
        throw error;
    }
}

export async function suggestCorrection(event: EventObject, field: keyof Omit<EventObject, 'id'>): Promise<string | undefined> {
    const ai = getAiClient();
    const prompt = `Suggerisci un valore corretto per il campo "${field}" dell'evento "${event.subject}". Valore attuale: "${event[String(field) as keyof EventObject]}". Rispondi solo col valore corretto.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{text: prompt}],
            config: { responseMimeType: "text/plain" }
        });
        return response.text?.trim();
    } catch (error: any) {
        if (error.message === 'API_KEY_MISSING') throw error;
        throw error;
    }
}

export async function parseFilterFromQuery(query: string): Promise<FilterParams> {
    const ai = getAiClient();
    const currentYear = new Date().getFullYear();
    const prompt = `Analizza la query: "${query}". Estrai parametri filtro JSON (startDate, endDate, startTime, text, location). Anno corrente: ${currentYear}.`;

    const filterSchema = {
        type: Type.OBJECT,
        properties: {
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            startTime: { type: Type.STRING },
            text: { type: Type.STRING },
            location: { type: Type.STRING },
        },
        required: [],
        propertyOrdering: ['startDate', 'endDate', 'startTime', 'text', 'location'] as string[]
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

        const jsonStr = response.text?.trim() || '{}';
        const parsedResponse = JSON.parse(jsonStr);
        return {
            startDate: parsedResponse.startDate || '',
            endDate: parsedResponse.endDate || '',
            startTime: parsedResponse.startTime || '',
            text: parsedResponse.text || '',
            location: parsedResponse.location || '',
        };
    } catch (error: any) {
        if (error.message === 'API_KEY_MISSING') throw error;
        throw error;
    }
}
