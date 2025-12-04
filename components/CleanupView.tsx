import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as gcal from '../services/googleCalendarService';
import { Loader } from './Loader';
import { GoogleIcon, SearchIcon, Trash2Icon, SparklesIcon, CalendarIcon, ChevronsUpDownIcon, ArrowLeftIcon } from './Icons';
import { findEventsToDelete } from '../services/geminiService';

type GCalState = 'initial' | 'authenticating' | 'authenticated' | 'loading' | 'error';
interface GCalError { title: string; message: string; }
interface Calendar { id: string; summary: string; primary?: boolean; }
interface CleanupViewProps {
    setPage: (page: 'dashboard' | 'import' | 'cleanup') => void;
}
interface ManualFilters {
    startDate: string;
    endDate: string;
    text: string;
    location: string;
}
interface EventWithCalendarId extends gcal.GCalEvent {
    calendarId: string;
}

export const CleanupView: React.FC<CleanupViewProps> = ({ setPage }) => {
    const [gcalState, setGCalState] = useState<GCalState>('initial');
    const [error, setError] = useState<GCalError | null>(null);
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
    const [isCalendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
    const [events, setEvents] = useState<EventWithCalendarId[]>([]);
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [manualFilters, setManualFilters] = useState<ManualFilters>({ startDate: '', endDate: '', text: '', location: '' });
    const [isSearching, setIsSearching] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    
    const calendarDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(event.target as Node)) {
                setCalendarDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            if (primaryCalendar) {
                setSelectedCalendarIds(new Set([primaryCalendar.id]));
            }
            setGCalState('authenticated');
        } catch (err: any) {
            setError({ title: 'Errore nel Caricamento Dati', message: err.message });
            setGCalState('error');
        }
    }, []);
    
    const handleTokenResponse = useCallback(async (tokenResponse: any) => {
        if (tokenResponse.error) {
            setError({ title: "Autenticazione Fallita", message: tokenResponse.error_description || "L'utente ha annullato l'accesso."});
            setGCalState('initial');
            return;
        }
        if (tokenResponse.access_token) {
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

    const fetchEventsFromSelectedCalendars = async (timeMin: string, timeMax: string): Promise<EventWithCalendarId[] | null> => {
        if (selectedCalendarIds.size === 0) {
            setError({ title: 'Nessun Calendario Selezionato', message: 'Per favore, seleziona almeno un calendario.' });
            return null;
        }
        
        const allEvents: EventWithCalendarId[] = [];
        for (const calId of selectedCalendarIds) {
            const eventsFromCal = await gcal.listEvents(calId, timeMin, timeMax);
            const eventsWithCalId = eventsFromCal.map(e => ({...e, calendarId: calId}));
            allEvents.push(...eventsWithCalId);
        }
        const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
        return uniqueEvents;
    };
    
    const performSearch = (searchFn: () => Promise<void>) => {
        setIsSearching(true);
        setError(null);
        setEvents([]);
        setSelectedEventIds(new Set());
        setSearchPerformed(false);
        searchFn().finally(() => {
            setIsSearching(false);
            setSearchPerformed(true);
        });
    }

    const handleAiSearch = async () => {
        if (!aiQuery.trim() || selectedCalendarIds.size === 0) return;
        performSearch(async () => {
            try {
                const now = new Date();
                const timeMin = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString();
                const fetchedEvents = await fetchEventsFromSelectedCalendars(timeMin, now.toISOString());
                
                if (fetchedEvents) {
                    const eventIdsToDelete = await findEventsToDelete(aiQuery, fetchedEvents);
                    const foundEvents = fetchedEvents.filter(e => eventIdsToDelete.includes(e.id));
                    setEvents(foundEvents);
                }
            } catch (err: any) {
                setError({ title: 'Errore durante la ricerca IA', message: err.message });
            }
        });
    };
    
    const handleManualSearch = async () => {
        if (selectedCalendarIds.size === 0) return;
        performSearch(async () => {
            try {
                const timeMin = manualFilters.startDate 
                    ? new Date(manualFilters.startDate).toISOString() 
                    : new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString();
                const timeMax = manualFilters.endDate 
                    ? new Date(new Date(manualFilters.endDate).setHours(23, 59, 59, 999)).toISOString()
                    : new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString();

                let fetchedEvents = await fetchEventsFromSelectedCalendars(timeMin, timeMax);
                
                if (fetchedEvents) {
                    const textFilter = manualFilters.text.toLowerCase();
                    const locationFilter = manualFilters.location.toLowerCase();
                    
                    const filtered = fetchedEvents.filter(event => {
                        const textMatch = !textFilter || event.summary?.toLowerCase().includes(textFilter) || event.description?.toLowerCase().includes(textFilter);
                        const locationMatch = !locationFilter || event.location?.toLowerCase().includes(locationFilter);
                        return textMatch && locationMatch;
                    });
                    setEvents(filtered);
                }
            } catch (err: any) {
                setError({ title: 'Errore durante la ricerca', message: err.message });
            }
        });
    };

    const handleSelect = (eventId: string) => {
        setSelectedEventIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(eventId)) newSet.delete(eventId);
            else newSet.add(eventId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedEventIds.size === events.length) {
            setSelectedEventIds(new Set());
        } else {
            setSelectedEventIds(new Set(events.map(e => e.id)));
        }
    };
    
    const handleDeleteSelected = async () => {
        if (selectedEventIds.size === 0 || !window.confirm(`Sei sicuro di voler eliminare ${selectedEventIds.size} eventi? Questa azione è irreversibile.`)) {
            return;
        }

        setIsDeleting(true);
        setError(null);

        const eventsToDelete = events.filter(e => selectedEventIds.has(e.id));
        const promises = eventsToDelete.map(e => gcal.deleteEvent(e.calendarId, e.id));
        const results = await Promise.allSettled(promises);

        const failedDeletions = results.filter(r => r.status === 'rejected');
        if (failedDeletions.length > 0) {
            console.error("Failed deletions:", failedDeletions);
            setError({ title: 'Eliminazione Parziale', message: `${failedDeletions.length} eventi non sono stati eliminati. Controlla la console.` });
        }

        setEvents(prev => prev.filter(e => !selectedEventIds.has(e.id)));
        setSelectedEventIds(new Set());
        setIsDeleting(false);
    };


    if (gcalState === 'initial' || gcalState === 'authenticating') {
        return (
            <div className="text-center p-8 bg-card rounded-lg border border-border">
                <h2 className="text-2xl font-bold mb-3">Pulisci il tuo Calendario</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                    Connettiti a Google per trovare e rimuovere eventi superflui usando filtri o l'intelligenza artificiale.
                </p>
                <div className="flex justify-center items-center space-x-4">
                     <button
                        onClick={() => setPage('dashboard')}
                        className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                    >
                       <ArrowLeftIcon className="h-5 w-5"/> <span>Indietro</span>
                    </button>
                    <button
                        onClick={handleAuth}
                        disabled={gcalState === 'authenticating'}
                        className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                    >
                        {gcalState === 'authenticating' ? <Loader className="h-5 w-5"/> : <GoogleIcon className="h-5 w-5" />}
                        <span>Connetti Google Calendar</span>
                    </button>
                </div>
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
                <div className="mt-6 flex justify-center items-center space-x-4">
                    <button onClick={() => setPage('dashboard')} className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full">
                         Torna alla Dashboard
                    </button>
                    <button onClick={handleAuth} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full">
                         Riprova Accesso
                    </button>
                </div>
            </div>
         );
    }
    
    const handleCalendarSelection = (calId: string) => {
        setSelectedCalendarIds(prev => {
            const newSet = new Set(prev);
            if(newSet.has(calId)) newSet.delete(calId);
            else newSet.add(calId);
            return newSet;
        })
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div className="text-center">
                 <p className="text-muted-foreground">Accesso effettuato come <span className="font-semibold text-foreground">{user?.email}</span></p>
            </div>
            {/* Calendar Selector */}
            <div className="max-w-4xl mx-auto" ref={calendarDropdownRef}>
                <label className="block mb-2 text-sm font-medium text-muted-foreground">Seleziona Calendari</label>
                <div className="relative">
                    <button onClick={() => setCalendarDropdownOpen(o => !o)} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-3 text-left flex justify-between items-center">
                        <span className="flex items-center space-x-2">
                            <CalendarIcon className="w-5 h-5 text-muted-foreground"/>
                            <span>{selectedCalendarIds.size} calendari selezionati</span>
                        </span>
                        <ChevronsUpDownIcon className="w-5 h-5 text-muted-foreground"/>
                    </button>
                    {isCalendarDropdownOpen && (
                        <div className="absolute z-10 top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg p-2 max-h-60 overflow-y-auto">
                            {calendars.map(cal => (
                                <label key={cal.id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded-md cursor-pointer">
                                    <input type="checkbox" checked={selectedCalendarIds.has(cal.id)} onChange={() => handleCalendarSelection(cal.id)} className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"/>
                                    <span>{cal.summary}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* AI Filter */}
            <div className="max-w-4xl mx-auto bg-card p-4 rounded-lg border border-border">
                <label htmlFor="ai-query" className="block mb-2 text-sm font-medium text-muted-foreground">Filtra con AI (Es. "riunioni settimana scorsa" o "eventi 4E")</label>
                <div className="flex space-x-2">
                    <input type="text" id="ai-query" value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder="Usa il linguaggio naturale..." className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-3"/>
                    <button onClick={handleAiSearch} disabled={isSearching || !aiQuery.trim()} className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold p-3 rounded-lg inline-flex items-center justify-center transition-colors">
                        {isSearching && !manualFilters.text ? <Loader className="h-5 w-5"/> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Manual Filters */}
            <div className="max-w-4xl mx-auto bg-card p-4 rounded-lg border border-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="startDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Inizio</label>
                        <input type="date" id="startDate" value={manualFilters.startDate} onChange={e => setManualFilters(f => ({...f, startDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Fine</label>
                        <input type="date" id="endDate" value={manualFilters.endDate} onChange={e => setManualFilters(f => ({...f, endDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                    <div className="lg:col-span-2">
                        <label htmlFor="text-filter" className="block mb-1 text-sm font-medium text-muted-foreground">Riepilogo / Descrizione</label>
                        <input type="text" id="text-filter" placeholder="Es. 'Riunione progetto'" value={manualFilters.text} onChange={e => setManualFilters(f => ({...f, text: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                    <div className="lg:col-span-2">
                         <label htmlFor="location-filter" className="block mb-1 text-sm font-medium text-muted-foreground">Luogo</label>
                        <input type="text" id="location-filter" placeholder="Es. 'Ufficio'" value={manualFilters.location} onChange={e => setManualFilters(f => ({...f, location: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                </div>
                 <div className="text-right pt-2">
                     <button onClick={handleManualSearch} disabled={isSearching} className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-2 px-6 rounded-lg inline-flex items-center space-x-2 transition-colors">
                        {isSearching ? <Loader className="h-5 w-5"/> : <SearchIcon className="h-5 w-5" />}
                        <span>Cerca Eventi</span>
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="max-w-4xl mx-auto">
                {isSearching && <div className="text-center py-4"><Loader /><p className="mt-2 text-muted-foreground">Ricerca in corso...</p></div>}
                
                {searchPerformed && !isSearching && events.length === 0 && (
                     <div className="text-center p-6 bg-card rounded-lg border border-border">
                        <p className="text-muted-foreground">Nessun evento trovato nei calendari selezionati. Prova a modificare i filtri.</p>
                    </div>
                )}

                {events.length > 0 && !isSearching && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-muted-foreground">
                                Trovati {events.length} eventi. {selectedEventIds.size} selezionati.
                            </p>
                            <button 
                                onClick={handleDeleteSelected}
                                disabled={selectedEventIds.size === 0 || isDeleting}
                                className="bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors"
                            >
                                {isDeleting ? <Loader className="h-5 w-5" /> : <Trash2Icon className="h-5 w-5" />}
                                <span>Elimina {selectedEventIds.size} Eventi</span>
                            </button>
                        </div>
                        
                        <div className="bg-card border border-border rounded-lg overflow-hidden">
                            <div className="grid grid-cols-[auto,1fr,auto,auto] sm:grid-cols-[auto,2fr,1fr,1fr] gap-4 px-4 py-2 bg-secondary text-xs font-medium text-muted-foreground uppercase items-center">
                                <input 
                                    type="checkbox"
                                    checked={events.length > 0 && selectedEventIds.size === events.length}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"
                                    aria-label="Seleziona tutti gli eventi"
                                />
                                <div>Riepilogo Evento</div>
                                <div className="hidden sm:block">Ora di Inizio</div>
                                <div className="hidden sm:block">Luogo</div>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto">
                                {events.map(event => (
                                    <div key={event.id} className="grid grid-cols-[auto,1fr,auto,auto] sm:grid-cols-[auto,2fr,1fr,1fr] gap-4 px-4 py-3 border-t border-border items-center hover:bg-accent transition-colors text-sm">
                                        <input 
                                            type="checkbox"
                                            checked={selectedEventIds.has(event.id)}
                                            onChange={() => handleSelect(event.id)}
                                            className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"
                                            aria-label={`Seleziona evento ${event.summary}`}
                                        />
                                        <div>
                                            <p className="font-semibold text-foreground truncate" title={event.summary}>{event.summary}</p>
                                            <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                                {new Date(event.start.dateTime || event.start.date || '').toLocaleString('it-IT', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                                                {' - '}{event.location || 'N/D'}
                                            </div>
                                        </div>
                                        <div className="hidden sm:block text-muted-foreground">
                                            {new Date(event.start.dateTime || event.start.date || '').toLocaleString('it-IT', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                                        </div>
                                        <div className="hidden sm:block text-muted-foreground truncate" title={event.location || 'N/D'}>{event.location || 'N/D'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};