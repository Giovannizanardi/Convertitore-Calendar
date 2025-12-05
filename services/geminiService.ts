import { GoogleGenAI, Type } from "@google/genai";
import type { EventObject } from '../lib/types';
import type { Part } from "@google/genai";

// The service will return a raw object without the `id` field.
// It will be added in App.tsx after receiving the data.
export type ApiEventObject = Omit<EventObject, 'id'>;

export interface FilterParams {
    startDate: string;
    endDate: string;
    text: string;
    location: string;
}

const getAiClient = () => {
    // FIX: Use process.env.API_KEY to retrieve the API key as per the coding guidelines.
    // This resolves the TypeScript error related to 'import.meta.env'.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("La variabile d'ambiente API_KEY non è impostata.");
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
7.  Se l'orario di fine o