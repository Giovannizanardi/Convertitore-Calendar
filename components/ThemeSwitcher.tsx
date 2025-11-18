import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronsUpDownIcon } from './Icons';

export const ThemeSwitcher: React.FC = () => {
  const { themes, activeTheme, setTheme } = useTheme();

  if (!activeTheme) {
    return null; // or a loading state
  }

  return (
    <div className="relative">
      <label htmlFor="theme-switcher" className="sr-only">Cambia Tema</label>
      <select
        id="theme-switcher"
        value={activeTheme.name}
        onChange={(e) => setTheme(e.target.value)}
        className="appearance-none bg-card border border-border rounded-md py-2 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        aria-label="Seleziona tema"
      >
        {themes.map((t) => (
          <option key={t.name} value={t.name}>
            {t.label}
          </option>
        ))}
      </select>
       <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
        <ChevronsUpDownIcon className="h-4 w-4" />
      </div>
    </div>
  );
};