import React, { useState, useEffect, useCallback } from 'react';
import type { ValidatedEvent } from '../lib/types';
import { generateCsvContent } from '../lib/csv';
import { generateIcsContent } from '../lib/ics';
import * as gcal from '../services/googleCalendarService';
import { DownloadIcon, CheckCircleIcon, GoogleIcon, CalendarPlusIcon, CalendarDaysIcon, JsonIcon, RefreshCwIcon } from './Icons';
import { Loader } from './Loader';

interface GoogleCalendarImporterProps {
    events: ValidatedEvent[];
    onReset: () => void;
}

declare var window: any;

type View = 'choice' | 'csv' | 'gcal' | 'ics';
type GCalState = 'initial' | 'authenticating' | 'authenticated' | 'importing' | 'complete' | 'error';

interface Calendar {
    id: string;
    summary: string;
    primary?: boolean;
}

interface GCalError {
    title: string;
    message: string;
}

interface ImportResult {
    successCount: number;
    failures: { event: ValidatedEvent; error: string }[];
}


export const GoogleCalendarImporter: React.FC<GoogleCalendarImporterProps> = ({ events, onReset }) => {
    const [view, setView] = useState<View>('choice');
    const [gcalState, setGCalState] = useState<GCalState>('initial');
    const [gcalError, setGCalError] = useState<GCalError | null>(null);
    
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState(''); // Default calendar for all events
    const [eventCalendarMappings, setEventCalendarMappings] = useState<Record<number, string>>({}); // Mapping for individual events
    const [importProgress, setImportProgress] = useState(0);
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleGapiLoad = useCallback(async () => {
        try {
            await gcal.initGapiClient();
        } catch (error: any) {
            console.error("GAPI Init Error:", error);
            setGCalState('error');
            setGCalError({
                title: 'Errore di Inizializzazione',
                message: `Impossibile caricare i componenti principali di Google. Controlla la tua connessione e riprova. Dettagli: ${error.message}`
            });
        }
    }, []);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('client', handleGapiLoad);
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                 document.body.removeChild(script);
            }
        };
    }, [handleGapiLoad]);
    
    const fetchCalendars = useCallback(async () => {
        try {
            const calendarList = await gcal.listCalendars();
            setCalendars(calendarList);
            const primaryCalendar = calendarList.find((c: Calendar) => c.primary) || calendarList[0];
            if (primaryCalendar) {
                setSelectedCalendarId(primaryCalendar.id);
                // Initialize all events to the primary calendar by default
                const initialMappings: Record<number, string> = {};
                events.forEach(event => {
                    initialMappings[event.id] = primaryCalendar.id;
                });
                setEventCalendarMappings(initialMappings);
            }
        } catch (error: any) {
            console.error('Error fetching calendars:', error);
            setGCalState('error');
            setGCalError({
                title: 'Impossibile Caricare i Calendari',
                message: `Non è stato possibile recuperare i tuoi calendari da Google. ${error.message}. Prova ad accedere di nuovo.`
            });
        }
    }, [events]); // Re-run if events change to initialize mappings

    const handleTokenResponse = useCallback(async (tokenResponse: any, isSilent: boolean) => {
        // Clear any previous error message when a new token response is received
        setGCalError(null); 

        if (tokenResponse.error) {
            let title = "Errore di Autenticazione";
            let message = "Si è verificato un errore sconosciuto durante l'autenticazione.";
            
            switch (tokenResponse.error) {
                case 'popup_closed_by_user':
                    title = "Autenticazione Annullata";
                    message = "La finestra di accesso di Google è stata chiusa prima del completamento.";
                    break;
                case 'access_denied':
                    title = "Permessi Negati";
                    message = "L'applicazione richiede i permessi per accedere al tuo calendario. Se vedi un errore 'Accesso bloccato', potrebbe essere dovuto alla configurazione dell'app Google (es. l'app è in 'modalità test' e il tuo account non è un utente di test).";
                    break;
                default:
                    message = tokenResponse.error_description || message;
                    break;
            }
            
            if (isSilent) {
                setGCalState('initial');
            } else {
                setGCalError({ title, message });
                setGCalState(tokenResponse.error === 'popup_closed_by_user' ? 'initial' : 'error');
            }
            return;
        }

        if (tokenResponse.access_token) {
            // Imposta il token per il client GAPI. Questo è essenziale
            // per autorizzare le chiamate API successive.
            window.gapi.client.setToken(tokenResponse);
            
            try {
                const userInfoResponse = await gcal.getUserProfile();
                if (userInfoResponse?.result?.email) {
                    setUser(userInfoResponse.result);
                    await fetchCalendars();
                    setGCalState('authenticated');
                } else {
                    throw new Error("Profilo utente non trovato.");
                }
            } catch (error: any) {
                 setGCalError({
                    title: 'Errore nel Caricamento Dati',
                    message: `Autenticazione riuscita, ma impossibile caricare i dati del tuo profilo. Dettagli: ${error.message}`
                });
                setGCalState('error');
            }
        } else {
             if (isSilent) {
                setGCalState('initial');
             } else {
                setGCalError({
                    title: 'Autenticazione Fallita',
                    message: "Nessun token di accesso ricevuto da Google. Riprova."
                });
                setGCalState('error');
             }
        }
    }, [fetchCalendars]);

    // This function now handles the initial authentication call with a default 'consent' prompt
    const handleAuth = async (promptType: 'consent' | 'select_account' | '' = 'consent') => {
        setGCalState('authenticating');
        setGCalError(null);
        try {
            await gcal.handleAuthClick((token) => handleTokenResponse(token, false), promptType);
        } catch (error: any) {
            console.error('Auth Click Setup Error:', error);
            setGCalError({ title: 'Errore di Configurazione', message: error.message });
            setGCalState('error');
        }
    };

    useEffect(() => {
        if (view !== 'gcal' || gcalState !== 'initial') return;

        setGCalState('authenticating');
        
        const trySilentLogin = async () => {
            try {
                // handleSilentAuth now uses handleAuthClick internally with '' promptType
                await gcal.handleSilentAuth((token) => handleTokenResponse(token, true));
            } catch (error: any) {
                console.error("Silent Auth Setup Error:", error);
                 setGCalError({ title: 'Errore di Configurazione', message: error.message });
                 setGCalState('error');
            }
        };
        setTimeout(trySilentLogin, 100);
    }, [view, gcalState, handleTokenResponse]);

    const handleDownloadCsv = () => {
        const csvContent = generateCsvContent(events);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'google-calendar-events.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setView('csv');
    };

    const handleDownloadIcs = () => {
        const icsContent = generateIcsContent(events);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'events.ics');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setView('ics');
    };
    
    const handleDownloadJson = () => {
        // Rimuove i campi interni di validazione per un output pulito
        const eventsToExport = events.map(({ id, errors, isValid, ...rest }) => rest);
        const jsonContent = JSON.stringify(eventsToExport, null, 2); // Formattato per leggibilità
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'events.json');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        // Per semplicità, non mostriamo una schermata di successo separata per JSON
    };

    const handleDefaultCalendarChange = (calendarId: string) => {
        setSelectedCalendarId(calendarId);
    };

    const handleEventCalendarChange = (eventId: number, calendarId: string) => {
        setEventCalendarMappings(prev => ({ ...prev, [eventId]: calendarId }));
    };

    const handleApplyDefaultToUnmapped = () => {
        if (!selectedCalendarId) return;

        setEventCalendarMappings(prev => {
            const newMappings = { ...prev };
            events.forEach(event => {
                if (!newMappings[event.id]) {
                    newMappings[event.id] = selectedCalendarId;
                }
            });
            return newMappings;
        });
    };
    
    const handleImport = async () => {
        setGCalState('importing');
        setImportResult(null);
        
        let successCount = 0;
        const failures: { event: ValidatedEvent; error: string }[] = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            // Use the specific mapping for the event, or the default if not set
            const targetCalendarId = eventCalendarMappings[event.id] || selectedCalendarId;
            
            if (!targetCalendarId) {
                // This should not happen if the UI disables the button, but as a safeguard
                failures.push({ event, error: "Nessun calendario selezionato per questo evento." });
                continue;
            }

            try {
                const result = await gcal.insertEvent(targetCalendarId, event);
                 if (result) {
                    successCount++;
                } else {
                    throw new Error("L'API di Google non ha restituito un evento creato.");
                }
            } catch (error: any) {
                console.error(`Failed to import event: ${event.subject}`, error);
                const errorMessage = (error as any).result?.error?.message || (error as any).message || 'Errore sconosciuto';
                failures.push({ event, error: errorMessage });
            }
            setImportProgress(((i + 1) / events.length) * 100);
        }

        setImportResult({ successCount, failures });
        setGCalState('complete');
    };
    
    // Resets the GCal importer state back to initial or authenticated based on params
    const resetGCalState = (goToChoice = false) => {
        setGCalState('initial');
        setGCalError(null);
        setImportResult(null);
        setImportProgress(0);
        setUser(null);
        setCalendars([]);
        setSelectedCalendarId('');
        setEventCalendarMappings({}); // Reset mappings
        if (goToChoice) {
            setView('choice');
        }
    }

    // Handler for "Change Google Account" button
    const handleSwitchAccount = async () => {
        // Explicitly start auth flow with 'select_account' prompt to force account selection
        resetGCalState(); // Clear current state
        await handleAuth('select_account');
    };

    // Determine if the import button should be disabled
    const isImportButtonDisabled = events.length === 0 || (!selectedCalendarId && Object.keys(eventCalendarMappings).length === 0);

    const CsvView = () => (
        <div className="animate-fade-in text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">File CSV Scaricato!</h3>
            <p className="text-muted-foreground mt-2">
                Ora puoi importare il file <code>google-calendar-events.csv</code> nel tuo Google Calendar o usarlo in altre applicazioni.
            </p>
             <div className="mt-8 flex justify-center space-x-4">
                <button
                    onClick={onReset}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                >
                    Inizia di Nuovo
                </button>
                 <button
                    onClick={() => setView('choice')}
                    className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                >
                    Torna Indietro
                </button>
            </div>
        </div>
    );

    const IcsView = () => (
        <div className="animate-fade-in text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">File .ics Scaricato!</h3>
            <p className="text-muted-foreground mt-2">
                Ora puoi importare il file <code>events.ics</code> nella tua applicazione di calendario preferita (es. Apple Calendar, Outlook).
            </p>
            <div className="mt-8 flex justify-center space-x-4">
                <button
                    onClick={onReset}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                >
                    Inizia di Nuovo
                </button>
                 <button
                    onClick={() => setView('choice')}
                    className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                >
                    Torna Indietro
                </button>
            </div>
        </div>
    );

    const GCalView = () => {
        switch (gcalState) {
            case 'initial':
            case 'authenticating':
                return (
                    <div className="text-center">
                        <Loader />
                        <p className="text-muted-foreground mt-4 animate-pulse">In attesa dell'autenticazione Google...</p>
                        {gcalState === 'initial' && 
                            <p className="text-sm text-muted-foreground mt-2">Se la finestra di accesso non si apre, clicca qui sotto.</p>
                        }
                         <div className="mt-6 flex justify-center space-x-4">
                            <button
                                onClick={() => handleAuth()} // Default 'consent' prompt
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Apri Finestra di Accesso Google
                            </button>
                             <button
                                onClick={() => resetGCalState(true)}
                                className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                );
            case 'authenticated':
                return (
                    <div className="max-w-lg mx-auto animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-muted-foreground">Accesso effettuato come <span className="font-semibold text-foreground">{user?.email}</span></p>
                            <button
                                onClick={handleSwitchAccount}
                                className="flex items-center space-x-2 text-sm bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-2 px-3 rounded-md transition-colors"
                                title="Cambia account Google"
                            >
                                <RefreshCwIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Cambia Account Google</span>
                            </button>
                        </div>

                        {/* Default Calendar Selection */}
                        <div className="bg-card/50 p-6 rounded-lg border border-border mb-6">
                             <label htmlFor="default-calendar-select" className="block mb-2 text-sm font-medium text-muted-foreground">Calendario predefinito per i nuovi eventi e quelli non assegnati:</label>
                             <select
                                id="default-calendar-select"
                                value={selectedCalendarId}
                                onChange={(e) => handleDefaultCalendarChange(e.target.value)}
                                className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                             >
                                {calendars.map(cal => (
                                    <option key={cal.id} value={cal.id}>{cal.summary}</option>
                                ))}
                             </select>
                            <button
                                onClick={handleApplyDefaultToUnmapped}
                                className="mt-3 w-full bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-2 px-3 rounded-md transition-colors text-sm"
                                disabled={!selectedCalendarId}
                            >
                                Applica calendario predefinito a tutti gli eventi non assegnati
                            </button>
                        </div>

                        {/* Event Specific Calendar Mapping */}
                        {events.length > 0 && (
                            <div className="bg-card/50 p-6 rounded-lg border border-border mb-6 max-h-96 overflow-y-auto">
                                <h4 className="text-lg font-bold text-foreground mb-4">Assegna Calendari per Evento ({events.length} totali)</h4>
                                <div className="space-y-4">
                                    {events.map(event => (
                                        <div key={event.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-secondary/30 rounded-md">
                                            <p className="font-semibold text-foreground flex-grow pr-4 mb-2 sm:mb-0 text-ellipsis overflow-hidden whitespace-nowrap">{event.subject}</p>
                                            <div className="w-full sm:w-1/2">
                                                <label htmlFor={`event-cal-select-${event.id}`} className="sr-only">Calendario per {event.subject}</label>
                                                <select
                                                    id={`event-cal-select-${event.id}`}
                                                    // Use specific mapping or default selected calendar
                                                    value={eventCalendarMappings[event.id] || selectedCalendarId} 
                                                    onChange={(e) => handleEventCalendarChange(event.id, e.target.value)}
                                                    className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                                                >
                                                    {calendars.map(cal => (
                                                        <option key={cal.id} value={cal.id}>{cal.summary}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Import button */}
                        <div className="mt-8 flex justify-center space-x-4">
                            <button
                                onClick={handleImport}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full shadow-lg shadow-primary/20 transform hover:scale-105 transition-all duration-300"
                                disabled={isImportButtonDisabled}
                            >
                                Importa {events.length} Eventi
                            </button>
                             <button
                                onClick={() => resetGCalState(true)}
                                className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-4 rounded-full transition-colors"
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                );
            case 'importing':
                 return (
                    <div className="text-center">
                        <Loader />
                        <p className="text-muted-foreground mt-4">Importazione in corso...</p>
                        <div className="w-full bg-muted rounded-full h-2.5 mt-4">
                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${importProgress}%` }}></div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{Math.round(events.length * (importProgress/100))} di {events.length} eventi importati</p>
                    </div>
                 );
             case 'complete':
                return (
                    <div className="animate-fade-in text-center max-w-2xl mx-auto">
                        <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-foreground">Importazione Completata!</h3>
                        <p className="text-muted-foreground mt-2">
                            <span className="font-semibold text-green-400">{importResult?.successCount || 0}</span> eventi importati con successo.
                        </p>
                        {importResult && importResult.failures.length > 0 && (
                            <div className="mt-6 text-left bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                                <h4 className="font-semibold text-destructive-foreground/90 mb-2">
                                    <span className="font-bold">{importResult.failures.length}</span> eventi non sono stati importati:
                                </h4>
                                <ul className="text-sm text-destructive-foreground/80 space-y-2 max-h-48 overflow-y-auto">
                                    {importResult.failures.map((failure, index) => (
                                        <li key={index}>
                                            <strong>{failure.event.subject}:</strong> {failure.error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="mt-8 flex justify-center space-x-4">
                            <button
                                onClick={onReset}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Inizia di Nuovo
                            </button>
                             <button
                                onClick={() => resetGCalState(true)}
                                className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Torna Indietro
                            </button>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <div className="animate-fade-in text-center max-w-lg mx-auto">
                        <div className="bg-destructive/10 border border-destructive/30 text-destructive-foreground/80 px-4 py-3 rounded-lg">
                            <h3 className="font-bold text-lg">{gcalError?.title || 'Errore Sconosciuto'}</h3>
                            <p className="text-sm mt-2">{gcalError?.message || 'Si è verificato un errore imprevisto.'}</p>
                        </div>
                         <div className="mt-8 flex justify-center space-x-4">
                            <button
                                onClick={() => handleAuth('consent')} // Offer a way to re-authenticate
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Riprova Accesso
                            </button>
                             <button
                                onClick={() => resetGCalState(true)}
                                className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors"
                            >
                                Torna Indietro
                            </button>
                        </div>
                    </div>
                 );
        }
    };

    let content;
    switch (view) {
        case 'csv':
            content = <CsvView />;
            break;
        case 'ics':
            content = <IcsView />;
            break;
        case 'gcal':
            content = <GCalView />;
            break;
        default: // 'choice'
            content = (
                 <div className="animate-fade-in">
                    <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">Scegli come salvare i tuoi {events.length} eventi. Puoi importarli direttamente nel tuo Google Calendar, o scaricarli in un formato compatibile.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Google Calendar Card */}
                        <div className="bg-card/50 p-6 rounded-lg border border-border flex flex-col items-center text-center hover:border-primary hover:bg-accent transition-all duration-300">
                            <GoogleIcon className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-bold text-foreground mb-2">Importa in Google Calendar</h3>
                            <p className="text-muted-foreground text-sm mb-6 flex-grow">
                                Accedi al tuo account Google per importare gli eventi direttamente in un calendario a tua scelta. Il modo più semplice e veloce.
                            </p>
                            <button
                                onClick={() => setView('gcal')}
                                disabled={!gcal.isGoogleClientConfigured}
                                className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-secondary-foreground font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                <CalendarPlusIcon className="h-5 w-5" />
                                <span>Importa in Google Calendar</span>
                            </button>
                        </div>

                        {/* CSV Card */}
                        <div className="bg-card/50 p-6 rounded-lg border border-border flex flex-col items-center text-center hover:border-primary hover:bg-accent transition-all duration-300">
                            <DownloadIcon className="h-12 w-12 mb-4 text-primary" />
                            <h3 className="text-lg font-bold text-foreground mb-2">Scarica come .CSV</h3>
                            <p className="text-muted-foreground text-sm mb-6 flex-grow">
                                Esporta un file CSV compatibile con la funzione di importazione di Google Calendar. Utile per modifiche di massa o backup.
                            </p>
                            <button
                                onClick={handleDownloadCsv}
                                className="w-full bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                <DownloadIcon className="h-5 w-5" />
                                <span>Scarica come .CSV</span>
                            </button>
                        </div>

                        {/* ICS Card */}
                        <div className="bg-card/50 p-6 rounded-lg border border-border flex flex-col items-center text-center hover:border-primary hover:bg-accent transition-all duration-300">
                            <CalendarDaysIcon className="h-12 w-12 mb-4 text-primary" />
                            <h3 className="text-lg font-bold text-foreground mb-2">Scarica come .ICS (Universale)</h3>
                            <p className="text-muted-foreground text-sm mb-6 flex-grow">
                                Esporta un file .ics standard, compatibile con Apple Calendar, Outlook e la maggior parte delle altre app di calendario.
                            </p>
                            <button
                                onClick={handleDownloadIcs}
                                className="w-full bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                <CalendarDaysIcon className="h-5 w-5" />
                                <span>Scarica come .ICS</span>
                            </button>
                        </div>

                        {/* JSON Card */}
                        <div className="bg-card/50 p-6 rounded-lg border border-border flex flex-col items-center text-center hover:border-primary hover:bg-accent transition-all duration-300">
                            <JsonIcon className="h-12 w-12 mb-4 text-primary" />
                            <h3 className="text-lg font-bold text-foreground mb-2">Scarica come .JSON</h3>
                            <p className="text-muted-foreground text-sm mb-6 flex-grow">
                                Esporta i dati degli eventi grezzi in formato JSON. Utile per sviluppatori o per l'integrazione con altri sistemi.
                            </p>
                            <button
                                onClick={handleDownloadJson}
                                className="w-full bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                            >
                                <JsonIcon className="h-5 w-5" />
                                <span>Scarica come .JSON</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
    }

    return <div className="p-4 sm:p-6 bg-card rounded-lg shadow-md">{content}</div>;
};