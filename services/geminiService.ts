import type { EventObject } from "../lib/types";

export type ApiEventObject = Omit<EventObject, "id">;

export interface FilterParams {
  startDate: string;
  endDate: string;
  startTime: string;
  text: string;
  location: string;
}

// Funzione per ottenere il modello selezionato dall'utente, con fallback al default
function getSelectedModel(): string {
  const defaultModel = "gemini-2.5-flash";
  try {
    const storedSettings = localStorage.getItem("forma-settings");
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      if (typeof settings.model === "string" && settings.model) {
        return settings.model;
      }
    }
  } catch (e) {
    console.error("Could not read model from localStorage, using default.", e);
  }
  return defaultModel;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function extractEvents(input: string | File): Promise<ApiEventObject[]> {
  const modelName = getSelectedModel();
  let payload: any = {
    action: "extract",
    model: modelName,
  };

  if (typeof input === "string") {
    payload.input = input;
  } else {
    const mimeType = input.type;
    const base64Data = (await fileToBase64(input)).split(",")[1];
    payload.file = {
      base64: base64Data,
      mimeType: mimeType,
      name: input.name,
    };
  }

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Errore del server durante l'estrazione (${response.status})`);
  }

  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error(result.error || "Formato risposta non valido dal server.");
  }

  return result.data as ApiEventObject[];
}

export async function suggestCorrection(
  event: EventObject,
  field: keyof Omit<EventObject, "id">
): Promise<string | undefined> {
  const modelName = getSelectedModel();

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "suggestCorrection",
      event: event,
      field: String(field),
      model: modelName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Errore del server (${response.status})`);
  }

  const result = await response.json();
  return result.data;
}

export async function parseFilterFromQuery(query: string): Promise<FilterParams> {
  const modelName = getSelectedModel();

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "parseFilter",
      query: query,
      model: modelName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Errore del server durante l'analisi dei filtri (${response.status})`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Formato risposta non valido dal server.");
  }

  return {
    startDate: result.data.startDate || "",
    endDate: result.data.endDate || "",
    startTime: result.data.startTime || "",
    text: result.data.text || "",
    location: result.data.location || "",
  };
}
