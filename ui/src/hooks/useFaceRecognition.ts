// ─────────────────────────────────────────────────────────────────────────────
//  FILE: daily-tracker-ui/src/hooks/useFaceRecognition.ts
//  ACTION: REPLACE entire file
//
//  Fixes:
//  1. face-api.js import — use dynamic import so it works even before npm install
//     Run first: npm install face-api.js
//  2. api import — changed from named { api } to default import
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import api from '../services/api';   // ← default import — matches "export default api"

// face-api.js types — install with: npm install face-api.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;

// Lazy-load face-api.js only when needed (saves bundle size)
async function getFaceApi() {
  if (!faceapi) {
    faceapi = await import('face-api.js');
  }
  return faceapi;
}

// Distance threshold for face matching
// < 0.45 = confident match, > 0.50 = mismatch
const MATCH_THRESHOLD = 0.45;

export type FaceStatus =
  | 'idle'
  | 'loading-models'
  | 'models-ready'
  | 'detecting'
  | 'no-face'
  | 'matched'
  | 'mismatch'
  | 'not-registered'
  | 'error';

export interface FaceVerifyResult {
  success:  boolean;
  distance: number;
  result:   'Matched' | 'Mismatch' | 'NoFaceDetected' | 'NotRegistered';
  message:  string;
}

// ── Singleton model loading — only downloads once per browser session ──────────
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

async function ensureModelsLoaded() {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    const fa = await getFaceApi();
    const MODEL_URL = '/models'; // files in public/models/
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return modelsLoading;
}

// ── Euclidean distance ─────────────────────────────────────────────────────────
function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useFaceRecognition() {
  const [status, setStatus]       = useState<FaceStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (videoEl: HTMLVideoElement) => {
    videoRef.current = videoEl;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      videoEl.srcObject = stream;
      streamRef.current = stream;
      await videoEl.play();
    } catch {
      throw new Error('Camera access denied. Please allow camera in browser settings.');
    }
  }, []);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Verify face against stored descriptor ─────────────────────────────────
  const verify = useCallback(async (
    videoEl: HTMLVideoElement,
    action: 'CheckIn' | 'CheckOut' = 'CheckIn'
  ): Promise<FaceVerifyResult> => {
    setIsLoading(true);
    setStatus('detecting');

    try {
      const fa = await getFaceApi();

      // Load ML models
      setStatus('loading-models');
      await ensureModelsLoaded();
      setStatus('models-ready');

      // Fetch stored descriptor from backend
      const res  = await api.get('/face/descriptor');
      const data = res.data as { faceRegistered: boolean; descriptor?: string };

      if (!data.faceRegistered || !data.descriptor) {
        setStatus('not-registered');
        const result: FaceVerifyResult = {
          success:  false,
          distance: 1,
          result:   'NotRegistered',
          message:  'Face not registered yet. Check-in with GPS only.',
        };
        await logAttempt(action, result);
        return result;
      }

      // Detect live face
      setStatus('detecting');
      const detection = await fa
        .detectSingleFace(videoEl, new fa.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('no-face');
        const result: FaceVerifyResult = {
          success:  false,
          distance: 1,
          result:   'NoFaceDetected',
          message:  'No face detected. Please position your face in the frame.',
        };
        await logAttempt(action, result);
        return result;
      }

      // Compare descriptors
      const stored   = new Float32Array(JSON.parse(data.descriptor) as number[]);
      const live     = detection.descriptor as Float32Array;
      const distance = euclideanDistance(stored, live);
      const success  = distance < MATCH_THRESHOLD;

      const result: FaceVerifyResult = {
        success,
        distance: Math.round(distance * 1000) / 1000,
        result:   success ? 'Matched' : 'Mismatch',
        message:  success
          ? `✅ Face verified (confidence: ${Math.round((1 - distance) * 100)}%)`
          : `❌ Face not recognised (distance: ${distance.toFixed(3)})`,
      };

      setStatus(success ? 'matched' : 'mismatch');
      await logAttempt(action, result);
      return result;

    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Face verification failed.';
      return { success: false, distance: 1, result: 'NoFaceDetected', message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Generate descriptor for registration (averages multiple captures) ─────
  const generateDescriptorForRegistration = useCallback(async (
    videoEl: HTMLVideoElement,
    samples = 5,
    onProgress?: (captured: number) => void
  ): Promise<string | null> => {
    setIsLoading(true);
    setStatus('loading-models');

    try {
      const fa = await getFaceApi();
      await ensureModelsLoaded();
      setStatus('detecting');

      const descriptors: Float32Array[] = [];

      for (let i = 0; i < samples; i++) {
        await new Promise(r => setTimeout(r, 400));

        const detection = await fa
          .detectSingleFace(videoEl, new fa.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          descriptors.push(detection.descriptor as Float32Array);
          onProgress?.(descriptors.length);
        }
      }

      if (descriptors.length < 3) {
        setStatus('no-face');
        return null;
      }

      // Average all captured descriptors
      const avg = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        avg[i] = descriptors.reduce((s, d) => s + d[i], 0) / descriptors.length;
      }

      // Normalise to unit vector
      const norm = Math.sqrt(avg.reduce((s, v) => s + v * v, 0));
      for (let i = 0; i < 128; i++) avg[i] /= norm;

      setStatus('models-ready');
      return JSON.stringify(Array.from(avg));

    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    isLoading,
    videoRef,
    startCamera,
    stopCamera,
    verify,
    generateDescriptorForRegistration,
  };
}

// ── Internal: log attempt to backend ──────────────────────────────────────────
async function logAttempt(action: 'CheckIn' | 'CheckOut', result: FaceVerifyResult) {
  try {
    await api.post('/face/log-attempt', {
      action,
      success:  result.success,
      distance: result.distance,
      result:   result.result,
    });
  } catch {
    // Never block check-in if logging fails
  }
}