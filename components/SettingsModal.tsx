
import React from 'react';
import { useSettings, availableModels, ModelId } from '../contexts/SettingsContext';
import { XIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { selectedModel, setSelectedModel } = useSettings();

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
        >
            <div
                className="bg-card text-card-foreground w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
                    <h2 id="settings-modal-title" className="text-xl font-bold">Impostazioni Modello IA</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted" aria-label="Chiudi impostazioni">
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                <main className="p-6 space-y-4">
                    <p className="text-muted-foreground text-sm">
                        Scegli il modello di intelligenza artificiale da utilizzare per le operazioni. Il modello "Flash" è più veloce e consigliato per la maggior parte degli usi.
                    </p>
                    <fieldset>
                        <legend className="sr-only">Modelli Gemini</legend>
                        <div className="space-y-3">
                            {availableModels.map(model => (
                                <label
                                    key={model.id}
                                    htmlFor={model.id}
                                    className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-all duration-200 ${selectedModel === model.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50'}`}
                                >
                                    <div className="flex items-center h-5">
                                        <input
                                            id={model.id}
                                            name="gemini-model"
                                            type="radio"
                                            checked={selectedModel === model.id}
                                            onChange={() => setSelectedModel(model.id as ModelId)}
                                            className="focus:ring-primary h-4 w-4 text-primary border-border bg-input"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <p className={`font-medium ${selectedModel === model.id ? 'text-primary' : 'text-foreground'}`}>
                                            {model.name}
                                        </p>
                                        <p className="text-muted-foreground">{model.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </main>

                <footer className="p-4 bg-secondary/50 border-t border-border text-right">
                     <button
                        onClick={onClose}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-md transition-colors"
                    >
                        Fatto
                    </button>
                </footer>
            </div>
        </div>
    );
};