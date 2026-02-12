
import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { Dashboard } from './components/Dashboard';
import { ImportView } from './components/ImportView';
import { CleanupView } from './components/CleanupView';
import { MassiveEditView } from './components/MassiveEditView';
import { HelpModal } from './components/HelpModal';
import { SparklesIcon, GoogleIcon } from './components/Icons';
import readmeContent from './README.md?raw';

declare global {
  // Fix: Defined AIStudio interface and made window.aistudio optional to match
  // environmental declarations and avoid "identical modifiers" error.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export default function App() {
  const [page, setPage] = useState<'dashboard' | 'import' | 'cleanup' | 'massive-edit'>('dashboard');
  const [isThemeCustomizerOpen, setThemeCustomizerOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [appName, setAppName] = useState<string>('ForMa - Calendar Suite');
  const [appDescription, setAppDescription] = useState<string>('Una suite intelligente basata su IA per popolare e pulire i tuoi calendari.');
  const [hasAiKey, setHasAiKey] = useState<boolean>(true); // Assumiamo true inizialmente

  useEffect(() => {
    const checkApiKey = async () => {
      // Verifica se la chiave è già presente nell'ambiente
      if (process.env.API_KEY) {
        setHasAiKey(true);
        return;
      }

      // Se non c'è, controlla tramite window.aistudio se è disponibile
      try {
        if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasAiKey(selected);
        } else {
          // In ambienti dove window.aistudio non c'è, ci fidiamo di process.env
          setHasAiKey(!!process.env.API_KEY);
        }
      } catch (e) {
        setHasAiKey(false);
      }
    };
    
    checkApiKey();
    const interval = setInterval(checkApiKey, 2000); // Poll periodico per rilevare l'iniezione della chiave
    return () => clearInterval(interval);
  }, []);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Dopo l'apertura del dialog, assumiamo che l'utente proceda
        setHasAiKey(true);
      }
    } catch (e) {
      console.error("Errore nell'apertura del selettore chiave:", e);
    }
  };

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const response = await fetch('./metadata.json');
        if (!response.ok) throw new Error('Impossibile caricare metadata.json');
        const metadata = await response.json();
        setAppName(metadata.name || 'ForMa Calendar Suite');
        setAppDescription(metadata.description || 'Una suite intelligente per importare e pulire i tuoi calendari.');
      } catch (e) {
        console.error("Errore nel caricamento di metadata.json", e);
      }
    };
    loadMetadata();
  }, []);

  const renderPage = () => {
    if (!hasAiKey) {
      return (
        <div className="max-w-2xl mx-auto mt-12 text-center p-8 bg-card rounded-2xl border border-border shadow-xl animate-fade-in">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <SparklesIcon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Configurazione IA Necessaria</h2>
          <p className="text-muted-foreground mb-6">
            Per utilizzare le funzionalità di intelligenza artificiale (estrazione eventi, suggerimenti, filtri intelligenti), è necessario configurare una chiave API valida da un progetto Google Cloud a pagamento.
          </p>
          <div className="bg-secondary/50 p-4 rounded-xl mb-8 text-sm text-left border border-border">
            <p className="mb-2"><strong>Nota:</strong> Seleziona una chiave API associata a un account con fatturazione attiva.</p>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium inline-flex items-center"
            >
              Documentazione Fatturazione Google Gemini ↗
            </a>
          </div>
          <button 
            onClick={handleSelectKey}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 px-10 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center space-x-3 transition-all transform hover:scale-105"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>Seleziona Chiave API</span>
          </button>
        </div>
      );
    }

    switch (page) {
      case 'import':
        return <ImportView setPage={setPage} />;
      case 'cleanup':
        return <CleanupView setPage={setPage} />;
      case 'massive-edit':
        return <MassiveEditView setPage={setPage} />;
      case 'dashboard':
      default:
        return <Dashboard setPage={setPage} />;
    }
  };

  return (
    <div className="min-h-screen text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        <Header 
          appName={appName}
          description={appDescription}
          onGoHome={() => setPage('dashboard')} 
          showHomeButton={page !== 'dashboard'}
          onCustomizeTheme={() => setThemeCustomizerOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <main className="mt-8">
          {renderPage()}
        </main>
      </div>
      <ThemeCustomizer 
        isOpen={isThemeCustomizerOpen} 
        onClose={() => setThemeCustomizerOpen(false)} 
      />
       <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setHelpOpen(false)}
        content={readmeContent}
      />
    </div>
  );
}
