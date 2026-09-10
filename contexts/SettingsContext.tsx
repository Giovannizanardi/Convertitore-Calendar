
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const availableModels = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Consigliato - Più Stabile)', description: 'Massima affidabilità e velocità, ideale per evitare picchi di sovraccarico durante l\'estrazione.' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3 Flash', description: 'Modello di ultima generazione con ottime capacità di estrazione.' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Modello ad alta capacità di ragionamento per documenti e tabelle molto complessi.' },
] as const;

export type ModelId = typeof availableModels[number]['id'];

interface SettingsContextType {
    selectedModel: ModelId;
    setSelectedModel: (modelId: ModelId) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'forma-settings';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
        try {
            const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (storedSettings) {
                const settings = JSON.parse(storedSettings);
                if (availableModels.some(m => m.id === settings.model)) {
                    return settings.model as ModelId;
                }
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage", error);
        }
        return 'gemini-2.5-flash';
    });

    useEffect(() => {
        try {
            const settings = { model: selectedModel };
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }, [selectedModel]);
    
    const value = { selectedModel, setSelectedModel };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};