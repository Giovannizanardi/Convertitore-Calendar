import React, { useState, useRef, useEffect } from 'react';
import { UploadCloudIcon, FileTextIcon, XIcon, CameraIcon, PlusIcon } from './Icons';
import { Loader } from './Loader';
import { CameraCaptureModal } from './CameraCaptureModal';

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  files: File[];
  disabled: boolean;
}

// Subcomponent for file thumbnails / previews
const FilePreview: React.FC<{ file: File }> = ({ file }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={`Anteprima di ${file.name}`}
        className="h-12 w-12 object-cover rounded-lg flex-shrink-0 border border-border"
      />
    );
  }
  return <FileTextIcon className="h-12 w-12 text-primary flex-shrink-0" />;
};

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsProcessing(false);
  }, [files]);

  const handleNewFiles = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setIsProcessing(true);
      // Combine with existing or set new
      onFilesChange([...files, ...newFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleNewFiles(Array.from(e.target.files));
    }
    // reset value so re-selecting same file triggers change
    e.target.value = '';
  };

  const handleCameraCapture = (capturedFile: File) => {
    handleNewFiles([capturedFile]);
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
      handleNewFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    onFilesChange(files.filter((f) => f !== fileToRemove));
  };

  const acceptedFormats = '.txt, .csv, .xls, .xlsx, .pdf, .png, .jpg, .jpeg, .webp';

  if (isProcessing) {
    return (
      <div className="relative bg-secondary/50 border-2 border-dashed border-border rounded-2xl p-10 text-center transition-all duration-300 ease-in-out">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader className="h-12 w-12 text-primary" />
          <p className="font-semibold text-foreground/90">Caricamento in corso...</p>
          <p className="text-xs text-muted-foreground">Preparazione anteprime file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden standard file input */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept={acceptedFormats}
        disabled={disabled}
        multiple
      />

      {/* Hidden native mobile camera input */}
      <input
        ref={mobileCameraInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        disabled={disabled}
      />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {files.length > 0 && !disabled ? (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-5 transition-colors duration-300">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
            <span className="text-sm font-semibold text-foreground">
              File e Immagini Selezionati ({files.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Scatta un'altra foto con la fotocamera"
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span>Scatta Altra Foto</span>
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Aggiungi File</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between bg-secondary/60 hover:bg-secondary p-2.5 rounded-xl transition-all border border-border/40 animate-fade-in"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FilePreview file={file} />
                  <div className="text-left overflow-hidden">
                    <p className="font-semibold text-foreground text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • {file.type || 'Documento'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file)}
                  className="flex-shrink-0 p-1.5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                  title="Rimuovi file"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty upload dropzone with prominent camera action */
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`relative bg-secondary/40 border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 ease-in-out
            ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary hover:bg-accent/40'}
            ${isDragging ? 'border-primary bg-accent scale-[1.01]' : 'border-border'}`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
              <UploadCloudIcon
                className={`h-12 w-12 mx-auto transition-colors duration-300 ${
                  isDragging ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
            </div>
            
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-base">
                Trascina qui i tuoi file oppure scegli un'opzione:
              </p>
              <p className="text-xs text-muted-foreground">
                Documenti (PDF, Excel, CSV, TXT) o Foto (JPG, PNG, WebP)
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setIsCameraOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all flex items-center space-x-2 text-sm transform active:scale-95"
              >
                <CameraIcon className="w-4 h-4" />
                <span>Scatta Foto con Fotocamera</span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="bg-card hover:bg-muted text-foreground border border-border font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-2 text-sm shadow-xs"
              >
                <PlusIcon className="w-4 h-4 text-primary" />
                <span>Scegli File dal Dispositivo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
