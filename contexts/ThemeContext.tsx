import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { defaultThemes, type ThemeDefinition } from '../lib/themes';

type ThemeProviderProps = {
  children?: React.ReactNode;
  defaultThemeName?: string;
  activeThemeStorageKey?: string;
  themesStorageKey?: string;
};

type ThemeProviderState = {
  themes: ThemeDefinition[];
  activeTheme: ThemeDefinition | undefined;
  setTheme: (themeName: string) => void;
  updateTheme: (themeName: string, colors: Record<string, string>) => void;
  addTheme: (newTheme: ThemeDefinition) => void;
  deleteTheme: (themeName: string) => void;
  resetTheme: (themeName: string) => void;
};

const initialState: ThemeProviderState = {
  themes: defaultThemes,
  activeTheme: defaultThemes[0],
  setTheme: () => null,
  updateTheme: () => null,
  addTheme: () => null,
  deleteTheme: () => null,
  resetTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultThemeName = 'dark',
  activeThemeStorageKey = 'forma-theme-active',
  themesStorageKey = 'forma-themes',
}: ThemeProviderProps) {
  
  const [themes, setThemes] = useState<ThemeDefinition[]>(() => {
    try {
      const storedThemes = localStorage.getItem(themesStorageKey);
      // FIX: Cast the result of JSON.parse to handle stricter TypeScript configurations where it returns 'unknown'.
      return storedThemes ? (JSON.parse(storedThemes) as ThemeDefinition[]) : defaultThemes;
    } catch (e) {
      console.error("Failed to parse themes from localStorage", e);
      return defaultThemes;
    }
  });

  const [activeThemeName, setActiveThemeName] = useState<string>(
    () => localStorage.getItem(activeThemeStorageKey) || defaultThemeName
  );
  
  const activeTheme = themes.find(t => t.name === activeThemeName);

  useEffect(() => {
    localStorage.setItem(themesStorageKey, JSON.stringify(themes));
  }, [themes, themesStorageKey]);


  useEffect(() => {
    if (!activeTheme) return;
    const root = window.document.documentElement;
    
    // Rimuove stili precedenti per evitare conflitti
    Object.keys(defaultThemes[0].colors).forEach(key => {
        root.style.removeProperty(key);
    });

    Object.entries(activeTheme.colors).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
  }, [activeTheme]);

  const setTheme = useCallback((themeName: string) => {
    localStorage.setItem(activeThemeStorageKey, themeName);
    setActiveThemeName(themeName);
  }, [activeThemeStorageKey]);

  const updateTheme = useCallback((themeName: string, colors: Record<string, string>) => {
    setThemes(prevThemes => prevThemes.map(t => t.name === themeName ? { ...t, colors } : t));
  }, []);

  const addTheme = useCallback((newTheme: ThemeDefinition) => {
    setThemes(prev => [...prev, newTheme]);
  }, []);
  
  const deleteTheme = useCallback((themeName: string) => {
    setThemes(prev => prev.filter(t => t.name !== themeName));
    // Se il tema attivo viene eliminato, torna al tema predefinito
    if (activeThemeName === themeName) {
        setTheme(defaultThemeName);
    }
  }, [activeThemeName, defaultThemeName, setTheme]);

  const resetTheme = useCallback((themeName: string) => {
    const originalTheme = defaultThemes.find(t => t.name === themeName);
    if (originalTheme) {
        setThemes(prev => prev.map(t => t.name === themeName ? originalTheme : t));
    }
  }, []);


  const value = {
    themes,
    activeTheme,
    setTheme,
    updateTheme,
    addTheme,
    deleteTheme,
    resetTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};