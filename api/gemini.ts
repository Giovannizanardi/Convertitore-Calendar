import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentParameters, Part } from "@google/genai";

// Vercel Serverless Function & Express API Handler
export default async function handler(req: any, res: any) {
  // Enable CORS if needed
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito. Usa POST." });
  }

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Chiave API non configurata sul server (API_KEY o GEMINI_API_KEY assente nelle variabili d'ambiente).",
    });
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const { action, input, file, model, event, field, query } = req.body || {};
  
  // Normalize model identifier for optimal compatibility
  const normalizeModel = (m?: string): string => {
    if (!m) return "gemini-2.5-flash";
    if (m === "gemini-3-flash-preview" || m === "gemini-flash" || m === "gemini-3.8-flash") return "gemini-2.5-flash";
    if (m === "gemini-3-pro-preview" || m === "gemini-pro" || m === "gemini-3.1-pro-preview") return "gemini-2.5-pro";
    return m;
  };
  const primaryModel = normalizeModel(model);

  // Model fallback chain if 503 / high demand occurs
  const candidateModels = Array.from(
    new Set([primaryModel, "gemini-2.5-flash", "gemini-3.8-flash", "gemini-2.5-pro"])
  );

  async function generateWithFallbackAndRetry(
    buildRequest: (modelName: string) => { model: string; contents: any; config?: any }
  ) {
    let lastError: any = null;

    for (const modelToTry of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const reqConfig = buildRequest(modelToTry);
          const response = await ai.models.generateContent(reqConfig);
          return response;
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code || err?.error?.code;
          const msg = err?.message || JSON.stringify(err);
          const isOverloadedOrUnavailable =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            msg.includes("503") ||
            msg.includes("high demand") ||
            msg.includes("UNAVAILABLE") ||
            msg.includes("overloaded") ||
            msg.includes("RESOURCE_EXHAUSTED");

          if (isOverloadedOrUnavailable) {
            console.warn(
              `Model ${modelToTry} attempt ${attempt + 1} unavailable (${msg}). Retrying/falling back...`
            );
            // Brief backoff
            await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            continue;
          } else {
            // For other non-transient errors, throw immediately
            throw err;
          }
        }
      }
    }

    throw lastError;
  }

  try {
    switch (action) {
      case "extract":
      case "extractEvents": {
        const currentYear = new Date().getFullYear();
        const extractionPrompt = `
Sei un assistente intelligente per l'estrazione di dati. Il tuo compito è analizzare il contenuto fornito ed estrarre tutti gli eventi in un formato JSON strutturato conforme allo schema fornito.

Segui queste regole con precisione:
1. Il tuo output DEVE essere un array JSON valido di oggetti evento. Non includere altro testo, spiegazioni o formattazione markdown.
2. Estrai i seguenti campi per ogni evento: subject, startDate, startTime, endDate, endTime, description, location.
3. Sii molto flessibile con i formati di data e ora di input (es. GG/MM/AAAA, MM-GG-AAAA, AAAA.MM.GG, Mese GG, AAAA, 2pm, 14:00).
4. Quando fornisci le date, normalizzale rigorosamente nel formato AAAA-MM-GG. Se l'anno non è specificato, assumi l'anno corrente (${currentYear}).
5. Quando fornisci gli orari, normalizzale rigorosamente nel formato HH:mm (24-hour). Se l'ora non è specificata, assumi le 09:00. Se viene specificata solo l'ora di inizio, assumi che l'evento duri un'ora.
6. Se la data di fine non è specificata, assumi che sia la stessa della data di inizio.
7. Se non ci sono eventi da estrarre, restituisci un array vuoto: [].
8. Considera i nomi dei mesi e dei giorni della settimana in italiano.
9. Il contenuto potrebbe provenire da un documento, un foglio di calcolo, un testo o un'immagine. Estrai le informazioni in modo ordinato anche se la formattazione originale è imperfetta.

Contenuto da analizzare:
`;

        const eventSchema = {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: "The title or subject of the event. This is a required field.",
            },
            startDate: {
              type: Type.STRING,
              description: "The start date of the event. Normalize to YYYY-MM-DD format.",
            },
            startTime: {
              type: Type.STRING,
              description: "The start time of the event. Normalize to HH:mm (24-hour) format.",
            },
            endDate: {
              type: Type.STRING,
              description: "The end date of the event. Should be the same as startDate if not specified. Normalize to YYYY-MM-DD format.",
            },
            endTime: {
              type: Type.STRING,
              description: "The end time of the event. If not specified, assume a 1-hour duration. Normalize to HH:mm (24-hour) format.",
            },
            description: {
              type: Type.STRING,
              description: "A brief description or teacher/notes of the event. Can be an empty string.",
            },
            location: {
              type: Type.STRING,
              description: "The location of the event. Can be an empty string.",
            },
          },
          required: ["subject", "startDate", "startTime", "endDate", "endTime"],
        };

        const config: GenerateContentParameters["config"] = {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: eventSchema,
          },
        };

        let contents: Part[] = [];

        if (file && file.base64 && file.mimeType) {
          const multimodalMimeTypes = [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "application/pdf",
          ];

          if (multimodalMimeTypes.includes(file.mimeType)) {
            contents = [
              { text: extractionPrompt },
              {
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.base64,
                },
              },
            ];
          } else {
            // Text or other format
            const textContent = Buffer.from(file.base64, "base64").toString("utf-8");
            contents = [{ text: extractionPrompt + textContent }];
          }
        } else if (typeof input === "string") {
          contents = [{ text: extractionPrompt + input }];
        } else {
          return res.status(400).json({ error: "Nessun contenuto o file fornito per l'estrazione." });
        }

        const response = await generateWithFallbackAndRetry((m) => ({
          model: m,
          contents: { parts: contents },
          config: config,
        }));

        const jsonStr = response.text?.trim();
        if (!jsonStr) {
          return res.status(500).json({ error: "La risposta dell'IA è vuota." });
        }

        const parsedResponse = JSON.parse(jsonStr);
        if (!Array.isArray(parsedResponse)) {
          return res.status(500).json({ error: "Formato JSON non valido restituito dall'IA." });
        }

        return res.status(200).json({ success: true, data: parsedResponse });
      }

      case "suggestCorrection": {
        if (!event || !field) {
          return res.status(400).json({ error: "Evento o campo mancante." });
        }

        const prompt = `Suggerisci un valore corretto per il campo "${field}" dell'evento "${event.subject}". Valore attuale: "${event[field]}". Rispondi solo con il valore corretto formattato (date YYYY-MM-DD, orari HH:mm).`;

        const response = await generateWithFallbackAndRetry((m) => ({
          model: m,
          contents: [{ text: prompt }],
          config: { responseMimeType: "text/plain" },
        }));

        return res.status(200).json({ success: true, data: response.text?.trim() });
      }

      case "parseFilter": {
        if (!query) {
          return res.status(400).json({ error: "Query di filtro mancante." });
        }

        const currentYear = new Date().getFullYear();
        const prompt = `Analizza la query: "${query}". Estrai parametri filtro JSON (startDate, endDate, startTime, text, location). Anno corrente: ${currentYear}. Formato date: AAAA-MM-GG, formato ora: HH:mm.`;

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
          propertyOrdering: ["startDate", "endDate", "startTime", "text", "location"],
        };

        const response = await generateWithFallbackAndRetry((m) => ({
          model: m,
          contents: [{ text: prompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: filterSchema,
          },
        }));

        const jsonStr = response.text?.trim() || "{}";
        const parsedResponse = JSON.parse(jsonStr);

        const filterParams = {
          startDate: parsedResponse.startDate || "",
          endDate: parsedResponse.endDate || "",
          startTime: parsedResponse.startTime || "",
          text: parsedResponse.text || "",
          location: parsedResponse.location || "",
        };

        return res.status(200).json({ success: true, data: filterParams });
      }

      default:
        return res.status(400).json({ error: `Azione non supportata: ${action}` });
    }
  } catch (error: any) {
    console.error("Errore GenAI Server:", error);
    const msg = error?.message || "";
    if (
      msg.includes("503") ||
      msg.includes("high demand") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("overloaded")
    ) {
      return res.status(503).json({
        error:
          "I server di Google Gemini stanno riscontrando un picco temporaneo di traffico (503). Riprova tra pochi istanti oppure usa l'importazione 'CSV Diretto (Senza IA)' per importare immediatamente senza attendere l'IA.",
      });
    }
    return res.status(500).json({
      error: error.message || "Errore durante l'elaborazione della richiesta IA sul server.",
    });
  }
}
