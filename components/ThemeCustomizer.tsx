import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { XIcon, Trash2Icon, RefreshCwIcon, PlusIcon } from './Icons'; // Assuming PlusIcon exists
import type { ThemeDefinition } from '../lib/themes';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

const colorVariables: { key: keyof ThemeDefinition['colors']; label: string }[] = [
    { key: '--background', label: 'Sfondo' },
    { key: '--foreground', label: 'Testo' },
    { key: '--card', label: 'Card' },
    { key: '--primary', label: 'Primario' },
    { key: '--secondary', label: 'Secondario' },
    { key: '--accent', label: 'Accento' },
    { key: '--border', label: 'Bordo' },
    { key: '--input', label: 'Input' },
    { key: '--destructive', label: 'Distruttivo' },
];

function hslStringToColor(hsl: string): string {
    if (!hsl) return '#000000';
    const [h, s, l] = hsl.trim().split(' ').map(parseFloat);
    if (isNaN(h) || isNaN(s) || isNaN(l)) return '#000000';

    const sNorm = s / 100;
    const lNorm = l / 100;
    
    let c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = lNorm - c/2;
    let r = 0, g = 0, b = 0; 

    if (0 <= h && h < 60) { [r, g, b] = [c, x, 0]; }
    else if (60 <= h && h < 120) { [r, g, b] = [x, c, 0]; }
    else if (120 <= h && h < 180) { [r, g, b] = [0, c, x]; }
    else if (180 <= h && h < 240) { [r, g, b] = [0, x, c]; }
    else if (240 <= h && h < 300) { [r, g, b] = [x, 0, c]; }
    else if (300 <= h && h < 360) { [r, g, b] = [c, 0, x]; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}


export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ isOpen, onClose }) => {
    const { themes, activeTheme, updateTheme, addTheme, deleteTheme, resetTheme, setTheme } = useTheme();
    const [selectedTheme, setSelectedTheme] = useState<ThemeDefinition | null>(activeTheme || null);
    
    useEffect(() => {
        if(isOpen && activeTheme) {
            setSelectedTheme(activeTheme);
        }
    }, [isOpen, activeTheme]);
    
    const handleColorChange = (key: keyof ThemeDefinition['colors'], value: string) => {
        if (selectedTheme) {
            const newColors = { ...selectedTheme.colors, [key]: value };
            const newTheme = { ...selectedTheme, colors: newColors };
            setSelectedTheme(newTheme);
            updateTheme(selectedTheme.name, newColors);
        }
    };

    const handleCreateNewTheme = () => {
        const baseTheme = activeTheme || themes[0];
        let newName = "Tema Personalizzato";
        let counter = 1;
        while(themes.some(t => t.name === `${newName.toLowerCase().replace(/\s/g, '-')}-${counter}`)) {
            counter++;
        }
        
        const newTheme: ThemeDefinition = {
            name: `${newName.toLowerCase().replace(/\s/g, '-')}-${counter}`,
            label: `${newName} ${counter}`,
            colors: { ...baseTheme.colors },
            isCustom: true,
        };
        addTheme(newTheme);
        setSelectedTheme(newTheme);
        setTheme(newTheme.name);
    };

    const handleDelete = (themeName: string) => {
      if (window.confirm(`Sei sicuro di voler eliminare il tema "${selectedTheme?.label}"?`)) {
        deleteTheme(themeName);
        setSelectedTheme(activeTheme);
      }
    };
    
    if (!isOpen || !selectedTheme) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-card text-card-foreground w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Sidebar */}
                <aside className="w-1/3 bg-secondary/50 border-r border-border p-4 flex flex-col">
                    <h2 className="text-xl font-bold mb-4">Gestione Temi</h2>
                    <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                        {themes.map(theme => (
                            <button
                                key={theme.name}
                                onClick={() => setSelectedTheme(theme)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    selectedTheme.name === theme.name 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'hover:bg-accent'
                                }`}
                            >
                                {theme.label} {!theme.isCustom && <span className="text-xs opacity-70">(Predefinito)</span>}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleCreateNewTheme}
                        className="mt-4 w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        {/* FIX: Add the PlusIcon to the button as intended by the import. */}
                        <PlusIcon className="h-5 w-5" />
                        <span>Crea Nuovo Tema</span>
                    </button>
                </aside>

                {/* Main Content */}
                <main className="w-2/3 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                           <h3 className="text-2xl font-bold">{selectedTheme.label}</h3>
                           <p className="text-muted-foreground text-sm">
                                {selectedTheme.isCustom ? "Modifica i colori per il tuo tema personalizzato." : "Personalizza un tema predefinito. Le modifiche verranno salvate come personalizzazione."}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                            <XIcon className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {colorVariables.map(({ key, label }) => (
                                <div key={key}>
                                    <label htmlFor={key} className="block text-sm font-medium text-muted-foreground mb-1">
                                        {label}
                                    </label>
                                    <div className="flex items-center space-x-2 border border-input rounded-md p-1">
                                        <input
                                            type="color"
                                            id={key}
                                            value={hslStringToColor(selectedTheme.colors[key])}
                                            onChange={(e) => {
                                                const hex = e.target.value;
                                                let r = 0, g = 0, b = 0;
                                                r = parseInt(hex.substring(1, 3), 16);
                                                g = parseInt(hex.substring(3, 5), 16);
                                                b = parseInt(hex.substring(5, 7), 16);
                                                
                                                r /= 255; g /= 255; b /= 255;
                                                let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
                                                let h = 0, s = 0, l = 0;
                                                if (delta === 0) h = 0;
                                                else if (cmax === r) h = ((g - b) / delta) % 6;
                                                else if (cmax === g) h = (b - r) / delta + 2;
                                                else h = (r - g) / delta + 4;
                                                h = Math.round(h * 60);
                                                if (h < 0) h += 360;
                                                l = (cmax + cmin) / 2;
                                                s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
                                                s = +(s * 100).toFixed(1);
                                                l = +(l * 100).toFixed(1);
                                                
                                                handleColorChange(key, `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`);
                                            }}
                                            className="w-8 h-8 p-0 border-none cursor-pointer"
                                            aria-label={`Seleziona colore per ${label}`}
                                        />
                                        <input
                                            type="text"
                                            value={selectedTheme.colors[key]}
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="w-full bg-transparent text-sm focus:outline-none"
                                            aria-label={`Valore HSL per ${label}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border flex justify-end space-x-4">
                        {!selectedTheme.isCustom ? (
                             <button
                                onClick={() => resetTheme(selectedTheme.name)}
                                className="flex items-center space-x-2 bg-secondary hover:bg-muted text-secondary-foreground font-semibold py-2 px-4 rounded-md transition-colors"
                                title="Ripristina i colori predefiniti"
                            >
                                <RefreshCwIcon className="h-4 w-4" />
                                <span>Ripristina</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => handleDelete(selectedTheme.name)}
                                className="flex items-center space-x-2 bg-destructive/80 hover:bg-destructive text-destructive-foreground font-semibold py-2 px-4 rounded-md transition-colors"
                            >
                                <Trash2Icon className="h-4 w-4" />
                                <span>Elimina</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-md transition-colors"
                        >
                            Fatto
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};