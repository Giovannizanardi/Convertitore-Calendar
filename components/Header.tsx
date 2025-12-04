import React from 'react';
import { HomeIcon, PaletteIcon } from './Icons';
import { ThemeSwitcher } from './ThemeSwitcher';

interface HeaderProps {
    onGoHome: () => void;
    showHomeButton: boolean;
    description: string;
    appName: string;
    onCustomizeTheme: () => void;
}

const logoSvgUri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='48' viewBox='0 0 160 48'%3E%3Cstyle%3E.forma-text { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 36px; fill: %23EF4444; letter-spacing: -1px; } .m-highlight { fill: %23DC2626; }%3C/style%3E%3Ctext x='0' y='35' class='forma-text'%3EFor%3Ctspan class='m-highlight'%3EM%3C/tspan%3Ea%3C/text%3E%3C/svg%3E";


export const Header: React.FC<HeaderProps> = ({ onGoHome, showHomeButton, description, appName, onCustomizeTheme }) => {
    const subtitle = appName.replace(/ForMa\s*-\s*/i, '');
    
    return (
        <header className="pb-4 border-b border-border">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-4">
                     <img src={logoSvgUri} alt="Logo ForMa" className="h-10 sm:h-12 flex-shrink-0" />
                     {appName && (
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground/80 tracking-tight hidden md:block">
                            {subtitle}
                        </h1>
                     )}
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                    {showHomeButton && (
                        <button
                            onClick={onGoHome}
                            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200 bg-secondary hover:bg-accent px-3 py-2 rounded-md"
                            title="Torna alla Dashboard"
                        >
                            <HomeIcon className="h-4 w-4" />
                            <span className="hidden sm:inline text-sm">Dashboard</span>
                        </button>
                    )}
                    <ThemeSwitcher />
                    <button
                        onClick={onCustomizeTheme}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 bg-card hover:bg-accent rounded-md border border-border"
                        title="Personalizza Tema"
                    >
                        <PaletteIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-4xl">{description}</p>
        </header>
    );
};