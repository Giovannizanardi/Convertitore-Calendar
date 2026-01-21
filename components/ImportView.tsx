import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileUpload } from './FileUpload';
import { Loader } from './Loader';
import { extractEvents, ApiEventObject } from '../services/geminiService';
import { EventPreviewTable } from './EventPreviewTable';
import { validateEvents } from '../lib/validation';
import type { ValidatedEvent, EventObject } from '../lib/types'; // Import EventObject
import { GoogleCalendarImporter } from './GoogleCalendarImporter';
import { toDDMMYYYY } from '../lib/dateUtils';
import { ArrowLeftIcon, RefreshCwIcon } from './Icons';

type AppStep = 'upload' | 'preview' | 'result';
type InputMethod = 'file' | 'text';

interface ImportViewProps {
    setPage: (page: 'dashboard' | 'import' | 'cleanup') => void;
}

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

const loadingMessages = [
  "Analisi del contenuto in corso...",
  "Identificazione degli eventi nei dati forniti...",
  "Estrazione di date, orari e luoghi...",
  "Strutturazione dei dati per l'anteprima...",
  "Quasi pronto, l'IA sta finalizzando l'elaborazione...",
];

export const ImportView: React.FC<ImportViewProps> = ({ setPage }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<AppStep>('upload');
  const [events, setEvents] = useState<ValidatedEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [pastedText, setPastedText] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>(loadingMessages[0]);

  useEffect(() => {
    let intervalId: number | undefined;

    if (isLoading) {
      let messageIndex = 0;
      setLoadingMessage(loadingMessages[0]); // Imposta il messaggio iniziale immediatamente
      intervalId = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 3000); // Cambia messaggio ogni 3 secondi
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoading]);

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


  const handleProcess = async (retryAttempt = 0) => {
    if (retryAttempt === 0) {
        setIsLoading(true);
        setError('');
        setEvents([]);
    }

    try {
        let extractedEvents: ApiEventObject[] = [];

        if (inputMethod === 'file') {
            if (files.length === 0) {
                setError('Seleziona prima uno o più file.');
                setIsLoading(false);
                return;
            }
            const results = await Promise.all(files.map(async (file) => {
                let processedInput: File | string;
                const fileExtension = file.name.split('.').pop()?.toLowerCase();
                if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    // Excel files are pre-processed to CSV string, then passed as 'string' input.
                    processedInput = await parseExcelToCsv(file);
                } else {
                    // Other files (images, PDFs, TXT, CSV) are passed directly as File objects.
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
      
      // FIX: Explicitly assign all properties to create a complete EventObject.
      const eventsWithId: EventObject[] = extractedEvents.map((event, index) => ({
         id: index,
         subject: event.subject,
         startDate: toDDMMYYYY(event.startDate),
         startTime: event.startTime,
         endDate: toDDMMYYYY(event.endDate),
         endTime: event.endTime,
         description: event.description,
         location: event.location,
      }));
      setEvents(validateEvents(eventsWithId));
      setSelectedEvents(new Set());
      setStep('preview');
      setIsLoading(false);
      setError(''); // Pulisce eventuali messaggi di riprova
    } catch (err: any) {
        const isOverloadError = err.message?.includes('sovraccarico o non disponibile');
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 7000;

        if (isOverloadError && retryAttempt < MAX_RETRIES) {
            const nextAttempt = retryAttempt + 1;
            setError(`Servizio sovraccarico. Riprovo tra ${RETRY_DELAY / 1000} secondi... (Tentativo ${nextAttempt} di ${MAX_RETRIES})`);
            setTimeout(() => handleProcess(nextAttempt), RETRY_DELAY);
        } else {
            console.error(err);
            setError(err.message || "Si è verificato un errore durante l'elaborazione. Il modello IA potrebbe non essere in grado di elaborare questo formato di file o il suo contenuto.");
            setStep('upload');
            setIsLoading(false);
        }
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
  
  const handleResetAndGoToDashboard = () => {
    handleReset(true);
    setPage('dashboard');
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

  const proceedButtonText = selectedEvents.size > 0 
    ? `Procedi con ${selectedEvents.size} Eventi Selezionati`
    : "Procedi con l'Importazione/Esportazione";

    if (isLoading) {
      return (
        <div className="mt-8 flex flex-col items-center justify-center space-y-4">
          <Loader />
          <p key={error || loadingMessage} className="text-muted-foreground animate-fade-in text-center">{error || loadingMessage}</p>
        </div>
      );
    }
    
    if (error && !isLoading) {
       const isRetryable = error.includes('attualmente sovraccarico o non disponibile');
       return (
         <div className="mt-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground/80 px-4 py-3 rounded-lg text-center">
            <p><strong>Errore:</strong> {error}</p>
            {isRetryable && (
              <div className="mt-4">
                <button
                    onClick={() => handleProcess()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors flex items-center justify-center mx-auto space-x-2"
                >
                    <RefreshCwIcon className="h-4 w-4" />
                    <span>Riprova</span>
                </button>
              </div>
            )}
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
                    placeholder="Incolla qui i dati dei tuoi eventi in formato tabellare o incolla un'immagine (es. uno screenshot di un documento o una tabella). Per i documenti Word/PowerPoint, è consigliabile incollare il testo direttamente."
                    className="w-full bg-secondary/50 border-2 border-dashed border-border rounded-lg p-4 text-foreground focus:border-primary focus:ring-primary transition-colors duration-200 disabled:opacity-50"
                    aria-label="Pasted text input"
                />
              )}
            </div>
            
            <div className="mt-8 text-center">
                <div className="flex justify-center items-center space-x-4">
                     <button
                        onClick={() => setPage('dashboard')}
                        className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-3 px-6 rounded-full inline-flex items-center space-x-3 transition-all duration-300"
                    >
                       <ArrowLeftIcon className="h-5 w-5"/> <span>Indietro</span>
                    </button>
                    {canProcess && (
                        <button
                          onClick={() => handleProcess()}
                          disabled={isLoading}
                          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-8 rounded-full shadow-lg shadow-primary/20 transform hover:scale-105 transition-all duration-300 ease-in-out"
                        >
                          Elabora e Visualizza Anteprima Eventi
                        </button>
                    )}
                </div>
            </div>
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
            <GoogleCalendarImporter events={events} onReset={handleResetAndGoToDashboard} />
          </div>
        );
      default:
        return null;
    }
};