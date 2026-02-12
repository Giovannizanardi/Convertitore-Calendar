import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as gcal from '../services/googleCalendarService';
import { Loader } from './Loader';
import { GoogleIcon, SearchIcon, Trash2Icon, SparklesIcon, CalendarIcon, ChevronsUpDownIcon, ArrowLeftIcon, XIcon } from './Icons';
import { parseFilterFromQuery, FilterParams } from '../services/geminiService';

type GCalState = 'initial' | 'authenticating' | 'authenticated' | 'loading' | 'error';
interface GCalError { title: string; message: string; }
interface Calendar { id: string; summary: string; primary?: boolean; }
interface CleanupViewProps {
    setPage: (page: 'dashboard' | 'import' | 'cleanup') => void;
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
    const [deletionProgress, setDeletionProgress] = useState<{ current: number; total: number } | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    // FIX: Added 'startTime' to match the updated FilterParams interface in geminiService.ts
    const [manualFilters, setManualFilters] = useState<FilterParams>({ startDate: '', endDate: '', startTime: '', text: '', location: '' });
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
        // Deduplicate events based on ID (though unique per calendar, good practice if merging similar lists)
        const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
        return uniqueEvents;
    };
    
    // Core search logic that takes specific filters as arguments
    const executeSearch = async (filters: FilterParams) => {
        if (selectedCalendarIds.size === 0) return;
        
        setIsSearching(true);
        setError(null);
        setEvents([]);
        setSelectedEventIds(new Set());
        setSearchPerformed(false);
        
        try {
            // Helper to get local date ISO string properly
            // We append T00:00:00 for start and T23:59:59 for end to ensure we cover the whole local day
            // and then convert to ISO (which will be UTC).
            // Example: "2024-12-09" -> "2024-12-09T00:00:00" Local -> ISO UTC
            
            const timeMin = filters.startDate 
                ? new Date(`${filters.startDate}T00:00:00`).toISOString() 
                : new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString();
            
            const timeMax = filters.endDate 
                ? new Date(`${filters.endDate}T23:59:59.999`).toISOString()
                : new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString();

            let fetchedEvents = await fetchEventsFromSelectedCalendars(timeMin, timeMax);
            
            if (fetchedEvents) {
                const textFilter = filters.text.toLowerCase();
                const locationFilter = filters.location.toLowerCase();
                // FIX: Implemented startTime filtering to match FilterParams usage
                const startTimeFilter = filters.startTime;
                
                const filtered = fetchedEvents.filter(event => {
                    const textMatch = !textFilter || (event.summary?.toLowerCase().includes(textFilter) || event.description?.toLowerCase().includes(textFilter));
                    const locationMatch = !locationFilter || event.location?.toLowerCase().includes(locationFilter);
                    
                    let startTimeMatch = true;
                    if (startTimeFilter) {
                        const eventDateTime = event.start.dateTime || event.start.date || '';
                        if (eventDateTime) {
                            const eventDateObj = new Date(eventDateTime);
                            const eventTimeStr = eventDateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
                            startTimeMatch = eventTimeStr.includes(startTimeFilter);
                        } else {
                            startTimeMatch = false;
                        }
                    }

                    return textMatch && locationMatch && startTimeMatch;
                });
                setEvents(filtered);
            }
        } catch (err: any) {
            setError({ title: 'Errore durante la ricerca', message: err.message });
        } finally {
            setIsSearching(false);
            setSearchPerformed(true);
        }
    };

    // Triggered by AI button
    const handleAiAutoFill = async () => {
        if (!aiQuery.trim()) return;
        
        setIsSearching(true); // Show loading state while AI thinks
        try {
            const result = await parseFilterFromQuery(aiQuery);
            // Update UI with the AI interpreted filters
            setManualFilters(result);
            // Execute search immediately with these results
            await executeSearch(result);
        } catch (err: any) {
            console.error("AI Error:", err);
            setError({ title: "Errore Interpretazione IA", message: err.message || "Si è verificato un errore." });
            setIsSearching(false);
        }
    };
    
    // Triggered by manual "Cerca Eventi" button
    const handleManualSearchBtn = () => {
        executeSearch(manualFilters);
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
        const totalToDelete = selectedEventIds.size;
        if (totalToDelete === 0 || !window.confirm(`Sei sicuro di voler eliminare ${totalToDelete} eventi? Questa azione è irreversibile.`)) {
            return;
        }

        setIsDeleting(true);
        setDeletionProgress({ current: 0, total: totalToDelete });
        setError(null);

        const eventsToDelete = events.filter(e => selectedEventIds.has(e.id));
        const BATCH_SIZE = 10;
        const failedDeletions: any[] = [];
        const successfulIds = new Set<string>();

        // Helper to wait
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            for (let i = 0; i < eventsToDelete.length; i += BATCH_SIZE) {
                const batch = eventsToDelete.slice(i, i + BATCH_SIZE);
                
                // Execute batch in parallel and wait for all to settle
                const results = await Promise.allSettled(
                    batch.map(e => gcal.deleteEvent(e.calendarId, e.id))
                );

                results.forEach((result, index) => {
                    const event = batch[index];
                    if (result.status === 'fulfilled') {
                        successfulIds.add(event.id);
                    } else {
                        console.error(`Failed to delete event ${event.id}:`, result.reason);
                        failedDeletions.push({ event, error: result.reason });
                    }
                });

                // Update progress
                setDeletionProgress({ current: Math.min(i + BATCH_SIZE, totalToDelete), total: totalToDelete });

                // Add delay if not the last batch to be gentle with the API
                if (i + BATCH_SIZE < eventsToDelete.length) {
                    await delay(500); // 500ms delay between batches
                }
            }
        } catch (e: any) {
            console.error("Critical error during batch deletion:", e);
             setError({ 
                title: 'Errore Critico', 
                message: "Si è verificato un errore imprevisto durante l'elaborazione dei lotti." 
            });
        } finally {
            // Update the events list to remove successful deletions
            setEvents(prev => prev.filter(e => !successfulIds.has(e.id)));
            
            if (failedDeletions.length > 0) {
                console.error("Summary of failed deletions:", failedDeletions);
                setError({ 
                    title: 'Eliminazione Parziale', 
                    message: `${failedDeletions.length} eventi su ${totalToDelete} non sono stati eliminati. Potresti aver raggiunto il limite di richieste API o gli eventi potrebbero essere stati spostati.` 
                });
                // Update selection to only contain failed items so user can try again easily
                setSelectedEventIds(new Set(failedDeletions.map(f => f.event.id)));
            } else {
                setSelectedEventIds(new Set());
            }

            setIsDeleting(false);
            setDeletionProgress(null);
        }
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
            
            {/* Inline Error Display */}
            {error && gcalState !== 'error' && (
                <div className="max-w-4xl mx-auto bg-destructive/10 border border-destructive/30 text-destructive-foreground px-4 py-3 rounded-lg relative flex justify-between items-start" role="alert">
                    <div>
                        <strong className="font-bold">{error.title}: </strong>
                        <span className="block sm:inline">{error.message}</span>
                    </div>
                    <button onClick={() => setError(null)} className="ml-4 p-1 rounded hover:bg-destructive/20 transition-colors">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            )}

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
                <label htmlFor="ai-query" className="block mb-2 text-sm font-medium text-foreground">
                    Compilazione Automatica Filtri (AI)
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                    Scrivi cosa cerchi (es. "Colloqui dicembre" o "Riunioni settimana prossima") e l'IA compilerà i filtri qui sotto per te.
                </p>
                <div className="flex space-x-2">
                    <input 
                        type="text" 
                        id="ai-query" 
                        value={aiQuery} 
                        onChange={e => setAiQuery(e.target.value)} 
                        placeholder="Es: 'Lezioni di yoga del 2024'..." 
                        className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-3"
                        onKeyDown={(e) => e.key === 'Enter' && handleAiAutoFill()}
                    />
                    <button 
                        onClick={handleAiAutoFill} 
                        disabled={isSearching || !aiQuery.trim()} 
                        className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold p-3 rounded-lg inline-flex items-center justify-center transition-colors min-w-[50px]"
                        title="Chiedi all'IA di compilare i filtri"
                    >
                        {isSearching && !manualFilters.text && !manualFilters.startDate ? <Loader className="h-5 w-5"/> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Manual Filters */}
            <div className="max-w-4xl mx-auto bg-card p-4 rounded-lg border border-border space-y-4 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label htmlFor="startDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Inizio</label>
                        <input type="date" id="startDate" value={manualFilters.startDate} onChange={e => setManualFilters(f => ({...f, startDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Fine</label>
                        <input type="date" id="endDate" value={manualFilters.endDate} onChange={e => setManualFilters(f => ({...f, endDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
                    </div>
                    {/* FIX: Added startTime input field to manual filters */}
                    <div>
                        <label htmlFor="startTime" className="block mb-1 text-sm font-medium text-muted-foreground">Ora Inizio</label>
                        <input type="time" id="startTime" value={manualFilters.startTime} onChange={e => setManualFilters(f => ({...f, startTime: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"/>
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
                 <div className="text-right pt-2 border-t border-border mt-2">
                     <button onClick={handleManualSearchBtn} disabled={isSearching} className="bg-secondary hover:bg-muted disabled:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-lg inline-flex items-center space-x-2 transition-colors border border-border">
                        {isSearching ? <Loader className="h-5 w-5"/> : <SearchIcon className="h-5 w-5" />}
                        <span>Cerca con questi Filtri</span>
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="max-w-4xl mx-auto">
                {isSearching && <div className="text-center py-4"><Loader /><p className="mt-2 text-muted-foreground">Ricerca in corso...</p></div>}
                
                {searchPerformed && !isSearching && events.length === 0 && (
                     <div className="text-center p-6 bg-card rounded-lg border border-border">
                        <p className="text-muted-foreground">Nessun evento trovato nei calendari selezionati con i filtri attuali.</p>
                        <p className="text-xs text-muted-foreground mt-1">Verifica le date e le parole chiave sopra.</p>
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
                                <span>
                                    {isDeleting && deletionProgress 
                                        ? `Eliminazione (${deletionProgress.current}/${deletionProgress.total})...`
                                        : `Elimina ${selectedEventIds.size} Eventi`
                                    }
                                </span>
                            </button>
                        </div>
                        
                        <div className="bg-card border border-border rounded-lg overflow-hidden">
                            <div className="grid grid-cols-[auto,2fr,1fr,1fr] gap-4 px-4 py-2 bg-secondary text-xs font-medium text-muted-foreground uppercase items-center">
                                <input 
                                    type="checkbox"
                                    checked={events.length > 0 && selectedEventIds.size === events.length}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"
                                    aria-label="Seleziona tutti gli eventi"
                                />
                                <div>Riepilogo Evento</div>
                                <div>Ora di Inizio</div>
                                <div>Luogo</div>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto">
                                {events.map(event => (
                                    <div key={event.id} className="grid grid-cols-[auto,2fr,1fr,1fr] gap-4 px-4 py-3 border-t border-border items-center hover:bg-accent transition-colors text-sm">
                                        <input 
                                            type="checkbox"
                                            checked={selectedEventIds.has(event.id)}
                                            onChange={() => handleSelect(event.id)}
                                            className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"
                                            aria-label={`Seleziona evento ${event.summary}`}
                                        />
                                        <p className="font-semibold text-foreground truncate" title={event.summary}>{event.summary}</p>
                                        <div className="text-muted-foreground">
                                            {new Date(event.start.dateTime || event.start.date || '').toLocaleString('it-IT', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                                        </div>
                                        <div className="text-muted-foreground truncate" title={event.location || 'N/D'}>{event.location || 'N/D'}</div>
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
