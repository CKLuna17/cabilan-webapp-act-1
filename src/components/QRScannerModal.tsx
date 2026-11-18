import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  QrCode,
} from 'lucide-react';
import { ClassSessionRecord, DirectoryEntry, StudentQRPayload } from '../types/attendly';

interface QRScannerModalProps {
  isOpen: boolean;
  session: ClassSessionRecord | null;
  directory: DirectoryEntry[];
  presentCount?: number;
  lateCount?: number;
  waitingCount?: number;
  onClose: () => void;
  onScanStudent: (student: {
    studentId: string;
    studentName: string;
    studentCode?: string;
  }) => Promise<void>;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  session,
  directory,
  presentCount = 0,
  lateCount = 0,
  waitingCount = 0,
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
  const [scanMode, setScanMode] = useState<'qr' | 'barcode'>('qr');
  const [torchOn, setTorchOn] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [lastVerified, setLastVerified] = useState<{
    ok: boolean;
    name: string;
    detail: string;
    initials: string;
  } | null>(null);
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
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchOn(next);
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
          studentCode = trimmed.toUpperCase();
        }
      }

      if (!studentId || !/^[a-zA-Z0-9_\-]+$/.test(studentId)) {
        setLastVerified({
          ok: false,
          name: 'Unrecognized code',
          detail: 'Please scan a valid Attendly Student QR or ID.',
          initials: '!',
        });
        return;
      }

      await onScanStudent({
        studentId,
        studentName: studentName || 'Student',
        studentCode,
      });

      const resolvedName = studentName || studentId;
      const parts = resolvedName.trim().split(/\s+/).filter(Boolean);
      const initials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : resolvedName.slice(0, 2).toUpperCase();
      const timeLabel = new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });

      setLastVerified({
        ok: true,
        name: resolvedName,
        detail: `${studentCode || studentId} · On time, ${timeLabel}`,
        initials,
      });
      setManualInput('');
      setShowManualEntry(false);
    } catch {
      setLastVerified({
        ok: false,
        name: 'Scan failed',
        detail: 'Could not process QR payload. Please try again.',
        initials: '!',
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
      setLastVerified(null);
      setShowManualEntry(false);
      return;
    }
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#0E0B20]/95 backdrop-blur-md flex items-center justify-center sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-h-[94dvh] sm:max-w-md bg-[#0E0B20] sm:rounded-[32px] border border-[#2C2654] shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Top Bar (PDF Pages 5 & 10) */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 text-white">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close scanner"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center min-w-0">
            <h3 className="text-base font-extrabold tracking-tight truncate">
              Scan attendance
            </h3>
            <p className="text-xs text-[#A6A0CE] font-medium truncate">
              {session.courseCode} · {session.room}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-label="Toggle flash"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
              torchOn
                ? 'bg-[#6B5BF7] text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="px-5 py-3 flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
          <div className="relative w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden bg-[#171332] border border-white/10 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraState === 'active' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Crisp Corner Brackets + Scan Laser Line */}
            {cameraState === 'active' && (
              <div className="absolute inset-5 pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
              </div>
            )}

            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs gap-2.5">
                <div className="w-6 h-6 border-2 border-[#7467FF] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#A6A0CE]">Starting camera...</span>
              </div>
            )}

            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 text-white gap-2.5">
                <AlertCircle className="w-7 h-7 text-amber-300" />
                <p className="text-xs font-semibold">Camera unavailable</p>
                <p className="text-[11px] text-[#A6A0CE] max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-white/90 font-medium text-center">
            {scanMode === 'qr'
              ? "Align the student's QR code inside the frame"
              : "Align the student's ID barcode inside the frame"}
          </p>

          {/* QR code / Barcode segmented toggle */}
          <div className="inline-flex items-center p-1 rounded-full bg-white/10 border border-white/10">
            <button
              type="button"
              onClick={() => setScanMode('qr')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                scanMode === 'qr'
                  ? 'bg-white text-[#171332] shadow-xs'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              QR code
            </button>
            <button
              type="button"
              onClick={() => setScanMode('barcode')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                scanMode === 'barcode'
                  ? 'bg-white text-[#171332] shadow-xs'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Barcode
            </button>
          </div>
        </div>

        {/* Bottom Drawer Sheet (PDF Pages 5 Light & 10 Dark) */}
        <div className="bg-white dark:bg-[#1B1738] rounded-t-[28px] p-5 space-y-4 border-t border-[#E7E3FA] dark:border-[#2C2654]">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-[#3A336A] mx-auto -mt-1" />

          {/* Verified Student Banner or Ready State */}
          {lastVerified ? (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-3 ${
                lastVerified.ok
                  ? 'bg-[#E6F7EE] dark:bg-[#143D2B] border border-emerald-200/70 dark:border-emerald-700/40'
                  : 'bg-[#FEE2E2] dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/50'
              }`}
            >
              <div className="relative shrink-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-extrabold ${
                    lastVerified.ok
                      ? 'bg-white dark:bg-[#1B1738] text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-[#1B1738] text-rose-600'
                  }`}
                >
                  {lastVerified.initials}
                </div>
                {lastVerified.ok && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-white dark:fill-[#143D2B] absolute -bottom-0.5 -right-0.5" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-extrabold tracking-wider uppercase ${
                    lastVerified.ok
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {lastVerified.ok ? 'VERIFIED STUDENT' : 'SCAN ERROR'}
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {lastVerified.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-[#B9B3DF] truncate font-mono tabular-nums">
                  {lastVerified.detail}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#F5F3FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ECE9FC] dark:bg-[#2F285F] text-[#5346E8] dark:text-[#9D93FF] flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Scanner ready for {session.courseCode}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE]">
                  Point camera at a student QR pass or tap Enter ID below
                </p>
              </div>
            </div>
          )}

          {/* Present / Late / Waiting Mini Counters */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#F6F5FC] dark:bg-[#241F4A] rounded-2xl py-2.5 px-3 text-center">
              <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {presentCount}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE]">Present</p>
            </div>
            <div className="bg-[#F6F5FC] dark:bg-[#241F4A] rounded-2xl py-2.5 px-3 text-center">
              <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {lateCount}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE]">Late</p>
            </div>
            <div className="bg-[#F6F5FC] dark:bg-[#241F4A] rounded-2xl py-2.5 px-3 text-center">
              <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {waitingCount}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-[#A6A0CE]">Waiting</p>
            </div>
          </div>

          {/* Inline Manual ID Entry Drawer */}
          {showManualEntry && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleDecodedRaw(manualInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter STU-XXXXXX or payload"
                className="flex-1 px-3.5 py-2.5 min-h-[42px] text-xs font-mono bg-[#F7F6FE] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none focus:border-[#6B5BF7] text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={processing || !manualInput.trim()}
                className="px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-[#5346E8] hover:bg-[#4638D6] disabled:opacity-50 rounded-xl cursor-pointer whitespace-nowrap"
              >
                Verify
              </button>
            </form>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowManualEntry((v) => !v)}
              className="py-3 px-4 min-h-[46px] rounded-full text-xs font-bold text-slate-800 dark:text-white bg-[#F4F2FC] dark:bg-[#241F4A] hover:bg-[#ECE9FC] dark:hover:bg-[#2E285D] border border-[#E7E3FA] dark:border-[#322B61] transition cursor-pointer"
            >
              {showManualEntry ? 'Hide ID input' : 'Enter ID'}
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="py-3 px-4 min-h-[46px] rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] shadow-md shadow-[#5142E6]/30 transition cursor-pointer"
            >
              Finish scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
