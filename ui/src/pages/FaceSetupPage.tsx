// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/FaceSetupPage.tsx
//  Face Registration - Modern Design System Upgrade
//
//  One-time face registration page.
//    - Employee: registers their own face        (/face-setup)
//    - Manager:  registers a team member's face   (/manager/face-setup/:userId)
//  Logic unchanged: intro → camera → capture 5 samples → POST /face/register.
//  Fix: a non-numeric :userId (e.g. the literal "/manager/face-setup/:userId"
//  sidebar link) now falls back to registering yourself instead of NaN.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import api from '../services/api';
import { useAuth } from '../context/Authcontext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import {
  ScanFace,
  Camera,
  Lock,
  Lightbulb,
  Glasses,
  Images,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

const STEPS = ['Get ready', 'Camera', 'Capture', 'Done'] as const;

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

  // Determine who we're registering (ignore a non-numeric :userId)
  const parsedId     = userId ? parseInt(userId, 10) : NaN;
  const validUserId  = Number.isFinite(parsedId) ? String(parsedId) : undefined;
  const targetUserId = validUserId ? parsedId : user?.id;
  const isSelf       = targetUserId === user?.id;

  useEffect(() => {
    if (!isSelf && validUserId) {
      // Fetch target user's name for display
      api.get(`/face/descriptor/${validUserId}`)
        .then(r => setTargetName(r.data.fullName))
        .catch(() => setTargetName('Employee'));
    } else {
      setTargetName(user?.fullName ?? 'Your face');
    }
  }, [validUserId, user, isSelf]);

  const handleStartCamera = () => {
    setStep('camera');
  };

  // Start the camera only after the video element has mounted
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

  const stepIndex = step === 'intro' ? 0 : step === 'camera' ? 1 : step === 'capturing' ? 2 : step === 'done' ? 3 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Face Registration"
        description={isSelf ? 'Register your face for faster, verified check-ins.' : `Registering face for ${targetName}.`}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Security' },
          { label: 'Face Setup' },
        ]}
        badge={{ label: 'One-time setup', variant: 'blue', icon: <ScanFace className="w-3 h-3" /> }}
        actions={
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
        className="!mb-0"
      />

      {/* Stepper */}
      {step !== 'error' && (
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < stepIndex || step === 'done';
            const active = i === stepIndex && step !== 'done';
            return (
              <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={`hidden sm:inline text-xs font-semibold ${
                    active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full ${i < stepIndex || step === 'done' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden !rounded-3xl">
        <CardContent className="!p-5 sm:!p-6">

          {/* INTRO */}
          {step === 'intro' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shrink-0">
                  <ScanFace className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {isSelf ? 'Set up your face profile' : `Set up ${targetName}'s face profile`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Takes about 10 seconds</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Images,    title: '5 quick samples',         text: "We'll capture 5 frames to build a face profile." },
                  { icon: Lock,      title: 'No photos stored',        text: 'Only a mathematical fingerprint is saved.' },
                  { icon: Lightbulb, title: 'Good lighting',           text: 'Face the camera directly in a well-lit spot.' },
                  { icon: Glasses,   title: 'Glasses are fine',        text: 'Remove sunglasses; regular glasses are OK.' },
                ].map(tip => {
                  const Icon = tip.icon;
                  return (
                    <div key={tip.title} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{tip.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tip.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <button
                  onClick={() => navigate(-1)}
                  className="sm:flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartCamera}
                  className="sm:flex-[2] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
                >
                  <Camera className="w-4 h-4" /> Open Camera
                </button>
              </div>
            </div>
          )}

          {/* CAMERA / CAPTURING */}
          {(step === 'camera' || step === 'capturing') && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-60 rounded-[50%] border-[3px] transition ${
                    step === 'capturing' ? 'border-blue-400 animate-pulse' : 'border-white/60'
                  }`} />
                </div>
                {step === 'capturing' && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
                    <p className="text-white text-sm font-semibold text-center mb-2">
                      Capturing sample {progress} of 5…
                    </p>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
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
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {isLoading ? 'Loading models…' : 'Start Capture'}
                </button>
              )}

              {step === 'capturing' && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-1">
                  Keep your face still and look at the camera…
                </p>
              )}
            </div>
          )}

          {/* SUCCESS */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Face Registered!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isSelf
                    ? 'Your face is now set up. Future check-ins will verify your identity.'
                    : `${targetName}'s face has been registered successfully.`}
                </p>
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Only a face fingerprint was saved — no photos.
              </p>
              <button
                onClick={() => navigate(-1)}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
              >
                Done
              </button>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <XCircle className="w-9 h-9 text-rose-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Registration Failed</h2>
                <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{errorMsg}</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="sm:flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRetry}
                  className="sm:flex-[2] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}