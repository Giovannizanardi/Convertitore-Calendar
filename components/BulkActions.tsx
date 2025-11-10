import React, { useState } from 'react';
import type { ValidatedEvent, EventObject } from '../lib/types';
import { validateEvent } from '../lib/validation';
import { toYYYYMMDD } from '../lib/dateUtils';
import { SparklesIcon, XIcon, Trash2Icon, ClockIcon } from './Icons';

interface BulkActionsProps {
    selectedIds: Set<number>;
    setEvents: React.Dispatch<React.SetStateAction<ValidatedEvent[]>>;
    onClearSelection: () => void;
}

type UpdatableFields = Partial<Omit<EventObject, 'id' | 'subject'>>;

export const BulkActions: React.FC<BulkActionsProps> = ({ selectedIds, setEvents, onClearSelection }) => {
    const [updates, setUpdates] = useState<UpdatableFields>({});
    const [duration, setDuration] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setUpdates(prev => {
            const newUpdates = {...prev};
            if(value.trim() === '') {
                delete newUpdates[name as keyof UpdatableFields];
            } else {
                newUpdates[name as keyof UpdatableFields] = value;
            }
            return newUpdates;
        });
    };

    const handleApplyFieldChanges = () => {
        setEvents(prevEvents => {
            return prevEvents.map(event => {
                if (selectedIds.has(event.id)) {
                    // Create a new event object with the applied updates
                    const updatedRawEvent: EventObject = {
                        ...event,
                        ...updates,
                    };
                    // Re-validate the event after applying changes
                    return validateEvent(updatedRawEvent);
                }
                return event;
            });
        });
        // Reset form and clear selection after applying
        setUpdates({});
        onClearSelection();
    };
    
    const handleApplyDuration = () => {
        const durationMinutes = parseInt(duration, 10);
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            return;
        }

        setEvents(prevEvents => {
            return prevEvents.map(event => {
                if (selectedIds.has(event.id)) {
                    try {
                        const startDateTime = new Date(`${toYYYYMMDD(event.startDate)}T${event.startTime}`);
                        if (isNaN(startDateTime.getTime())) return event; // Skip if start date is invalid

                        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

                        const newEndDate = `${String(endDateTime.getDate()).padStart(2, '0')}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${endDateTime.getFullYear()}`;
                        const newEndTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
                        
                        const updatedRawEvent: EventObject = {
                            ...event,
                            endDate: newEndDate,
                            endTime: newEndTime,
                        };
                        return validateEvent(updatedRawEvent);
                    } catch(e) {
                        console.error("Errore durante l'applicazione della durata:", e);
                        return event;
                    }
                }
                return event;
            });
        });

        setDuration('');
        onClearSelection();
    };
    
    const canApplyFields = Object.keys(updates).length > 0;
    const canApplyDuration = parseInt(duration, 10) > 0;

    return (
        <div className="mb-4 p-4 bg-card border border-border rounded-lg animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-foreground">
                    Modifica Multipla ({selectedIds.size} selezionati)
                </h3>
                <button onClick={onClearSelection} title="Cancella selezione" className="p-1.5 rounded-full hover:bg-muted">
                    <XIcon className="h-5 w-5 text-muted-foreground" />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Location */}
                <div className="lg:col-span-1">
                    <label htmlFor="bulk-location" className="block mb-1 text-sm font-medium text-muted-foreground">Luogo</label>
                    <input
                        type="text"
                        id="bulk-location"
                        name="location"
                        value={updates.location || ''}
                        onChange={handleInputChange}
                        className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5"
                        placeholder="Imposta nuovo luogo"
                    />
                </div>
                {/* Description */}
                <div className="lg:col-span-1">
                    <label htmlFor="bulk-description" className="block mb-1 text-sm font-medium text-muted-foreground">Descrizione</label>
                    <input
                        type="text"
                        id="bulk-description"
                        name="description"
                        value={updates.description || ''}
                        onChange={handleInputChange}
                        className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5"
                        placeholder="Imposta nuova descrizione"
                    />
                </div>
                 {/* Start Date/Time */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor="bulk-startDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Inizio</label>
                        <input type="text" id="bulk-startDate" name="startDate" value={updates.startDate || ''} onChange={handleInputChange} placeholder="GG-MM-AAAA" className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5" />
                    </div>
                     <div>
                        <label htmlFor="bulk-startTime" className="block mb-1 text-sm font-medium text-muted-foreground">Ora Inizio</label>
                        <input type="text" id="bulk-startTime" name="startTime" value={updates.startTime || ''} onChange={handleInputChange} placeholder="HH:mm" className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5" />
                    </div>
                </div>
                {/* End Date/Time */}
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor="bulk-endDate" className="block mb-1 text-sm font-medium text-muted-foreground">Data Fine</label>
                        <input type="text" id="bulk-endDate" name="endDate" value={updates.endDate || ''} onChange={handleInputChange} placeholder="GG-MM-AAAA" className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5" />
                    </div>
                     <div>
                        <label htmlFor="bulk-endTime" className="block mb-1 text-sm font-medium text-muted-foreground">Ora Fine</label>
                        <input type="text" id="bulk-endTime" name="endTime" value={updates.endTime || ''} onChange={handleInputChange} placeholder="HH:mm" className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-full p-2.5" />
                    </div>
                </div>
            </div>

            <div className="mt-4 border-t border-border pt-4 flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-4">
                     <div className="flex items-end gap-2">
                        <div>
                            <label htmlFor="bulk-duration" className="block mb-1 text-sm font-medium text-muted-foreground">Imposta Durata</label>
                            <input
                                type="number"
                                id="bulk-duration"
                                name="duration"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="bg-input border border-border text-foreground text-sm rounded-md focus:ring-ring focus:border-primary block w-28 p-2.5"
                                placeholder="Minuti"
                                min="1"
                            />
                        </div>
                        <button
                            onClick={handleApplyDuration}
                            disabled={!canApplyDuration}
                            className="flex items-center space-x-2 bg-secondary hover:bg-muted disabled:bg-muted/50 disabled:text-muted-foreground disabled:cursor-not-allowed text-secondary-foreground font-semibold py-2.5 px-4 rounded-md transition-colors"
                        >
                            <ClockIcon className="h-5 w-5" />
                            <span>Applica</span>
                        </button>
                    </div>
                </div>
                
                <button
                    onClick={handleApplyFieldChanges}
                    disabled={!canApplyFields}
                    className="flex items-center space-x-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold py-2 px-4 rounded-md shadow-lg shadow-primary/10 transition-all duration-300"
                >
                    <SparklesIcon className="h-5 w-5" />
                    <span>Applica Modifiche Campi</span>
                </button>
            </div>
        </div>
    );
};