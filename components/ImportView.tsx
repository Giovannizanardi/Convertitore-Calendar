import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileUpload } from './FileUpload';
import { Loader } from './Loader';
import { extractEvents, ApiEventObject } from '../services/geminiService';
import { EventPreviewTable } from './EventPreviewTable';
import { validateEvents } from '../lib/validation';
import type { ValidatedEvent, EventObject } from '../lib/types';
import { GoogleCalendarImporter } from './GoogleCalendarImporter';
import { toDDMMYYYY } from '../lib/dateUtils';
import { ArrowLeftIcon, RefreshCwIcon, GoogleIcon } from './Icons';

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
        if (!data) throw new Error("Failed to read file data.");
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("No sheets found in the Excel file.");
        const worksheet = workbook.Sheets[sheetName];
        resolve(XLSX.utils.sheet_to_csv(worksheet));
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
      setLoadingMessage(loadingMessages[0]);
      intervalId = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isLoading]);

  const handleFilesChange = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
     if (selectedFiles.length > 0) {
      setInputMethod('file');
      setPastedText('');
    }
  }, []);
  
  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    if(text.trim()) {
        setInputMethod('text');
        setFiles([]);
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
                    processedInput = await parseExcelToCsv(file);
                } else {
                    processedInput = file;
                }
                return extractEvents(processedInput);
            }));
            extractedEvents = results.flat();
        } else {
            if (!pastedText.trim()) {
                setError('Incolla prima il testo.');
                setIsLoading(false);
                return;
            }
            extractedEvents = await extractEvents(pastedText);
        }
      
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
      setError('');
    } catch (err: any) {
        if (err.message === 'API_KEY_MISSING') {
            setError("Chiave API mancante. Clicca su 'Seleziona Chiave API' nella schermata principale.");
            setIsLoading(false);
            return;
        }

        const isOverloadError = err.message?.includes('sovraccarico');
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 7000;

        if (isOverloadError && retryAttempt < MAX_RETRIES) {
            const nextAttempt = retryAttempt + 1;
            setError(`Servizio sovraccarico. Riprovo... (${nextAttempt}/${MAX_RETRIES})`);
            setTimeout(() => handleProcess(nextAttempt), RETRY_DELAY);
        } else {
            setError(err.message || "Errore durante l'elaborazione.");
            setIsLoading(false);
        }
    }
  };

  const handleProceedToImport = () => {
     if (selectedEvents.size > 0 && selectedEvents.size < events.length) {
        setEvents(prev => prev.filter(e => selectedEvents.has(e.id)));
    }
    setStep('result');
  };

  const handleReset = (fullReset = true) => {
    if (fullReset) { setFiles([]); setPastedText(''); setInputMethod('file'); }
    setError(''); setIsLoading(false); setStep('upload'); setEvents([]); setSelectedEvents(new Set());
  };
  
  const handleResetAndGoToDashboard = () => { handleReset(true); setPage('dashboard'); };
  const handleBackToPreview = () => setStep('preview');

  const hasInvalidEvents = useMemo(() => {
    if (selectedEvents.size === 0) return events.some(e => !e.isValid);
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
       return (
         <div className="mt-6 bg-destructive/10 border border-destructive/30 text-destructive-foreground px-4 py-3 rounded-xl text-center animate-fade-in">
            <p className="font-bold">Attenzione</p>
            <p className="text-sm">{error}</p>
            <div className="mt-4 flex justify-center space-x-3">
              <button onClick={() => handleProcess()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors flex items-center space-x-2">
                  <RefreshCwIcon className="h-4 w-4" /> <span>Riprova</span>
              </button>
              <button onClick={() => handleResetAndGoToDashboard()} className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-2 px-6 rounded-full transition-colors">
                  Dashboard
              </button>
            </div>
         </div>
       );
    }

    switch (step) {
      case 'upload':
        const canProcess = (inputMethod === 'file' && files.length > 0) || (inputMethod === 'text' && pastedText.trim());
        const tabBaseClasses = "px-4 py-2 font-semibold transition-colors duration-200 focus:outline-none rounded-t-xl";
        const activeTabClasses = "bg-secondary text-secondary-foreground border-b-2 border-primary";
        const inactiveTabClasses = "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50";

        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-4">1. Fornisci i dati dei tuoi eventi</h2>
            <div className="border-b border-border mb-6">
                <div className="flex -mb-px space-x-2">
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
                    rows={8}
                    placeholder="Incolla qui i dati o uno screenshot..."
                    className="w-full bg-secondary/30 border-2 border-dashed border-border rounded-2xl p-6 text-foreground focus:border-primary focus:ring-primary transition-all disabled:opacity-50"
                />
              )}
            </div>
            <div className="mt-10 text-center">
                <div className="flex justify-center items-center space-x-4">
                     <button onClick={() => setPage('dashboard')} className="bg-secondary hover:bg-muted text-secondary-foreground font-bold py-3 px-8 rounded-full inline-flex items-center space-x-3 transition-all">
                       <ArrowLeftIcon className="h-5 w-5"/> <span>Indietro</span>
                    </button>
                    {canProcess && (
                        <button onClick={() => handleProcess()} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-10 rounded-full shadow-lg shadow-primary/20 transform hover:scale-105 transition-all">
                          Elabora Anteprima
                        </button>
                    )}
                </div>
            </div>
          </div>
        );
      case 'preview':
        return (
          <div className="animate-fade-in">
            <div className="text-center md:text-left mb-6">
                <h2 className="text-2xl font-bold text-foreground">2. Rivedi e Modifica gli Eventi Estratti</h2>
                <p className="text-muted-foreground mt-1">Correggi eventuali errori e seleziona gli eventi da importare.</p>
            </div>
            <EventPreviewTable events={events} setEvents={setEvents} selectedEvents={selectedEvents} setSelectedEvents={setSelectedEvents} />
            <div className="mt-8 text-center">
              <button onClick={handleProceedToImport} disabled={hasInvalidEvents} className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold py-4 px-12 rounded-full shadow-xl shadow-primary/20 transform hover:scale-105 transition-all">
                {proceedButtonText}
              </button>
            </div>
          </div>
        );
      case 'result':
        return (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">3. Salva i Tuoi Eventi</h2>
              <button onClick={handleBackToPreview} className="flex items-center space-x-2 text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted px-4 py-2 rounded-xl text-sm transition-all">
                  <ArrowLeftIcon className="h-4 w-4" /> <span>Torna alla modifica</span>
              </button>
            </div>
            <GoogleCalendarImporter events={events} onReset={handleResetAndGoToDashboard} />
          </div>
        );
      default: return null;
    }
};
