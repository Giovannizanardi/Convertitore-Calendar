import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { Loader } from './components/Loader';
import { extractEvents, ApiEventObject } from './services/geminiService';
import { EventPreviewTable } from './components/EventPreviewTable';
import { validateEvents } from './lib/validation';
import type { ValidatedEvent } from './lib/types';
import { GoogleCalendarImporter } from './components/GoogleCalendarImporter';
import { toDDMMYYYY } from './lib/dateUtils';
import { ArrowLeftIcon } from './components/Icons';

type AppStep = 'upload' | 'preview' | 'result';
type InputMethod = 'file' | 'text';

async function parseExcelToCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          throw new Error("Failed to read file data.");
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error("No sheets found in the Excel file.");
        }
        const worksheet = workbook.Sheets[sheetName];
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        resolve(csvString);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<AppStep>('upload');
  const [events, setEvents] = useState<ValidatedEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [pastedText, setPastedText] = useState<string>('');
  const [description, setDescription] = useState<string>('Caricamento...');
  const [appName, setAppName] = useState<string>('');

  useEffect(() => {
    fetch('./metadata.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setDescription(data.description || '');
        setAppName(data.name || '');
      })
      .catch(err => {
        console.error("Impossibile caricare i metadati dell'app:", err);
        setDescription("Un'applicazione intelligente per estrarre eventi da file e importarli in Google Calendar.");
        setAppName("ForMa - Convertitore di Eventi per Google Calendar");
      });
  }, []);

  const handleFilesChange = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
     if (selectedFiles.length > 0) {
      setInputMethod('file');
      setPastedText(''); // Clear text if files are selected
    }
  }, []);
  
  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    if(text.trim()) {
        setInputMethod('text');
        setFiles([]); // Clear files if text is pasted
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                event.preventDefault();
                const imageFile = new File([blob], `pasted-image-${Date.now()}.${blob.type.split('/')[1]}`, { type: blob.type });
                handleFilesChange([imageFile]);
                return;
            }
        }
    }
  };


  const handleProcess = async () => {
    setIsLoading(true);
    setError('');
    setEvents([]);

    try {
        let extractedEvents: ApiEventObject[] = [];

        if (inputMethod === 'file') {
            if (files.length === 0) {
                setError('Seleziona prima uno o più file.');
                setIsLoading(false);
                return;
            }
            // Process all files in parallel
            const results = await Promise.all(files.map(async (file) => {
                let processedInput: File | string;
                const fileExtension = file.name.split('.').pop()?.toLowerCase();
                if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    processedInput = await parseExcelToCsv(file);
                } else {
                    processedInput = file;
                }
                return extractEvents(processedInput);
            }));
            
            extractedEvents = results.flat();

        } else { // 'text' method
            if (!pastedText.trim()) {
                setError('Incolla prima il testo.');
                setIsLoading(false);
                return;
            }
            extractedEvents = await extractEvents(pastedText);
        }

      // Add a unique ID and convert date format for display
      const eventsWithId = extractedEvents.map((event, index) => ({
         ...event,
         id: index,
         startDate: toDDMMYYYY(event.startDate),
         endDate: toDDMMYYYY(event.endDate),
      }));
      setEvents(validateEvents(eventsWithId));
      setSelectedEvents(new Set());
      setStep('preview');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Si è verificato un errore durante l'elaborazione. Il modello IA potrebbe non essere in grado di elaborare questo formato di file o il suo contenuto.");
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToImport = () => {
    // Filter out unselected events before proceeding
     if (selectedEvents.size > 0 && selectedEvents.size < events.length) {
        setEvents(prev => prev.filter(e => selectedEvents.has(e.id)));
    }
    setStep('result');
  };

  const handleReset = (fullReset = true) => {
    if (fullReset) {
      setFiles([]);
      setPastedText('');
      setInputMethod('file');
    }
    setError('');
    setIsLoading(false);
    setStep('upload');
    setEvents([]);
    setSelectedEvents(new Set());
  };
  
  const handleBackToPreview = () => {
    setStep('preview');
  };

  const hasInvalidEvents = useMemo(() => {
    // If no events are selected, check all events for validity.
    if (selectedEvents.size === 0) {
        return events.some(e => !e.isValid);
    }
    // If some events are selected, only check those for validity.
    return events.some(e => selectedEvents.has(e.id) && !e.isValid);
}, [events, selectedEvents]);

  const hasContent = files.length > 0 || !!pastedText.trim() || isLoading || events.length > 0;
  const proceedButtonText = selectedEvents.size > 0 
    ? `Procedi con ${selectedEvents.size} Eventi Selezionati`
    : "Procedi con l'Importazione/Esportazione";

  const CurrentStepComponent = () => {
    if (isLoading) {
      return (
        <div className="mt-8 flex flex-col items-center justify-center space-y-4">
          <Loader />
          <p className="text-muted-foreground animate-pulse">L'IA sta elaborando i tuoi file... potrebbe volerci un momento.</p>
        </div>
      );
    }
    
    if (error && !isLoading) {
       return (
         <div className="mt-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground/80 px-4 py-3 rounded-lg text-center">
            <p><strong>Errore:</strong> {error}</p>
         </div>
       );
    }

    switch (step) {
      case 'upload':
        const canProcess = (inputMethod === 'file' && files.length > 0) || (inputMethod === 'text' && pastedText.trim());
        const tabBaseClasses = "px-4 py-2 font-semibold transition-colors duration-200 focus:outline-none rounded-t-md";
        const activeTabClasses = "bg-secondary text-secondary-foreground";
        const inactiveTabClasses = "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent";

        return (
          <>
            <h2 className="text-lg font-semibold text-foreground/90 mb-2">1. Fornisci i dati dei tuoi eventi</h2>
            
            <div className="border-b border-border mb-4">
                <div className="flex -mb-px">
                    <button onClick={() => setInputMethod('file')} className={`${tabBaseClasses} ${inputMethod === 'file' ? activeTabClasses : inactiveTabClasses}`}>
                        Carica File
                    </button>
                    <button onClick={() => setInputMethod('text')} className={`${tabBaseClasses} ${inputMethod === 'text' ? activeTabClasses : inactiveTabClasses}`}>
                        Incolla Testo o Immagine
                    </button>
                </div>
            </div>

            <div className="animate-fade-in">
              {inputMethod === 'file' ? (
                <FileUpload onFilesChange={handleFilesChange} files={files} disabled={isLoading} />
              ) : (
                <textarea
                    value={pastedText}
                    onChange={(e) => handlePastedTextChange(e.target.value)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    rows={10}
                    placeholder="Incolla qui i dati dei tuoi eventi in formato tabellare o incolla un'immagine..."
                    className="w-full bg-secondary/50 border-2 border-dashed border-border rounded-lg p-4 text-foreground focus:border-primary focus:ring-primary transition-colors duration-200 disabled:opacity-50"
                    aria-label="Pasted text input"
                />
              )}
            </div>
            
            {canProcess && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleProcess}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-8 rounded-full shadow-lg shadow-primary/20 transform hover:scale-105 transition-all duration-300 ease-in-out"
                >
                  Elabora e Visualizza Anteprima Eventi
                </button>
              </div>
            )}
          </>
        );
      case 'preview':
        return (
          <div className="animate-fade-in">
            <div className="text-center md:text-left mb-4">
                <h2 className="text-lg font-semibold text-foreground/90">2. Rivedi e Modifica gli Eventi Estratti</h2>
                <p className="text-sm text-muted-foreground mt-1">Gli eventi con dati mancanti o non validi sono evidenziati. Seleziona gli eventi con cui vuoi procedere.</p>
            </div>
            <EventPreviewTable 
              events={events} 
              setEvents={setEvents}
              selectedEvents={selectedEvents}
              setSelectedEvents={setSelectedEvents}
            />
            <div className="mt-6 text-center">
              <button
                onClick={handleProceedToImport}
                disabled={hasInvalidEvents}
                className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-8 rounded-full shadow-lg shadow-primary/20 transform hover:scale-105 transition-all duration-300 ease-in-out"
                title={hasInvalidEvents ? 'Per favore, correggi tutti gli errori negli eventi selezionati prima di procedere' : 'Procedi al passaggio finale'}
              >
                {proceedButtonText}
              </button>
            </div>
          </div>
        );
      case 'result':
        return (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground/90">3. Salva i Tuoi Eventi</h2>
              <button
                onClick={handleBackToPreview}
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200 bg-secondary hover:bg-muted px-3 py-2 rounded-md text-sm"
                title="Torna alla modifica"
              >
                  <ArrowLeftIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Torna alla modifica</span>
              </button>
            </div>
            <GoogleCalendarImporter events={events} onReset={() => handleReset(true)} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        <Header onReset={() => handleReset(true)} hasContent={hasContent} description={description} appName={appName} />
        <main className="mt-8">
          {CurrentStepComponent()}
        </main>
      </div>
    </div>
  );
}