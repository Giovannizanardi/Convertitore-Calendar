import React, { useState, useRef, useEffect } from 'react';
import { UploadCloudIcon, FileTextIcon, XIcon } from './Icons';

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  files: File[];
  disabled: boolean;
}

// Componente secondario per gestire le anteprime dei file
const FilePreview: React.FC<{ file: File }> = ({ file }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        // Controlla se il file è un'immagine
        if (file.type.startsWith('image/')) {
            objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else {
            // Reimposta l'anteprima se non è un'immagine
            setPreviewUrl(null);
        }

        // Funzione di pulizia per revocare l'URL dell'oggetto
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [file]); // Esegui nuovamente l'effetto se la prop del file cambia

    if (previewUrl) {
        return (
            <img 
                src={previewUrl} 
                alt={`Anteprima di ${file.name}`}
                className="h-10 w-10 object-cover rounded-md flex-shrink-0" 
            />
        );
    }
    // Icona predefinita per i file non di immagine
    return <FileTextIcon className="h-10 w-10 text-primary flex-shrink-0" />;
};


export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesChange(Array.from(e.target.files));
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesChange(Array.from(e.dataTransfer.files));
    }
  };
  
  const handleRemoveFile = (fileToRemove: File) => {
    onFilesChange(files.filter(f => f !== fileToRemove));
  }

  const acceptedFormats = ".txt, .csv, .doc, .docx, .xls, .xlsx, .pdf, .png, .jpg, .jpeg, .webp";

  if (files.length > 0 && !disabled) {
    return (
        <div className="bg-card border-2 border-dashed border-border rounded-lg p-4 transition-colors duration-300">
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {files.map((file, index) => (
                     <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-secondary/50 p-2 rounded-md animate-fade-in">
                        <div className="flex items-center space-x-3 overflow-hidden">
                           <FilePreview file={file} />
                            <div className="text-left overflow-hidden">
                                <p className="font-semibold text-foreground truncate">{file.name}</p>
                                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>
                        <button onClick={() => handleRemoveFile(file)} className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors">
                            <XIcon className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-4 text-center">
                 <button 
                    onClick={() => inputRef.current?.click()}
                    className="text-primary font-semibold hover:text-primary/90 transition-colors"
                >
                    Aggiungi o cambia file
                 </button>
            </div>
             <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept={acceptedFormats}
                disabled={disabled}
                multiple
            />
        </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative bg-secondary/50 border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 ease-in-out
        ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary hover:bg-accent'}
        ${isDragging ? 'border-primary bg-accent scale-105' : 'border-border'}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept={acceptedFormats}
        disabled={disabled}
        multiple
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
            <UploadCloudIcon className={`h-12 w-12 mx-auto transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <p className="font-semibold text-foreground/90">
          <span className="text-primary">Clicca per caricare</span> o trascina e rilascia
        </p>
        <p className="text-xs text-muted-foreground">Supporta: TXT, CSV, DOC, XLSX, PDF, Immagini...</p>
      </div>
    </div>
  );
};