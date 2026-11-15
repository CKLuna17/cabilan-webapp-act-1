import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, QrCode } from 'lucide-react';
import { ClassSessionRecord, DirectoryEntry, StudentQRPayload } from '../types/attendly';

interface QRScannerModalProps {
  isOpen: boolean;
  session: ClassSessionRecord | null;
  directory: DirectoryEntry[];
  onClose: () => void;
  onScanStudent: (student: { studentId: string; studentName: string; studentCode?: string }) => Promise<void>;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  session,
  directory,
  onClose,
  onScanStudent,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodedRef = useRef<{ value: string; time: number }>({ value: '', time: 0 });

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'error'>('starting');
  const [cameraError, setCameraError] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleDecodedRaw = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || processing) return;

    const now = Date.now();
    if (lastDecodedRef.current.value === trimmed && now - lastDecodedRef.current.time < 3000) {
      return;
    }
    lastDecodedRef.current = { value: trimmed, time: now };

    setProcessing(true);
    try {
      let studentId = '';
      let studentName = '';
      let studentCode = '';

      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed) as Partial<StudentQRPayload>;
        studentId = parsed.studentId || '';
        studentName = parsed.studentName || '';
        studentCode = parsed.studentCode || '';
      } else {
        const matchedMember = directory.find(
          (d) =>
            d.id === trimmed ||
            (d.studentCode && d.studentCode.toUpperCase() === trimmed.toUpperCase())
        );
        if (matchedMember) {
          studentId = matchedMember.id;
          studentName = matchedMember.displayName;
          studentCode = matchedMember.studentCode || '';
        } else if (/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
          studentId = trimmed;
          studentName = `Student (${trimmed.slice(0, 8)})`;
        }
      }

      if (!studentId || !/^[a-zA-Z0-9_\-]+$/.test(studentId)) {
        setLastResult({
          ok: false,
          text: 'Unrecognized QR format. Please scan an Attendly Student QR code.',
        });
        return;
      }

      await onScanStudent({
        studentId,
        studentName: studentName || 'Student',
        studentCode,
      });

      setLastResult({
        ok: true,
        text: `Marked Present: ${studentName || studentId}${studentCode ? ` (${studentCode})` : ''}`,
      });
      setManualInput('');
    } catch {
      setLastResult({
        ok: false,
        text: 'Could not process QR payload. Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraState('starting');
    setCameraError('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setCameraError('Camera API is not supported in this browser.');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code?.data) {
              void handleDecodedRaw(code.data);
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Camera permission was denied or no camera device is attached.';
      setCameraState('error');
      setCameraError(message);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastResult(null);
      return;
    }
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white/80 backdrop-blur-3xl rounded-2xl sm:rounded-3xl border border-white/85 shadow-2xl">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">Scan Student QR Code</h3>
              <p className="text-xs text-slate-700 font-medium truncate">
                {session.courseCode} · {session.building} {session.room}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/70 rounded-xl transition cursor-pointer shrink-0"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="relative aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/60 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'opacity-100' : 'opacity-0'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Target Reticle */}
            {cameraState === 'active' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
              </div>
            )}

            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs gap-2">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting device camera...</span>
              </div>
            )}

            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 sm:p-5 text-white gap-2.5">
                <AlertCircle className="w-7 h-7 text-amber-300" />
                <p className="text-xs font-semibold">Camera unavailable or blocked</p>
                <p className="text-[11px] text-white/75 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Scan Feedback Banner */}
          {lastResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                lastResult.ok
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/90 border-rose-200 text-rose-800'
              }`}
            >
              {lastResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{lastResult.text}</span>
            </div>
          )}

          {/* Fallback / Manual QR Code Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleDecodedRaw(manualInput);
            }}
            className="pt-2 border-t border-white/50 space-y-2"
          >
            <label className="block text-[11px] font-semibold text-slate-700">
              Or enter Student ID / QR code value manually
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Paste QR payload or STU-XXXXXX"
                className="flex-1 px-3.5 py-2.5 min-h-[42px] text-xs font-mono bg-white/80 border border-white rounded-xl focus:outline-none text-slate-900"
              />
              <button
                type="submit"
                disabled={processing || !manualInput.trim()}
                className="px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Record Scan</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
