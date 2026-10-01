import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, FlipCameraIcon, XIcon, RefreshCwIcon, CheckCircleIcon } from './Icons';
import { Loader } from './Loader';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // Stop stream helper
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setIsLoadingCamera(true);
    setCameraError(null);

    // Stop current stream if any
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      // Check available devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      // If environment failed, try user/fallback
      if (facing === 'environment') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
          setIsLoadingCamera(false);
          return;
        } catch (fallbackErr) {
          // Both failed
        }
      }

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Permesso di accesso alla fotocamera negato. Consenti l'accesso nelle impostazioni del browser o usa il pulsante fotocamera diretta.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Nessuna fotocamera rilevata sul dispositivo.');
      } else {
        setCameraError('Impossibile avviave la fotocamera: ' + (err.message || 'Errore sconosciuto'));
      }
    } finally {
      setIsLoadingCamera(false);
    }
  }, [stream]);

  // When modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCapturedImageUrl(null);
      setCapturedBlob(null);
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedImageUrl(null);
      setCapturedBlob(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Ensure video element gets the stream when it mounts or changes
  useEffect(() => {
    if (videoRef.current && stream && !capturedImageUrl) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, capturedImageUrl]);

  const handleToggleCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to video intrinsic stream resolution
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger visual flash animation
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    // If facingMode is user, we may want to mirror, but for documents/schedules usually standard orientation is best
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        const preview = URL.createObjectURL(blob);
        setCapturedImageUrl(preview);
      }
    }, 'image/jpeg', 0.92);
  };

  const handleRetake = () => {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setCapturedBlob(null);
    // Restart camera if stream was disconnected
    if (!stream || !stream.active) {
      startCamera(facingMode);
    }
  };

  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const photoFile = new File([capturedBlob], `foto_evento_${timestamp}.jpg`, {
      type: 'image/jpeg',
    });
    onCapture(photoFile);
    onClose();
  };

  const handleFallbackFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onCapture(file);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CameraIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Acquisisci Foto da Fotocamera</h3>
              <p className="text-xs text-muted-foreground">Inquadra orario, volantino, documento o bacheca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Chiudi"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Video Preview / Photo Result */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px] sm:min-h-[420px]">
          {/* Flash animation overlay */}
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-30 pointer-events-none transition-opacity duration-200" />
          )}

          {capturedImageUrl ? (
            /* Review captured photo */
            <div className="relative w-full h-full flex items-center justify-center p-2 bg-black">
              <img
                src={capturedImageUrl}
                alt="Foto acquisita"
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-lg shadow-lg border border-border/40"
              />
              <div className="absolute top-4 left-4 bg-emerald-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-md">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Foto acquisita pronta</span>
              </div>
            </div>
          ) : cameraError ? (
            /* Error state / Fallback */
            <div className="p-6 text-center max-w-md mx-auto text-white flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mb-3">
                <CameraIcon className="w-6 h-6" />
              </div>
              <p className="font-semibold text-lg mb-1">Accesso Fotocamera</p>
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">{cameraError}</p>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  onClick={() => fallbackInputRef.current?.click()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
                >
                  <CameraIcon className="w-4 h-4" />
                  <span>Usa Fotocamera di Sistema</span>
                </button>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="bg-secondary hover:bg-muted text-secondary-foreground font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCwIcon className="w-4 h-4" />
                  <span>Riprova</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              {isLoadingCamera && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white">
                  <Loader className="w-10 h-10 text-primary mb-2" />
                  <p className="text-sm font-medium">Avvio fotocamera in corso...</p>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[60vh] object-cover"
              />

              {/* Viewfinder Target Framing Overlay */}
              <div className="absolute inset-6 sm:inset-10 border-2 border-primary/40 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                </div>
                <div className="text-center">
                  <span className="bg-black/60 text-white/90 text-xs px-3 py-1 rounded-full backdrop-blur-xs font-medium">
                    Allinea testo o documento all'interno del riquadro
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>

              {/* Camera Switch button if supported */}
              {hasMultipleCameras && (
                <button
                  onClick={handleToggleCamera}
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full backdrop-blur-xs transition-transform active:scale-95 shadow-md"
                  title="Cambia fotocamera (Frontale/Posteriore)"
                >
                  <FlipCameraIcon className="w-5 h-5" />
                </button>
              )}
            </>
          )}

          {/* Hidden Canvas for capture rendering */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Hidden Native File Input with capture='environment' fallback */}
          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFallbackFileInput}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-card border-t border-border flex items-center justify-between gap-3">
          {capturedImageUrl ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted font-medium transition-colors text-sm"
              >
                <RefreshCwIcon className="w-4 h-4" />
                <span>Rifai Scatto</span>
              </button>
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmPhoto}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 text-sm transition-transform active:scale-95"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Usa questa Foto</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => fallbackInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
              >
                Fotocamera di sistema / Galleria
              </button>

              <div className="flex items-center space-x-4 ml-auto">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Annulla
                </button>

                <button
                  onClick={handleTakeSnapshot}
                  disabled={isLoadingCamera || !!cameraError}
                  className="relative group p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Scatta Foto"
                >
                  <div className="w-14 h-14 rounded-full border-4 border-primary flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95">
                    <div className="w-10 h-10 rounded-full bg-primary group-hover:bg-primary/90" />
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
