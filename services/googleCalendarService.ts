import type { ValidatedEvent } from "../lib/types";
import { toYYYYMMDD } from "../lib/dateUtils";

// --- IMPORTANTE ---
// Questo Client ID è stato fornito per abilitare l'importazione diretta in Google Calendar.
// Se necessario, sostituiscilo con il tuo Client ID da un progetto Google Cloud Platform
// con l'API di Google Calendar abilitata.
// Ottienine uno qui: https://console.cloud.google.com/apis/credentials
const GOOGLE_CLIENT_ID: string = '707970408103-3aptetq009ef5b99oh8git8ldjta0355.apps.googleusercontent.com';


// Il controllo viene effettuato rispetto a un segnaposto generico per garantire che la funzione sia
// disabilitata solo se l'ID non è stato configurato.
export const isGoogleClientConfigured = GOOGLE_CLIENT_ID !== 'IL_TUO_CLIENT_ID_QUI';

const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email';

declare var window: any;

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Tipi per gli eventi di Google Calendar
export interface GCalEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; };
    end: { dateTime?: string; date?:string; };
    attendees?: { email: string }[];
    htmlLink: string;
}

// Helper per attendere la disponibilità di un oggetto globale
const waitForGlobal = <T>(name: string, timeout = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
        let elapsed = 0;
        const interval = 100;
        const check = () => {
            if ((window as any)[name]) {
                resolve((window as any)[name]);
            } else {
                elapsed += interval;
                if (elapsed >= timeout) {
                    reject(new Error(`Timeout in attesa della disponibilità di ${name}.`));
                } else {
                    console.log(`Waiting for ${name}...`); 
                    setTimeout(check, interval); 
                }
            }
        };
        check();
    });
};

// Initialize the GAPI client
export const initGapiClient = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (gapiInited) {
            resolve();
            return;
        }
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                });
                gapiInited = true;
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
};

// Inizializza il client GIS
const initGisClient = (callback: (tokenResponse: any) => void): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        if (!isGoogleClientConfigured) {
            return reject(new Error("L'ID client di Google non è configurato. L'importazione diretta è disabilitata."));
        }
        if (gisInited && tokenClient) {
            tokenClient.callback = callback;
            resolve();
            return;
        }
        
        try {
            await waitForGlobal('google');
        } catch (e: any) {
            return reject(new Error(`Impossibile caricare la libreria di autenticazione di Google: ${e.message}`));
        }
        
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: callback,
        });
        gisInited = true;
        resolve();
    });
};

export const handleAuthClick = async (callback: (tokenResponse: any) => void, promptType: 'consent' | 'select_account' | '' = 'consent') => {
    await initGisClient(callback);
    tokenClient.requestAccessToken({prompt: promptType});
};

export const handleSilentAuth = async (callback: (tokenResponse: any) => void) => {
    await handleAuthClick(callback, ''); 
};


// List user's calendars
export const listCalendars = async () => {
    const response = await window.gapi.client.calendar.calendarList.list({});
    const calendars = response.result.items.sort((a: any, b: any) => {
        if (a.primary) return -1;
        if (b.primary) return 1;
        return a.summary.localeCompare(b.summary);
    });
    return calendars;
};

// Get user's profile information
export const getUserProfile = async () => {
     return await window.gapi.client.request({
        'path': 'https://www.googleapis.com/oauth2/v2/userinfo'
     });
};


// Insert a new event
export const insertEvent = async (calendarId: string, event: ValidatedEvent) => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMins = Math.abs(offsetMinutes % 60);
    const sign = offsetMinutes > 0 ? '-' : '+';
    const timeZoneOffset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    const eventResource = {
        'summary': event.subject,
        'location': event.location,
        'description': event.description,
        'start': {
            'dateTime': `${toYYYYMMDD(event.startDate)}T${event.startTime}:00${timeZoneOffset}`,
        },
        'end': {
            'dateTime': `${toYYYYMMDD(event.endDate)}T${event.endTime}:00${timeZoneOffset}`,
        },
    };

    try {
        const response = await window.gapi.client.calendar.events.insert({
            'calendarId': calendarId,
            'resource': eventResource
        });

        if (response && response.result) {
            return response.result;
        } else {
            throw new Error('L\'inserimento dell\'evento non è riuscito silenziosamente.');
        }
    } catch (error: any) {
        console.error('Errore API di Google Calendar durante l\'inserimento dell\'evento:', error);
        const errorMessage = error.result?.error?.message || error.message || 'Errore sconosciuto durante l\'inserimento.';
        throw new Error(errorMessage);
    }
};

// Patch an existing event
export const patchEvent = async (calendarId: string, eventId: string, resource: any) => {
    try {
        const response = await window.gapi.client.calendar.events.patch({
            'calendarId': calendarId,
            'eventId': eventId,
            'resource': resource
        });
        if (response && response.result) {
            return response.result;
        } else {
            throw new Error('La modifica dell\'evento non è riuscita.');
        }
    } catch (error: any) {
        console.error('Errore API di Google Calendar durante la modifica dell\'evento:', error);
        const errorMessage = error.result?.error?.message || error.message || 'Errore sconosciuto durante la modifica.';
        throw new Error(errorMessage);
    }
};

// List events from a calendar within a date range
export const listEvents = async (calendarId: string, timeMin: string, timeMax: string): Promise<GCalEvent[]> => {
    try {
        const response = await window.gapi.client.calendar.events.list({
            'calendarId': calendarId,
            'timeMin': timeMin, 
            'timeMax': timeMax, 
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 2500, 
            'orderBy': 'startTime'
        });
        return response.result.items;
    } catch (error: any) {
        console.error('Errore API di Google Calendar durante il recupero degli eventi:', error);
        const errorMessage = error.result?.error?.message || error.message || 'Errore sconosciuto durante il recupero.';
        throw new Error(errorMessage);
    }
};

// Delete an event
export const deleteEvent = async (calendarId: string, eventId: string) => {
    try {
        const response = await window.gapi.client.calendar.events.delete({
            'calendarId': calendarId,
            'eventId': eventId
        });
        return response;
    } catch (error: any) {
        console.error('Errore API di Google Calendar durante l\'eliminazione dell\'evento:', error);
        const errorMessage = error.result?.error?.message || error.message || 'Errore sconosciuto durante l\'eliminazione.';
        throw new Error(errorMessage);
    }
};