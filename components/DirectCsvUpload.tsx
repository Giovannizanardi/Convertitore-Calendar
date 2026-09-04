import React, { useState, useRef } from 'react';
import { FileSpreadsheetIcon, UploadCloudIcon, DownloadIcon, XIcon } from './Icons';
import { parseDirectCsv, parseDirectCsvFile, generateExampleCsvTemplate } from '../lib/directCsvParser';
import { validateEvents } from '../lib/validation';
import type { ValidatedEvent } from '../lib/types';
import { Loader } from './Loader';

interface DirectCsvUploadProps {
  onEventsParsed: (events: ValidatedEvent[]) => void;
  disabled?: boolean;
}

export const DirectCsvUpload: React.FC<DirectCsvUploadProps> = ({ onEventsParsed, disabled = false }) => {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedCsv, setPastedCsv] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const templateContent = generateExampleCsvTemplate();
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modello_eventi_docenti.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setParseError('');
    try {
      const result = await parseDirectCsvFile(file);
      if (result.events.length === 0) {
        setParseError(result.warnings.join(' ') || 'Nessun evento valido trovato nel file CSV.');
        setIsProcessing(false);
        return;
      }
      const validated = validateEvents(result.events);
      onEventsParsed(validated);
    } catch (err: any) {
      setParseError(err.message || 'Errore durante la lettura del file CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processPastedText = () => {
    if (!pastedCsv.trim()) {
      setParseError('Incolla prima il testo del file CSV.');
      return;
    }
    setIsProcessing(true);
    setParseError('');
    try {
      const result = parseDirectCsv(pastedCsv);
      if (result.events.length === 0) {
        setParseError(result.warnings.join(' ') || 'Nessun evento valido trovato nel testo CSV.');
        setIsProcessing(false);
        return;
      }
      const validated = validateEvents(result.events);
      onEventsParsed(validated);
    } catch (err: any) {
      setParseError(err.message || 'Errore durante l\'elaborazione del testo CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Format Specification Banner */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-primary font-semibold mb-1">
              <FileSpreadsheetIcon className="h-5 w-5" />
              <span>Formato CSV Diretto (Senza IA)</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Importazione istantanea senza consumo di token o elaborazione IA. Le colonne richieste sono:
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center space-x-2 bg-secondary hover:bg-muted text-secondary-foreground font-medium text-xs sm:text-sm py-2 px-4 rounded-xl border border-border transition-colors flex-shrink-0"
            title="Scarica un file CSV di esempio già compilato"
          >
            <DownloadIcon className="h-4 w-4 text-primary" />
            <span>Scarica Modello CSV</span>
          </button>
        </div>

        {/* Visual Format Columns pill list */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Colonne:</span>
          {[
            'Oggetto',
            'Data Inizio',
            'Ora Inizio',
            'Data Fine',
            'Ora Fine',
            'Luogo',
            'Docente'
          ].map((colName, idx) => (
            <span
              key={colName}
              className="inline-flex items-center text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-secondary text-foreground border border-border"
            >
              <span className="text-primary font-bold mr-1.5">{idx + 1}.</span>
              {colName}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          * Supporta separatore virgola (<code>,</code>) o punto e virgola (<code>;</code>), date in formato <code>GG-MM-AAAA</code> o <code>GG/MM/AAAA</code>, e orari <code>HH:mm</code>. Se la data di fine è vuota, viene impostata uguale alla data di inizio.
        </p>
      </div>

      {/* Mode Switcher: Upload File vs Paste Text */}
      <div className="flex space-x-2 border-b border-border">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
            mode === 'file'
              ? 'bg-secondary text-secondary-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Carica File CSV / Excel
        </button>
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
            mode === 'paste'
              ? 'bg-secondary text-secondary-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Incolla Righe CSV
        </button>
      </div>

      {parseError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive-foreground p-4 rounded-xl text-sm animate-fade-in flex items-start space-x-3">
          <div className="flex-1">
            <p className="font-semibold mb-1">Attenzione nel file CSV</p>
            <p className="text-xs">{parseError}</p>
          </div>
          <button onClick={() => setParseError('')} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center animate-fade-in">
          <Loader className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="font-semibold text-foreground">Elaborazione del file CSV in corso...</p>
        </div>
      )}

      {!isProcessing && mode === 'file' && (
        <div>
          {selectedFile ? (
            <div className="bg-card border-2 border-border rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4 overflow-hidden">
                <FileSpreadsheetIcon className="h-10 w-10 text-primary flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-semibold text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => processFile(selectedFile)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-2 px-5 rounded-full transition-colors"
                >
                  Elabora File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setParseError('');
                  }}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Rimuovi file"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`bg-secondary/40 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
                disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary hover:bg-accent/40'
              } ${isDragging ? 'border-primary bg-accent/60 scale-[1.01]' : 'border-border'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv, .txt, .xlsx, .xls"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
                disabled={disabled}
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <UploadCloudIcon className="h-12 w-12 text-primary" />
                <p className="font-semibold text-foreground">
                  <span className="text-primary underline">Seleziona il file CSV</span> o trascinalo qui
                </p>
                <p className="text-xs text-muted-foreground">
                  Formati supportati: .CSV, .TXT (valori separati da virgola o punto e virgola), .XLSX, .XLS
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!isProcessing && mode === 'paste' && (
        <div className="space-y-4">
          <textarea
            value={pastedCsv}
            onChange={(e) => setPastedCsv(e.target.value)}
            disabled={disabled}
            rows={8}
            placeholder={`Oggetto, Data Inizio, Ora Inizio, Data Fine, Ora Fine, Luogo, Docente\nMatematica Applicata, 15-09-2026, 09:00, 15-09-2026, 11:00, Aula 3, Prof. Rossi\nLaboratorio Elettrico, 16-09-2026, 14:00, 16-09-2026, 17:00, Laboratorio 1, Prof. Bianchi`}
            className="w-full font-mono text-sm bg-secondary/30 border-2 border-dashed border-border rounded-2xl p-5 text-foreground focus:border-primary focus:ring-primary transition-all disabled:opacity-50"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={processPastedText}
              disabled={disabled || !pastedCsv.trim()}
              className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold py-2.5 px-6 rounded-full shadow-md transition-all"
            >
              Elabora CSV Incollato
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
