import React, { useState, useEffect, useCallback } from 'react';
import * as gcal from '../services/googleCalendarService';
import { Loader } from './Loader';
// FIX: Import SparklesIcon to resolve 'Cannot find name' error.
import { GoogleIcon, SearchIcon, Trash2Icon, SparklesIcon } from './Icons';
import { findEventsToDelete } from '../services/geminiService';

type GCalState = 'initial' | 'authenticating' | 'authenticated' | 'loading' | 'error';
interface GCalError { title: string; message: string; }
interface Calendar { id: string; summary: string; primary?: boolean; }

export const CleanupView: React.FC = () => {
    const [gcalState, setGCalState] = useState<GCalState>('initial');
    const [error, setError] = useState<GCalError | null>(null);
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState('');
    const [events, setEvents] = useState<gcal.GCalEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleGapiLoad = useCallback(async () => {
        try {
            await gcal.initGapiClient();
        } catch (err: any) {
            setError({ title: 'Errore di Inizializzazione', message: err.message });
            setGCalState('error');
        }
    }, []);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        // FIX: Cast window to any to access gapi, which is loaded from an external script.
        script.onload = () => (window as any).gapi.load('client', handleGapiLoad);
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, [handleGapiLoad]);

    const fetchInitialData = useCallback(async () => {
        try {
            const userInfoResponse = await gcal.getUserProfile();
            if (!userInfoResponse?.result?.email) throw new Error("Profilo utente non trovato.");
            setUser(userInfoResponse.result);
            
            const calendarList = await gcal.listCalendars();
            setCalendars(calendarList);
            const primaryCalendar = calendarList.find((c: Calendar) => c.primary) || calendarList[0];
            if (primaryCalendar) setSelectedCalendarId(primaryCalendar.id);

            setGCalState('authenticated');
        } catch (err: any) {
            setError({ title: 'Errore nel Caricamento Dati', message: err.message });
            setGCalState('error');
        }
    }, []);
    
    const handleTokenResponse = useCallback(async (tokenResponse: any) => {
        if (tokenResponse.error) {
            setError({ title: "Autenticazione Fallita", message: tokenResponse.error_description || "L'utente ha annullato l'accesso."});
            setGCalState('initial'); // Torna allo stato iniziale
            return;
        }
        if (tokenResponse.access_token) {
            // FIX: Cast window to any to access gapi, which is loaded from an external script.
            (window as any).gapi.client.setToken(tokenResponse);
            setGCalState('loading');
            await fetchInitialData();
        }
    }, [fetchInitialData]);

    const handleAuth = () => {
        setGCalState('authenticating');
        setError(null);
        gcal.handleAuthClick((token) => handleTokenResponse(token));
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !selectedCalendarId) return;
        
        setIsSearching(true);
        setError(null);

        try {
            const now = new Date();
            const timeMin = new Date();
            timeMin.setFullYear(now.getFullYear() - 5); // Cerca negli ultimi 5 anni
            
            const fetchedEvents = await gcal.listEvents(selectedCalendarId, timeMin.toISOString(), now.toISOString());
            
            // Simula la ricerca AI
            const eventIdsToDelete = await findEventsToDelete(searchQuery, fetchedEvents);
            const foundEvents = fetchedEvents.filter(e => eventIdsToDelete.includes(e.id));
            setEvents(foundEvents);

        } catch (err: any) {
            setError({ title: 'Errore durante la ricerca', message: err.message });
        } finally {
            setIsSearching(false);
        }
    };


    if (gcalState === 'initial' || gcalState === 'authenticating') {
        return (
            <div className="text-center p-8 bg-card rounded-lg border border-border">
                <h2 className="text-2xl font-bold mb-3">Pulisci il tuo Calendario</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                    Connettiti al tuo account Google per trovare e rimuovere eventi superflui usando filtri potenti o chiedendo all'intelligenza artificiale.
                </p>
                <button
                    onClick={handleAuth}
                    disabled={gcalState === 'authenticating'}
                    className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                >
                    {gcalState === 'authenticating' ? <Loader className="h-5 w-5"/> : <GoogleIcon className="h-5 w-5" />}
                    <span>Connetti Google Calendar</span>
                </button>
            </div>
        );
    }
    
    if (gcalState === 'loading') {
        return <div className="text-center p-8"><Loader /><p className="mt-4 text-muted-foreground">Caricamento dati...</p></div>;
    }

    if (gcalState === 'error' && error) {
         return (
             <div className="text-center p-8 bg-destructive/10 border border-destructive/30 rounded-lg">
                <h3 className="font-bold text-lg text-destructive-foreground/90">{error.title}</h3>
                <p className="text-sm mt-2 text-destructive-foreground/80">{error.message}</p>
                 <button onClick={handleAuth} className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full">
                     Riprova Accesso
                 </button>
            </div>
         );
    }

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <p className="text-center text-muted-foreground mb-2">Accesso effettuato come <span className="font-semibold text-foreground">{user?.email}</span></p>
                <div className="max-w-3xl mx-auto bg-card p-6 rounded-lg border border-border space-y-4">
                    <div>
                        <label htmlFor="calendar-select" className="block mb-2 text-sm font-medium text-muted-foreground">1. Scegli un calendario da analizzare</label>
                        <select
                           id="calendar-select"
                           value={selectedCalendarId}
                           onChange={(e) => setSelectedCalendarId(e.target.value)}
                           className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                        >
                           {calendars.map(cal => <option key={cal.id} value={cal.id}>{cal.summary}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="ai-query" className="block mb-2 text-sm font-medium text-muted-foreground">2. Descrivi gli eventi da trovare</label>
                        <div className="relative">
                            <input
                                type="text"
                                id="ai-query"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Es: 'tutte le riunioni ricorrenti di sync del mese scorso' o 'eventi senza partecipanti'"
                                className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-3 pl-10"
                            />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <SparklesIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                    <div className="text-center pt-2">
                         <button
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-3 px-8 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                        >
                            {isSearching ? <Loader className="h-5 w-5"/> : <SearchIcon className="h-5 w-5" />}
                            <span>Trova Eventi</span>
                        </button>
                    </div>
                </div>
            </div>

            {isSearching && <div className="text-center py-4"><Loader /><p className="mt-2 text-muted-foreground">Ricerca in corso...</p></div>}

            {events.length > 0 && (
                <div className="max-w-3xl mx-auto animate-fade-in">
                    <h3 className="text-xl font-semibold mb-4 text-center">Risultati della Ricerca</h3>
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                        {events.map(event => (
                            <div key={event.id} className="bg-secondary p-3 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-secondary-foreground">{event.summary}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(event.start.dateTime || event.start.date || '').toLocaleString()}
                                    </p>
                                </div>
                                <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Vedi</a>
                            </div>
                        ))}
                    </div>
                     <div className="text-center mt-6">
                         <button
                            disabled // Abilitare dopo aver implementato la selezione
                            className="bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-bold py-3 px-8 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                        >
                            <Trash2Icon className="h-5 w-5" />
                            <span>Elimina Selezionati (Prossimamente)</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
