// ─────────────────────────────────────────────────────────────────────────────
//  FILE 8: daily-tracker-ui/src/pages/FaceSetupPage.tsx
//  ACTION: CREATE new file
//
//  One-time face registration page.
//  Accessible by:
//    - Employee: registers their own face (/profile/face-setup)
//    - Manager: registers any team member's face (/manager/face-setup/:userId)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import api from '../services/api';
import { useAuth } from '../context/Authcontext';

export function FaceSetupPage() {
  const { userId }  = useParams<{ userId?: string }>();
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const videoRef    = useRef<HTMLVideoElement>(null);

  const { startCamera, stopCamera, generateDescriptorForRegistration, isLoading } =
    useFaceRecognition();

  const [step, setStep]           = useState<'intro' | 'camera' | 'capturing' | 'done' | 'error'>('intro');
  const [progress, setProgress]   = useState(0);   // 0-5 samples captured
  const [errorMsg, setErrorMsg]   = useState('');
  const [targetName, setTargetName] = useState('');

  // Determine who we're registering
  const targetUserId = userId ? parseInt(userId) : user?.id;
  const isSelf       = targetUserId === user?.id;

  useEffect(() => {
    if (!isSelf && userId) {
      // Fetch target user's name for display
      api.get(`/face/descriptor/${userId}`)
        .then(r => setTargetName(r.data.fullName))
        .catch(() => setTargetName('Employee'));
    } else {
      setTargetName(user?.fullName ?? 'Your face');
    }
  }, [userId, user, isSelf]);

  const handleStartCamera = () => {
    setStep('camera');
  };

  // Start the camera only after the video element has actually mounted
  // (i.e. after `step` flips to 'camera' and React commits the DOM).
  useEffect(() => {
    if (step !== 'camera') return;
    let cancelled = false;

    (async () => {
      try {
        if (videoRef.current) {
          await startCamera(videoRef.current);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message);
          setStep('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, startCamera]);

  // Always release the camera if the user navigates away mid-flow
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setStep('capturing');
    setProgress(0);

    try {
      const descriptor = await generateDescriptorForRegistration(
        videoRef.current,
        5,
        (captured) => setProgress(captured)
      );

      if (!descriptor) {
        setErrorMsg('Could not detect a clear face. Ensure good lighting and face the camera directly.');
        setStep('error');
        stopCamera();
        return;
      }

      // Save to backend
      await api.post('/face/register', {
        descriptor,
        targetUserId: isSelf ? undefined : targetUserId,
      });

      stopCamera();
      setStep('done');

    } catch (err: any) {
      setErrorMsg(err.response?.data?.message ?? err.message ?? 'Registration failed.');
      setStep('error');
      stopCamera();
    }
  };

  const handleRetry = () => {
    setStep('intro');
    setProgress(0);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-xl">
            🤳
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Face Registration</h1>
            <p className="text-slate-400 text-xs">
              {isSelf ? 'Register your face for check-in' : `Registering face for ${targetName}`}
            </p>
          </div>
        </div>

        {/* INTRO STEP */}
        {step === 'intro' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
              {[
                '📸 We\'ll capture 5 photos to create your face profile',
                '🔒 No photos are stored — only a mathematical fingerprint',
                '💡 Ensure good lighting and face the camera directly',
                '👓 Remove sunglasses. Regular glasses are fine',
              ].map(tip => (
                <p key={tip} className="text-blue-300 text-sm">{tip}</p>
              ))}
            </div>
            <button
              onClick={handleStartCamera}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition"
            >
              Open Camera
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* CAMERA STEP */}
        {(step === 'camera' || step === 'capturing') && (
          <div className="space-y-4">
            {/* Video preview */}
            <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]" // mirror effect
              />
              {/* Face outline guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-56 border-2 border-blue-400/60 rounded-full" />
              </div>
              {/* Progress overlay when capturing */}
              {step === 'capturing' && (
                <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 p-3">
                  <p className="text-white text-sm text-center mb-2">
                    Capturing sample {progress} of 5...
                  </p>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(progress / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {step === 'camera' && (
              <button
                onClick={handleCapture}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition"
              >
                {isLoading ? 'Loading models...' : '📸 Start Capture'}
              </button>
            )}

            {step === 'capturing' && (
              <div className="text-center text-slate-400 text-sm py-2">
                Keep your face still and look at the camera...
              </div>
            )}
          </div>
        )}

        {/* SUCCESS STEP */}
        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
              ✅
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Face Registered!</h2>
              <p className="text-slate-400 text-sm mt-1">
                {isSelf
                  ? 'Your face is now set up. Future check-ins will verify your identity.'
                  : `${targetName}'s face has been registered successfully.`}
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition"
            >
              Done
            </button>
          </div>
        )}

        {/* ERROR STEP */}
        {step === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
              ❌
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Registration Failed</h2>
              <p className="text-red-400 text-sm mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}