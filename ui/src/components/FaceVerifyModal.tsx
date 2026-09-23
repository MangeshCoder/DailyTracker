// ─────────────────────────────────────────────────────────────────────────────
//  FILE 9: daily-tracker-ui/src/components/FaceVerifyModal.tsx
//  ACTION: CREATE new file
//
//  The check-in face verification modal.
//  Opens camera → verifies face → calls onSuccess(result) or onSkip().
//
//  Props:
//    action:    'CheckIn' | 'CheckOut'
//    isWFH:     boolean — if true, skip face check entirely
//    onSuccess: (result) => void — called when verified (or skipped)
//    onCancel:  () => void — user closed the modal
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useFaceRecognition, type FaceVerifyResult } from '../hooks/useFaceRecognition';

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
      }, 800); // brief pause to show "✅ Face verified"
    }
  };

  const handleSkip = () => {
    stopCamera();
    onSuccess(null); // null = skipped face check, proceed with GPS only
  };

  const statusColor = () => {
    if (status === 'matched')   return 'text-emerald-400';
    if (status === 'mismatch')  return 'text-red-400';
    if (status === 'no-face')   return 'text-amber-400';
    if (status === 'detecting') return 'text-blue-400';
    return 'text-slate-400';
  };

  const statusText = () => {
    if (cameraError)            return cameraError;
    if (!cameraReady)           return 'Starting camera...';
    if (status === 'idle')      return 'Press "Verify Face" when ready';
    if (status === 'loading-models') return 'Loading AI models (first time only)...';
    if (status === 'detecting') return 'Detecting face...';
    if (status === 'no-face')   return '⚠️ No face detected — adjust position';
    if (status === 'matched')   return lastResult?.message ?? '✅ Face verified!';
    if (status === 'mismatch')  return lastResult?.message ?? '❌ Face not recognised';
    if (status === 'not-registered') return '⚠️ Face not registered — will check in with GPS only';
    return 'Tap verify to scan your face';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">
              {action === 'CheckIn' ? '🔐 Face Verification — Check In' : '🔐 Face Verification — Check Out'}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Optional — skip to use GPS location only
            </p>
          </div>
          <button onClick={() => { stopCamera(); onCancel(); }}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition text-lg">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {cameraError ? (
            // Camera error state
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-red-400 text-sm">{cameraError}</p>
              <p className="text-slate-500 text-xs mt-2">
                You can still check in using GPS location only.
              </p>
            </div>
          ) : (
            // Camera view
            <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Oval face guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-40 h-48 border-2 rounded-full transition-colors ${
                  status === 'matched'  ? 'border-emerald-400' :
                  status === 'mismatch' ? 'border-red-400'     :
                  'border-blue-400/50'
                }`} />
              </div>
              {/* Status overlay at bottom */}
              <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 px-3 py-2">
                <p className={`text-xs text-center font-medium ${statusColor()}`}>
                  {statusText()}
                </p>
              </div>
            </div>
          )}

          {/* Attempt history */}
          {attempts > 0 && lastResult && !lastResult.success && (
            <div className="bg-slate-800/60 rounded-xl px-3 py-2">
              <p className="text-slate-400 text-xs">
                Attempt {attempts}: {lastResult.result}
                {lastResult.distance < 1 && ` (distance: ${lastResult.distance.toFixed(3)})`}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {!cameraError && status !== 'matched' && (
              <button
                onClick={handleVerify}
                disabled={isLoading || !cameraReady}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                  disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning...
                  </span>
                ) : attempts === 0 ? '🔍 Verify Face' : '🔍 Try Again'}
              </button>
            )}

            {status === 'matched' && (
              <div className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30
                text-emerald-400 font-semibold rounded-xl text-center">
                ✅ Verified — proceeding...
              </div>
            )}

            <button
              onClick={handleSkip}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400
                hover:text-white text-sm rounded-xl transition"
            >
              Skip — Use GPS Only
            </button>
          </div>

          {/* After 3 failed attempts, note that it's still logged */}
          {attempts >= 3 && lastResult && !lastResult.success && (
            <p className="text-amber-400/80 text-xs text-center">
              ⚠️ Failed attempts are logged and visible to your manager.
              You can still check in with GPS only.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}