
import React, { useState, useEffect, useCallback } from 'react';
import { HomeIcon, PaletteIcon, QuestionMarkCircleIcon, CogIcon, GoogleIcon, LogOutIcon, UserIcon } from './Icons';
import { ThemeSwitcher } from './ThemeSwitcher';
import * as gcal from '../services/googleCalendarService';

interface HeaderProps {
    onGoHome: () => void;
    showHomeButton: boolean;
    description: string;
    appName: string;
    onCustomizeTheme: () => void;
    onOpenHelp: () => void;
    onOpenSettings: () => void;
}

const logoSvgUri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='48' viewBox='0 0 160 48'%3E%3Cstyle%3E.forma-text { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 36px; fill: %23EF4444; letter-spacing: -1px; } .m-highlight { fill: %23DC2626; }%3C/style%3E%3Ctext x='0' y='35' class='forma-text'%3EFor%3Ctspan class='m-highlight'%3EM%3C/tspan%3Ea%3C/text%3E%3C/svg%3E";

export const Header: React.FC<HeaderProps> = ({ onGoHome, showHomeButton, description, appName, onCustomizeTheme, onOpenHelp, onOpenSettings }) => {
    const subtitle = appName.replace(/ForMa\s*-\s*/i, '');
    const [userProfile, setUserProfile] = useState<gcal.UserProfile | null>(() => gcal.getStoredUserProfile());
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => gcal.hasValidSession());
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const updateSessionState = useCallback(() => {
        const loggedIn = gcal.hasValidSession();
        setIsLoggedIn(loggedIn);
        if (loggedIn) {
            const stored = gcal.getStoredUserProfile();
            setUserProfile(stored);
            if (!stored) {
                gcal.initGapiClient().then(() => {
                    gcal.getUserProfile().then(res => {
                        if (res?.result) setUserProfile(res.result);
                    }).catch(() => {});
                }).catch(() => {});
            }
        } else {
            setUserProfile(null);
        }
    }, []);

    useEffect(() => {
        updateSessionState();
        window.addEventListener('forma_gcal_session_change', updateSessionState);
        return () => window.removeEventListener('forma_gcal_session_change', updateSessionState);
    }, [updateSessionState]);

    const handleGoogleLogin = async () => {
        setIsAuthenticating(true);
        try {
            await gcal.handleAuthClick(async (tokenResponse) => {
                setIsAuthenticating(false);
                if (tokenResponse?.access_token) {
                    try {
                        const prof = await gcal.getUserProfile();
                        if (prof?.result) setUserProfile(prof.result);
                    } catch (e) {
                        console.warn("Impossibile caricare profilo utente:", e);
                    }
                }
            });
        } catch (error) {
            console.error("Login error:", error);
            setIsAuthenticating(false);
        }
    };

    const handleGoogleLogout = () => {
        gcal.logout();
    };

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
                <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Google Account Session Pill */}
                    {isLoggedIn ? (
                        <div className="flex items-center space-x-2 bg-secondary/80 border border-border px-2.5 py-1.5 rounded-full text-xs transition-all hover:bg-secondary">
                            {userProfile?.picture ? (
                                <img src={userProfile.picture} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                    {userProfile?.name ? userProfile.name[0].toUpperCase() : <UserIcon className="w-3 h-3" />}
                                </div>
                            )}
                            <span 
                                className="hidden lg:inline font-medium text-foreground max-w-[150px] truncate" 
                                title={userProfile?.email || userProfile?.name || 'Account Google Connesso'}
                            >
                                {userProfile?.email || userProfile?.name || 'Google Connesso'}
                            </span>
                            <button
                                onClick={handleGoogleLogout}
                                className="text-muted-foreground hover:text-destructive p-0.5 rounded-full transition-colors cursor-pointer"
                                title="Disconnetti account Google"
                            >
                                <LogOutIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isAuthenticating}
                            className="flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary px-3 py-1.5 rounded-full border border-border transition-colors cursor-pointer disabled:opacity-50"
                            title="Accedi con il tuo account Google"
                        >
                            <GoogleIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Accedi Google</span>
                        </button>
                    )}

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
                    <button
                        onClick={onOpenSettings}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 bg-card hover:bg-accent rounded-md border border-border"
                        title="Impostazioni Modello IA"
                    >
                        <CogIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={onOpenHelp}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 bg-card hover:bg-accent rounded-md border border-border"
                        title="Apri Guida Utente"
                    >
                        <QuestionMarkCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-4xl">{description}</p>
        </header>
    );
};