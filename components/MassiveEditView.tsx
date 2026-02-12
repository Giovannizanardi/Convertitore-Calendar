
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as gcal from '../services/googleCalendarService';
import { Loader } from './Loader';
// Added missing CheckCircleIcon to the imports
import { GoogleIcon, SearchIcon, PencilLineIcon, SparklesIcon, CalendarIcon, ChevronsUpDownIcon, ArrowLeftIcon, XIcon, ClockIcon, CheckCircleIcon } from './Icons';
import { parseFilterFromQuery, FilterParams } from '../services/geminiService';

type GCalState = 'initial' | 'authenticating' | 'authenticated' | 'loading' | 'error';
interface GCalError { title: string; message: string; }
interface Calendar { id: string; summary: string; primary?: boolean; }
interface MassiveEditViewProps {
    setPage: (page: 'dashboard' | 'import' | 'cleanup' | 'massive-edit') => void;
}
interface EventWithCalendarId extends gcal.GCalEvent {
    calendarId: string;
}

export const MassiveEditView: React.FC<MassiveEditViewProps> = ({ setPage }) => {
    const [gcalState, setGCalState] = useState<GCalState>('initial');
    const [error, setError] = useState<GCalError | null>(null);
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
    const [isCalendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
    const [events, setEvents] = useState<EventWithCalendarId[]>([]);
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState<{ current: number; total: number } | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [manualFilters, setManualFilters] = useState<FilterParams>({ startDate: '', endDate: '', text: '', location: '' });
    const [isSearching, setIsSearching] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    
    const [bulkUpdates, setBulkUpdates] = useState({
        summary: '',
        location: '',
        description: '',
        duration: ''
    });

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

    const executeSearch = async (filters: FilterParams) => {
        if (selectedCalendarIds.size === 0) return;
        
        setIsSearching(true);
        setError(null);
        setEvents([]);
        setSelectedEventIds(new Set());
        setSearchPerformed(false);
        
        try {
            const timeMin = filters.startDate 
                ? new Date(`${filters.startDate}T00:00:00`).toISOString() 
                : new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString();
            
            const timeMax = filters.endDate 
                ? new Date(`${filters.endDate}T23:59:59.999`).toISOString()
                : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

            const allEvents: EventWithCalendarId[] = [];
            for (const calId of selectedCalendarIds) {
                const eventsFromCal = await gcal.listEvents(calId, timeMin, timeMax);
                allEvents.push(...eventsFromCal.map(e => ({...e, calendarId: calId})));
            }
            
            const textFilter = filters.text.toLowerCase();
            const locationFilter = filters.location.toLowerCase();
            
            const filtered = allEvents.filter(event => {
                const textMatch = !textFilter || (event.summary?.toLowerCase().includes(textFilter) || event.description?.toLowerCase().includes(textFilter));
                const locationMatch = !locationFilter || event.location?.toLowerCase().includes(locationFilter);
                return textMatch && locationMatch;
            });
            setEvents(filtered);
        } catch (err: any) {
            setError({ title: 'Errore durante la ricerca', message: err.message });
        } finally {
            setIsSearching(false);
            setSearchPerformed(true);
        }
    };

    const handleAiAutoFill = async () => {
        if (!aiQuery.trim()) return;
        setIsSearching(true);
        try {
            const result = await parseFilterFromQuery(aiQuery);
            setManualFilters(result);
            await executeSearch(result);
        } catch (err: any) {
            setError({ title: "Errore Interpretazione IA", message: err.message });
            setIsSearching(false);
        }
    };
    
    const handleUpdateSelected = async () => {
        const totalToUpdate = selectedEventIds.size;
        if (totalToUpdate === 0) return;
        
        const updatesAvailable = bulkUpdates.summary || bulkUpdates.location || bulkUpdates.description || bulkUpdates.duration;
        if (!updatesAvailable) {
            alert("Per favore, inserisci almeno una modifica da applicare.");
            return;
        }

        setIsUpdating(true);
        setUpdateProgress({ current: 0, total: totalToUpdate });
        setError(null);

        const selectedEvents = events.filter(e => selectedEventIds.has(e.id));
        const BATCH_SIZE = 5;
        const failedUpdates: any[] = [];

        try {
            for (let i = 0; i < selectedEvents.length; i += BATCH_SIZE) {
                const batch = selectedEvents.slice(i, i + BATCH_SIZE);
                
                await Promise.allSettled(
                    batch.map(async (event) => {
                        const resource: any = {};
                        if (bulkUpdates.summary) resource.summary = bulkUpdates.summary;
                        if (bulkUpdates.location) resource.location = bulkUpdates.location;
                        if (bulkUpdates.description) resource.description = bulkUpdates.description;
                        
                        if (bulkUpdates.duration) {
                            const minutes = parseInt(bulkUpdates.duration);
                            if (!isNaN(minutes)) {
                                const start = new Date(event.start.dateTime || event.start.date || '');
                                const newEnd = new Date(start.getTime() + minutes * 60000);
                                resource.end = { dateTime: newEnd.toISOString() };
                            }
                        }

                        try {
                            await gcal.patchEvent(event.calendarId, event.id, resource);
                        } catch (e: any) {
                            failedUpdates.push({ event, error: e.message });
                        }
                    })
                );

                setUpdateProgress({ current: Math.min(i + BATCH_SIZE, totalToUpdate), total: totalToUpdate });
                if (i + BATCH_SIZE < selectedEvents.length) await new Promise(r => setTimeout(r, 500));
            }
        } catch (e: any) {
            setError({ title: 'Errore Critico', message: "Errore durante l'aggiornamento in blocco." });
        } finally {
            setIsUpdating(false);
            setUpdateProgress(null);
            
            if (failedUpdates.length > 0) {
                setError({ 
                    title: 'Modifica Parziale', 
                    message: `${failedUpdates.length} eventi su ${totalToUpdate} non sono stati aggiornati.` 
                });
            } else {
                alert("Aggiornamento completato con successo!");
                setBulkUpdates({ summary: '', location: '', description: '', duration: '' });
                setSelectedEventIds(new Set());
                executeSearch(manualFilters); 
            }
        }
    };

    const handleSelectAll = () => {
        if (selectedEventIds.size === events.length) setSelectedEventIds(new Set());
        else setSelectedEventIds(new Set(events.map(e => e.id)));
    };

    if (gcalState === 'initial' || gcalState === 'authenticating') {
        return (
            <div className="text-center p-8 bg-card rounded-2xl border border-border shadow-xl">
                <h2 className="text-2xl font-bold mb-3">Modifica Massiva Eventi</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                    Connettiti a Google per trovare e aggiornare contemporaneamente più eventi nel tuo calendario.
                </p>
                <div className="flex justify-center items-center space-x-4">
                     <button onClick={() => setPage('dashboard')} className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all">
                       <ArrowLeftIcon className="h-5 w-5"/> <span>Indietro</span>
                    </button>
                    <button onClick={handleAuth} disabled={gcalState === 'authenticating'} className="bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all">
                        {gcalState === 'authenticating' ? <Loader className="h-5 w-5"/> : <GoogleIcon className="h-5 w-5" />}
                        <span>Connetti Google Calendar</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
            <div className="text-center">
                 <p className="text-muted-foreground">Accesso effettuato come <span className="font-semibold text-foreground">{user?.email}</span></p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground p-4 rounded-xl flex justify-between items-start animate-fade-in">
                    <div>
                        <p className="font-bold">{error.title}</p>
                        <p className="text-sm">{error.message}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-destructive/10 rounded-full">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* Calendar Selector */}
            <div className="max-w-4xl mx-auto" ref={calendarDropdownRef}>
                <div className="relative">
                    <button onClick={() => setCalendarDropdownOpen(o => !o)} className="bg-input border border-border text-foreground text-sm rounded-xl block w-full p-4 text-left flex justify-between items-center transition-all hover:bg-accent/50">
                        <span className="flex items-center space-x-3">
                            <CalendarIcon className="w-5 h-5 text-indigo-500"/>
                            <span className="font-medium">{selectedCalendarIds.size} calendari selezionati</span>
                        </span>
                        <CheckCircleIcon className={`w-5 h-5 text-green-500 transition-opacity ${selectedCalendarIds.size > 0 ? 'opacity-100' : 'opacity-0'}`} />
                        <ChevronsUpDownIcon className="w-5 h-5 text-muted-foreground"/>
                    </button>
                    {isCalendarDropdownOpen && (
                        <div className="absolute z-10 top-full mt-2 w-full bg-card border border-border rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto animate-fade-in">
                            {calendars.map(cal => (
                                <label key={cal.id} className="flex items-center space-x-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" checked={selectedCalendarIds.has(cal.id)} onChange={() => {
                                        const newSet = new Set(selectedCalendarIds);
                                        if(newSet.has(cal.id)) newSet.delete(cal.id);
                                        else newSet.add(cal.id);
                                        setSelectedCalendarIds(newSet);
                                    }} className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring"/>
                                    <span className="text-sm">{cal.summary}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Search Panel */}
            <div className="bg-card p-6 rounded-2xl border border-border shadow-lg space-y-4">
                <div className="flex space-x-2">
                    <input type="text" value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder="Usa l'IA: 'Lezioni del lunedì' o 'Tutti gli eventi in palestra'..." className="bg-input border border-border text-foreground text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full p-4" onKeyDown={e => e.key === 'Enter' && handleAiAutoFill()}/>
                    <button onClick={handleAiAutoFill} disabled={isSearching} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold p-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20"><SparklesIcon className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border">
                    <input type="date" value={manualFilters.startDate} onChange={e => setManualFilters(f => ({...f, startDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-xl p-3"/>
                    <input type="date" value={manualFilters.endDate} onChange={e => setManualFilters(f => ({...f, endDate: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-xl p-3"/>
                    <input type="text" placeholder="Cerca nel testo..." value={manualFilters.text} onChange={e => setManualFilters(f => ({...f, text: e.target.value}))} className="bg-input border border-border text-foreground text-sm rounded-xl p-3 lg:col-span-2"/>
                </div>
                <div className="text-right">
                    <button onClick={() => executeSearch(manualFilters)} disabled={isSearching} className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-3 px-8 rounded-xl inline-flex items-center space-x-2 transition-all">
                        {isSearching ? <Loader className="h-5 w-5"/> : <SearchIcon className="h-5 w-5" />}
                        <span>Cerca Eventi</span>
                    </button>
                </div>
            </div>

            {/* Massive Edit Form */}
            {selectedEventIds.size > 0 && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-2xl shadow-2xl animate-fade-in-down">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-3 text-indigo-400">
                             <PencilLineIcon className="h-6 w-6"/>
                             <h3 className="text-xl font-bold">Modifiche Rapide ({selectedEventIds.size} selezionati)</h3>
                        </div>
                        <button onClick={() => setSelectedEventIds(new Set())} className="p-2 hover:bg-indigo-500/10 rounded-full transition-colors"><XIcon className="h-6 w-6"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Oggetto</label>
                            <input type="text" placeholder="Nuovo titolo..." value={bulkUpdates.summary} onChange={e => setBulkUpdates(b => ({...b, summary: e.target.value}))} className="bg-input border border-border text-sm rounded-xl p-3.5 w-full focus:ring-indigo-500"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Luogo</label>
                            <input type="text" placeholder="Nuovo luogo..." value={bulkUpdates.location} onChange={e => setBulkUpdates(b => ({...b, location: e.target.value}))} className="bg-input border border-border text-sm rounded-xl p-3.5 w-full focus:ring-indigo-500"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Descrizione</label>
                            <input type="text" placeholder="Nuova descrizione..." value={bulkUpdates.description} onChange={e => setBulkUpdates(b => ({...b, description: e.target.value}))} className="bg-input border border-border text-sm rounded-xl p-3.5 w-full focus:ring-indigo-500"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Durata (minuti)</label>
                            <div className="flex space-x-2">
                                 <input type="number" placeholder="Es: 60" value={bulkUpdates.duration} onChange={e => setBulkUpdates(b => ({...b, duration: e.target.value}))} className="bg-input border border-border text-sm rounded-xl p-3.5 w-full focus:ring-indigo-500"/>
                                 <div className="bg-indigo-500/10 p-3.5 rounded-xl"><ClockIcon className="w-5 h-5 text-indigo-400"/></div>
                            </div>
                        </div>
                    </div>
                    
                    {updateProgress && (
                        <div className="mt-6 w-full max-w-md mx-auto space-y-2">
                            <div className="flex justify-between text-xs text-indigo-400">
                                <span>Aggiornamento in corso...</span>
                                <span>{updateProgress.current} / {updateProgress.total}</span>
                            </div>
                            <div className="w-full bg-indigo-500/10 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-full transition-all duration-300" 
                                    style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <button onClick={handleUpdateSelected} disabled={isUpdating} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-12 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center space-x-3 mx-auto transition-all transform hover:scale-105 active:scale-95">
                            {isUpdating ? <Loader className="h-5 w-5"/> : <PencilLineIcon className="h-5 w-5" />}
                            <span>{isUpdating ? `Aggiornamento in corso...` : `Applica Modifiche`}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Results Table */}
            {searchPerformed && !isSearching && events.length > 0 && (
                <div className="animate-fade-in pb-12">
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                        <div className="grid grid-cols-[auto,2fr,1fr,1fr] gap-4 px-6 py-4 bg-secondary/50 text-xs font-bold text-muted-foreground uppercase tracking-widest items-center">
                            <input type="checkbox" checked={selectedEventIds.size === events.length} onChange={handleSelectAll} className="w-5 h-5 text-indigo-500 bg-secondary border-border rounded focus:ring-indigo-500"/>
                            <div>Evento</div>
                            <div>Data e Ora</div>
                            <div>Luogo</div>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
                            {events.map(event => (
                                <div key={event.id} className="grid grid-cols-[auto,2fr,1fr,1fr] gap-4 px-6 py-5 items-center hover:bg-accent/40 transition-colors text-sm group">
                                    <input type="checkbox" checked={selectedEventIds.has(event.id)} onChange={() => {
                                        const newSet = new Set(selectedEventIds);
                                        if (newSet.has(event.id)) newSet.delete(event.id);
                                        else newSet.add(event.id);
                                        setSelectedEventIds(newSet);
                                    }} className="w-5 h-5 text-indigo-500 bg-secondary border-border rounded focus:ring-indigo-500"/>
                                    <div>
                                        <p className="font-bold text-foreground group-hover:text-indigo-400 transition-colors">{event.summary}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{event.description || 'Nessuna descrizione'}</p>
                                    </div>
                                    <div className="text-muted-foreground font-medium">
                                        {new Date(event.start.dateTime || event.start.date || '').toLocaleString('it-IT', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                                    </div>
                                    <div className="text-muted-foreground italic truncate">{event.location || '—'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
