// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/FaceVerifyModal.tsx
//  Face Verification Modal - Modern Design System Upgrade
//
//  Used by Dashboard + AI Copilot for check-in / check-out.
//  Logic unchanged from previous version:
//  ✅ Opens camera → verify face → onSuccess(result)
//  ✅ WFH → skips face check immediately (onSuccess(null))
//  ✅ "Skip — use GPS only" → onSuccess(null)
//  ✅ Close → stops camera + onCancel()
//
//  Props:
//    action:    'CheckIn' | 'CheckOut'
//    isWFH:     boolean — if true, skip face check entirely
//    onSuccess: (result) => void — called when verified (or skipped)
//    onCancel:  () => void — user closed the modal
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useFaceRecognition, type FaceVerifyResult } from '../hooks/useFaceRecognition';
import {
  ScanFace,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CameraOff,
  MapPin,
  RotateCcw,
  Info,
  Camera,
} from 'lucide-react';

interface Props {
  action:    'CheckIn' | 'CheckOut';
  isWFH:     boolean;
  onSuccess: (result: FaceVerifyResult | null) => void;
  onCancel:  () => void;
}

export function FaceVerifyModal({ action, isWFH, onSuccess, onCancel }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const [attempts, setAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<FaceVerifyResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const { status, isLoading, startCamera, stopCamera, verify } = useFaceRecognition();

  // Start camera when modal mounts
  useEffect(() => {
    if (isWFH) return; // skip for WFH
    let mounted = true;

    (async () => {
      try {
        if (videoRef.current) {
          await startCamera(videoRef.current);
          if (mounted) setCameraReady(true);
        }
      } catch (err: any) {
        if (mounted) setCameraError(err.message);
      }
    })();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [isWFH]);

  // If WFH — immediately skip face check
  useEffect(() => {
    if (isWFH) onSuccess(null);
  }, [isWFH]);

  const handleVerify = async () => {
    if (!videoRef.current) return;
    const result = await verify(videoRef.current, action);
    setLastResult(result);
    setAttempts(a => a + 1);

    if (result.success) {
      setTimeout(() => {
        stopCamera();
        onSuccess(result);
      }, 800); // brief pause to show "Face verified"
    }
  };

  const handleSkip = () => {
    stopCamera();
    onSuccess(null); // null = skipped face check, proceed with GPS only
  };

  // ── Status pill (colour + icon + text) ────────────────────────────────────
  const statusMeta = (): { cls: string; icon: React.ElementType; text: string; spin?: boolean } => {
    if (!cameraReady)                  return { cls: 'bg-slate-900/80 text-slate-200',   icon: Loader2,       text: 'Starting camera…', spin: true };
    if (status === 'loading-models')   return { cls: 'bg-slate-900/80 text-blue-200',    icon: Loader2,       text: 'Loading AI models (first time only)…', spin: true };
    if (status === 'detecting')        return { cls: 'bg-blue-600/90 text-white',        icon: Loader2,       text: 'Detecting face…', spin: true };
    if (status === 'no-face')          return { cls: 'bg-amber-500/90 text-white',       icon: AlertTriangle, text: 'No face detected — adjust position' };
    if (status === 'matched')          return { cls: 'bg-emerald-600/90 text-white',     icon: CheckCircle2,  text: lastResult?.message ?? 'Face verified!' };
    if (status === 'mismatch')         return { cls: 'bg-rose-600/90 text-white',        icon: XCircle,       text: lastResult?.message ?? 'Face not recognised' };
    if (status === 'not-registered')   return { cls: 'bg-amber-500/90 text-white',       icon: AlertTriangle, text: 'Face not registered — will check in with GPS only' };
    return { cls: 'bg-slate-900/80 text-slate-200', icon: ScanFace, text: 'Look at the camera and press "Verify Face"' };
  };

  const meta = statusMeta();
  const StatusIcon = meta.icon;

  const ovalCls =
    status === 'matched'   ? 'border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]' :
    status === 'mismatch'  ? 'border-rose-400 shadow-[0_0_0_4px_rgba(244,63,94,0.25)]' :
    status === 'detecting' ? 'border-blue-400 animate-pulse' :
    'border-white/60';

  const close = () => { stopCamera(); onCancel(); };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Gradient header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white">
          <button
            onClick={close}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <ScanFace className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Face Verification</h2>
              <p className="text-xs text-white/80">
                {action === 'CheckIn' ? 'Check In' : 'Check Out'} · optional — you can skip to use GPS only
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {cameraError ? (
            <div className="rounded-2xl p-5 text-center bg-rose-500/5 border border-rose-500/20">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 flex items-center justify-center">
                <CameraOff className="w-6 h-6 text-rose-500" />
              </div>
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 mt-3">{cameraError}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                You can still continue using GPS location only.
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Dim outside + oval face guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-44 h-56 rounded-[50%] border-[3px] transition-all duration-300 ${ovalCls}`} />
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <Camera className="w-10 h-10 text-slate-600" />
                </div>
              )}
              {/* Status pill */}
              <div className="absolute bottom-3 inset-x-3 flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${meta.cls}`}>
                  <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${meta.spin ? 'animate-spin' : ''}`} />
                  <span className="line-clamp-1">{meta.text}</span>
                </span>
              </div>
            </div>
          )}

          {/* Last failed attempt */}
          {attempts > 0 && lastResult && !lastResult.success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                Attempt {attempts}: {lastResult.result}
                {lastResult.distance < 1 && ` (distance: ${lastResult.distance.toFixed(3)})`}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {!cameraError && status !== 'matched' && (
              <button
                onClick={handleVerify}
                disabled={isLoading || !cameraReady}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                ) : attempts === 0 ? (
                  <><ScanFace className="w-4 h-4" /> Verify Face</>
                ) : (
                  <><RotateCcw className="w-4 h-4" /> Try Again</>
                )}
              </button>
            )}

            {status === 'matched' && (
              <div className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Verified — proceeding…
              </div>
            )}

            <button
              onClick={handleSkip}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <MapPin className="w-4 h-4" /> Skip — Use GPS Only
            </button>
          </div>

          {/* After 3 failed attempts */}
          {attempts >= 3 && lastResult && !lastResult.success && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Failed attempts are logged and visible to your manager. You can still check in with GPS only.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}