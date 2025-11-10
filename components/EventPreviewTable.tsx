import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ValidatedEvent, EventObject, ValidationErrors } from '../lib/types';
import { validateEvent } from '../lib/validation';
import { Trash2Icon, SparklesIcon, ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon, CalendarPlusIcon } from './Icons';
import { BulkActions } from './BulkActions';
import { suggestCorrection } from '../services/geminiService';
import { Loader } from './Loader';
import { toYYYYMMDD } from '../lib/dateUtils';

interface EventPreviewTableProps {
  events: ValidatedEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ValidatedEvent[]>>;
  selectedEvents: Set<number>;
  setSelectedEvents: React.Dispatch<React.SetStateAction<Set<number>>>;
}

const tableHeaders: { key: keyof Omit<EventObject, 'id'>; label: string }[] = [
    { key: 'subject', label: 'Oggetto' },
    { key: 'startDate', label: 'Data Inizio' },
    { key: 'startTime', label: 'Ora Inizio' },
    { key: 'endDate', label: 'Data Fine' },
    { key: 'endTime', label: 'Ora Fine' },
    { key: 'location', label: 'Luogo' },
    { key: 'description', label: 'Descrizione' },
];

const FilterPanel: React.FC<{
    filters: Partial<Record<keyof Omit<EventObject, 'id'>, string>>;
    onFilterChange: (field: keyof Omit<EventObject, 'id'>, value: string) => void;
}> = ({ filters, onFilterChange }) => (
    <div className="mb-4 p-4 bg-card border border-border rounded-lg">
        <h3 className="font-semibold text-foreground mb-3">Filtra Eventi</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {tableHeaders.map(header => (
                <div key={`filter-${header.key}`}>
                    <label htmlFor={`filter-${header.key}`} className="sr-only">{header.label}</label>
                    <input
                        type="text"
                        id={`filter-${header.key}`}
                        placeholder={`${header.label}...`}
                        value={filters[header.key] || ''}
                        onChange={(e) => onFilterChange(header.key, e.target.value)}
                        className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2"
                        aria-label={`Filtra per ${header.label}`}
                    />
                </div>
            ))}
        </div>
    </div>
);

export const EventPreviewTable: React.FC<EventPreviewTableProps> = ({ events, setEvents, selectedEvents, setSelectedEvents }) => {
    const [filters, setFilters] = useState<Partial<Record<keyof Omit<EventObject, 'id'>, string>>>({});
    const [correctingField, setCorrectingField] = useState<{ eventId: number; field: keyof Omit<EventObject, 'id'> } | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Omit<EventObject, 'id'> | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const handleFieldChange = (id: number, field: keyof EventObject, value: string) => {
        setEvents(prevEvents => {
            const newEvents = prevEvents.map(event => {
                if (event.id === id) {
                    const updatedRawEvent: EventObject = { ...event, [field]: value };
                    return validateEvent(updatedRawEvent);
                }
                return event;
            });
            return newEvents;
        });
    };

    const handleDeleteRow = (id: number) => {
        setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
        setSelectedEvents(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        })
    };
    
    const handleAddRow = () => {
        setEvents(prevEvents => {
            // Find the highest existing ID to generate a new unique ID
            const maxId = prevEvents.reduce((max, event) => event.id > max ? event.id : max, -1);
            const newEventRaw: EventObject = {
                id: maxId + 1,
                subject: '',
                startDate: '',
                startTime: '',
                endDate: '',
                endTime: '',
                location: '',
                description: '',
            };
            // Validate the new (empty) event to get the correct structure
            const newValidatedEvent = validateEvent(newEventRaw);
            // Add the new event to the top of the list for immediate visibility
            return [newValidatedEvent, ...prevEvents];
        });
    };

    const handleSelect = (id: number) => {
        setSelectedEvents(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    };
    
    const sortedAndFilteredEvents = useMemo(() => {
        let processableEvents = [...events];

        // Filtering
        processableEvents = processableEvents.filter(event => {
            return (Object.entries(filters) as [keyof Omit<EventObject, 'id'>, string][]).every(([key, value]) => {
                const filterValue = value.toLowerCase();
                if (!filterValue) return true;
                const eventValue = String(event[key] ?? '').toLowerCase();
                return eventValue.includes(filterValue);
            });
        });
        
        // Sorting
        if (sortConfig.key) {
            processableEvents.sort((a, b) => {
                const aValue = a[sortConfig.key!] ?? '';
                const bValue = b[sortConfig.key!] ?? '';
                let comparison = 0;

                if (sortConfig.key === 'startDate' || sortConfig.key === 'endDate') {
                    const dateA = aValue ? toYYYYMMDD(aValue as string) : '';
                    const dateB = bValue ? toYYYYMMDD(bValue as string) : '';
                    comparison = dateA.localeCompare(dateB);
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        
        return processableEvents;
    }, [events, filters, sortConfig]);

    const handleSelectAll = () => {
        const filteredIds = new Set(sortedAndFilteredEvents.map(e => e.id));
        const areAllCurrentlyFilteredSelected = sortedAndFilteredEvents.length > 0 && sortedAndFilteredEvents.every(e => selectedEvents.has(e.id));

        setSelectedEvents(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (areAllCurrentlyFilteredSelected) {
                filteredIds.forEach(id => newSelected.delete(id));
            } else {
                filteredIds.forEach(id => newSelected.add(id));
            }
            return newSelected;
        });
    };

    const handleSuggestCorrection = async (event: ValidatedEvent, field: keyof Omit<EventObject, 'id'>) => {
        setCorrectingField({ eventId: event.id, field });
        try {
            const suggestion = await suggestCorrection(event, field);
            if (suggestion) {
                handleFieldChange(event.id, field, suggestion);
            }
        } catch (error) {
            console.error('Errore nel recuperare il suggerimento dall\'IA:', error);
        } finally {
            setCorrectingField(null);
        }
    };

    const handleSort = (key: keyof Omit<EventObject, 'id'>) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            const someFilteredSelected = sortedAndFilteredEvents.length > 0 && sortedAndFilteredEvents.some(e => selectedEvents.has(e.id));
            const allFilteredSelected = sortedAndFilteredEvents.length > 0 && sortedAndFilteredEvents.every(e => selectedEvents.has(e.id));
            selectAllCheckboxRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
        }
    }, [selectedEvents, sortedAndFilteredEvents]);


    if (events.length === 0) {
        return (
            <div className="text-center py-10 bg-card rounded-lg border border-border">
                <p className="text-muted-foreground">Nessun evento è stato estratto dal file.</p>
                <p className="text-sm text-muted-foreground mt-2">Controlla il contenuto del file o prova un file diverso.</p>
            </div>
        );
    }
    
    const areAllFilteredSelected = sortedAndFilteredEvents.length > 0 && sortedAndFilteredEvents.every(e => selectedEvents.has(e.id));
    
    return (
        <>
             <FilterPanel 
                filters={filters} 
                onFilterChange={(field, value) => setFilters(prev => ({...prev, [field]: value}))} 
            />
            {selectedEvents.size > 0 && (
                <BulkActions
                    selectedIds={selectedEvents}
                    setEvents={setEvents}
                    onClearSelection={() => setSelectedEvents(new Set())}
                />
            )}
            <div className="flex justify-end items-center mb-2 mt-4">
                <button
                    onClick={handleAddRow}
                    className="flex items-center space-x-2 text-sm bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-2 px-3 rounded-md transition-colors"
                >
                    <CalendarPlusIcon className="h-4 w-4" />
                    <span>Aggiungi Evento</span>
                </button>
            </div>
            <div className="overflow-x-auto bg-card/50 rounded-lg border border-border">
                <table className="w-full min-w-[1200px] text-sm text-left text-foreground">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary">
                        <tr>
                            <th scope="col" className="px-4 py-3">
                                <input
                                    ref={selectAllCheckboxRef}
                                    type="checkbox"
                                    className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring focus:outline-none"
                                    onChange={handleSelectAll}
                                    checked={areAllFilteredSelected}
                                    aria-label="Seleziona tutti gli eventi visibili"
                                />
                            </th>
                            {tableHeaders.map(header => (
                                <th key={header.key} scope="col" className="px-4 py-3 whitespace-nowrap cursor-pointer group hover:bg-accent transition-colors" onClick={() => handleSort(header.key)}>
                                    <div className="flex items-center space-x-1">
                                        <span>{header.label}</span>
                                        {sortConfig.key === header.key ? (
                                            sortConfig.direction === 'ascending' ? 
                                                <ChevronUpIcon className="h-4 w-4" /> : 
                                                <ChevronDownIcon className="h-4 w-4" />
                                        ) : (
                                            <ChevronsUpDownIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="px-4 py-3 text-center">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAndFilteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={tableHeaders.length + 2} className="text-center py-10 text-muted-foreground">
                                    Nessun evento corrisponde ai criteri di ricerca.
                                </td>
                            </tr>
                        ) : (
                            sortedAndFilteredEvents.map((event) => {
                                const isSelected = selectedEvents.has(event.id);
                                const rowIsInvalid = !event.isValid;
                                return (
                                    <tr key={event.id} className={`border-b border-border transition-colors ${rowIsInvalid ? 'bg-destructive/10' : ''} ${isSelected ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-accent/50'}`}>
                                        <td className="px-4 py-2 align-middle">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-primary bg-secondary border-border rounded focus:ring-ring focus:outline-none"
                                                onChange={() => handleSelect(event.id)}
                                                checked={isSelected}
                                                aria-label={`Seleziona l'evento ${event.subject}`}
                                            />
                                        </td>
                                        {tableHeaders.map(({ key, label }) => {
                                            const error = event.errors[key as keyof ValidationErrors];
                                            const isInvalid = !!error;
                                            const isCorrecting = correctingField?.eventId === event.id && correctingField?.field === key;
                                            return (
                                                <td key={key} className="px-2 py-2 align-top">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={event[key] || ''}
                                                            onChange={(e) => handleFieldChange(event.id, key, e.target.value)}
                                                            className={`bg-input border text-foreground text-sm rounded-md block w-full p-2.5 transition-colors duration-200
                                                                ${isInvalid 
                                                                    ? 'border-destructive/50 focus:ring-destructive focus:border-destructive pr-8' 
                                                                    : 'border-border focus:ring-ring focus:border-primary'}`
                                                            }
                                                            aria-label={label}
                                                            title={error}
                                                        />
                                                        {isInvalid && (
                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                                                <button
                                                                    onClick={() => handleSuggestCorrection(event, key)}
                                                                    disabled={isCorrecting}
                                                                    className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50 disabled:cursor-wait"
                                                                    title="Suggerisci correzione (IA)"
                                                                >
                                                                    {isCorrecting ? (
                                                                        <Loader className="h-4 w-4" />
                                                                    ) : (
                                                                        <SparklesIcon className="h-4 w-4" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isInvalid && <p className="text-destructive text-xs mt-1 px-1">{error}</p>}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-2 text-center align-middle">
                                            <button onClick={() => handleDeleteRow(event.id)} title="Elimina riga" className="p-2 text-muted-foreground hover:text-destructive hover:bg-accent rounded-full transition-colors">
                                                <Trash2Icon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};