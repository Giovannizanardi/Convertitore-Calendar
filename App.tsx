import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import rawMetadata from './metadata.json?raw'; 
import { Dashboard } from './components/Dashboard';
import { ImportView } from './components/ImportView';
import { CleanupView } from './components/CleanupView';
import { MassiveEditView } from './components/MassiveEditView';
import { HelpModal } from './components/HelpModal';
import readmeContent from './README.md?raw';

export default function App() {
  const [page, setPage] = useState<'dashboard' | 'import' | 'cleanup' | 'massive-edit'>('dashboard');
  const [isThemeCustomizerOpen, setThemeCustomizerOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [appName, setAppName] = useState<string>('');
  const [appDescription, setAppDescription] = useState<string>('');

  useEffect(() => {
    try {
      const metadata = JSON.parse(rawMetadata);
      setAppName(metadata.name || 'ForMa Calendar Suite');
      setAppDescription(metadata.description || 'Una suite intelligente per importare e pulire i tuoi calendari.');
    } catch (e) {
      console.error("Failed to parse metadata.json, using default values.", e);
      setAppName('ForMa - Calendar Suite');
      setAppDescription('Una suite intelligente basata su IA per popolare e pulire i tuoi calendari. Importa eventi in blocco da file e testo, o trova e rimuovi rapidamente eventi superflui con il nostro assistente.');
    }
  }, []);

  const renderPage = () => {
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