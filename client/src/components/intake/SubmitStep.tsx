// src/components/intake/SubmitStep.tsx
// FIXED: Secure rewrite with proper normalization, validation, uploads, and submission hardening

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

interface SubmissionState {
  status: 'idle' | 'validating' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  submissionId?: string;
  errors: string[];
}

type SafeJSON = Record<string, unknown> | null;

const JSON_HEADERS = { 'Content-Type': 'application/json' as const };
const MAX_PHOTO_MB = 10;
const MAX_VOICE_MB = 25;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
]);

// Small utility to enforce fetch timeouts + safe JSON parsing
async function safeFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<{ ok: boolean; status: number; json: SafeJSON; res: Response }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal, credentials: 'include' });
    let json: SafeJSON = null;
    try {
      // Only try JSON if content-type indicates JSON
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        json = (await res.json()) as SafeJSON;
      }
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, res };
  } finally {
    clearTimeout(id);
  }
}

const SubmitStep = () => {
  const navigate = useNavigate();
  const { getIntake } = useIntake();

  // Normalize the context value once (function or object)
  const intake = useMemo(
    () => (typeof getIntake === 'function' ? (getIntake as any)() : (getIntake as any)),
    [getIntake]
  );

  const [submission, setSubmission] = useState<SubmissionState>({
    status: 'idle',
    progress: 0,
    message: '',
    errors: [],
  });

  // --- Validation helpers ---
  const fileTooLarge = (sizeBytes: number, maxMB: number) => sizeBytes > maxMB * 1024 * 1024;

  const validateIntakeData = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Required
    if (!intake.userRegistered && !intake.userLoggedIn || !intake.userLoggedIn) errors.push('User needs to create an account');
    if (!intake.name) errors.push('Name is required');
    if (!intake.personalityResult) errors.push('Personality assessment incomplete');
    if (!intake.iqResults) errors.push('IQ assessment incomplete');
    if (!intake.astrologicalResult) errors.push('Astrological assessment incomplete');

    // Optional but recommended
    if (!intake.photo) errors.push('Photo not captured (recommended)');
    if (!intake.voice) errors.push('Voice recording not captured (recommended)');
    if (!intake.faceAnalysis && intake.photo) errors.push('Face analysis not available');

    // File validations (if present)
    if (intake.photo) {
      if (!(intake.photo instanceof File)) {
        errors.push('Photo file is invalid');
      } else {
        if (!ALLOWED_IMAGE_TYPES.has(intake.photo.type)) {
          errors.push('Unsupported photo format. Use JPG, PNG, or WEBP.');
        }
        if (fileTooLarge(intake.photo.size, MAX_PHOTO_MB)) {
          errors.push(`Photo exceeds ${MAX_PHOTO_MB} MB limit`);
        }
      }
    }

    if (intake.voice) {
      // Many browsers record WebM; accept Blob but verify size & type when available
      const voiceBlob: Blob = intake.voice;
      const type = (voiceBlob as any).type || '';
      if (type && !ALLOWED_AUDIO_TYPES.has(type)) {
        errors.push('Unsupported voice format. Use webm/ogg/mpeg/mp4/wav.');
      }
      if (fileTooLarge(voiceBlob.size ?? 0, MAX_VOICE_MB)) {
        errors.push(`Voice recording exceeds ${MAX_VOICE_MB} MB limit`);
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const prepareSubmissionData = (): Record<string, unknown> => ({
    userRegistered: !!intake.userRegistered,
    name: String(intake.name || ''),
    // large binaries are not sent here; only URLs after upload
    faceAnalysis: intake.faceAnalysis ?? null,
    voiceMetadata: intake.voiceMetadata ?? null,
    voicePrompt: intake.voicePrompt ?? null,
    iqResults: intake.iqResults ?? null,
    iqAnswers: intake.iqAnswers ?? null,
    astrologicalResult: intake.astrologicalResult ?? null,
    personalityResult: intake.personalityResult ?? null,
    personalityAnswers: intake.personalityAnswers ?? null,
  });

  // Upload helper to one endpoint, returns url string
  const uploadOne = async (fileOrBlob: File | Blob, type: 'photo' | 'voice'): Promise<string> => {
    const form = new FormData();

    if (type === 'photo' && fileOrBlob instanceof File) {
      // Sanitize filename to avoid header injection or weird paths (server should also sanitize)
      const safeName = fileOrBlob.name.replace(/[^\w.\-]/g, '_').slice(0, 120) || 'photo';
      form.append('file', fileOrBlob, safeName);
    } else {
      form.append('file', fileOrBlob, type === 'voice' ? 'voice_recording.webm' : 'upload.bin');
    }
    form.append('type', type);

    const { ok, status, json } = await safeFetch('/mirror/api/storage/', {
      method: 'POST',
      body: form,
    });

    if (!ok) {
      const msg =
        (json && typeof json === 'object' && typeof (json as any).message === 'string'
          ? (json as any).message
          : `Upload failed with status ${status}`) || 'Upload failed';
      throw new Error(`${type[0].toUpperCase() + type.slice(1)} upload failed: ${msg}`);
    }

    const fileUrl = json && typeof json === 'object' ? (json as any).fileUrl : undefined;
    if (!fileUrl || typeof fileUrl !== 'string') {
      throw new Error(`${type[0].toUpperCase() + type.slice(1)} upload failed: invalid server response`);
    }
    return fileUrl;
  };

  const uploadFiles = async (): Promise<{ photoUrl?: string; voiceUrl?: string }> => {
    const uploads: { photoUrl?: string; voiceUrl?: string } = {};

    if (intake.photo && intake.photo instanceof File) {
      uploads.photoUrl = await uploadOne(intake.photo, 'photo');
      setSubmission((p) => ({ ...p, progress: Math.min(50, p.progress + 25) }));
    }

    if (intake.voice && intake.voice instanceof Blob) {
      uploads.voiceUrl = await uploadOne(intake.voice, 'voice');
      setSubmission((p) => ({ ...p, progress: Math.min(75, p.progress + 25) }));
    }

    return uploads;
  };

  const handleSubmit = async () => {
    try {
      // Step 1: Validation
      setSubmission({
        status: 'validating',
        progress: 0,
        message: 'Validating submission data...',
        errors: [],
      });

      const validation = validateIntakeData();
      if (!validation.isValid) {
        setSubmission({
          status: 'error',
          progress: 0,
          message: 'Validation failed',
          errors: validation.errors,
        });
        return;
      }

      // Step 2: Upload files (if any)
      setSubmission((p) => ({
        ...p,
        status: 'uploading',
        progress: 10,
        message: 'Uploading files securely...',
      }));

      const fileUploads = await uploadFiles();

      // Step 3: Prepare final payload
      setSubmission((p) => ({
        ...p,
        status: 'processing',
        progress: 60,
        message: 'Preparing submission...',
      }));

      const submissionData = prepareSubmissionData();
      if (fileUploads.photoUrl) (submissionData as any).photoUrl = fileUploads.photoUrl;
      if (fileUploads.voiceUrl) (submissionData as any).voiceUrl = fileUploads.voiceUrl;

      // Step 4: Submit to processing engine
      setSubmission((p) => ({
        ...p,
        progress: 80,
        message: 'Submitting to processing engine...',
      }));

      const { ok, status, json } = await safeFetch('/mirror/api/intake/submit', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(submissionData),
      });

      if (!ok) {
        const msg =
          (json && typeof json === 'object' && typeof (json as any).message === 'string'
            ? (json as any).message
            : `Submission failed with status ${status}`) || 'Submission failed';
        throw new Error(msg);
      }

      const submissionId =
        json && typeof json === 'object' && typeof (json as any).submissionId === 'string'
          ? (json as any).submissionId
          : undefined;

      setSubmission({
        status: 'success',
        progress: 100,
        message: 'Submission successful!',
        submissionId,
        errors: [],
      });

      // Navigate to results immediately (no background promises)
      navigate('/intake/results', {
        state: submissionId ? { submissionId } : undefined,
      });
    } catch (err) {
      console.error('Submission failed:', err);
      setSubmission({
        status: 'error',
        progress: 0,
        message: 'Submission failed',
        errors: [err instanceof Error ? err.message : 'Unknown error occurred'],
      });
    }
  };

  const handleRetry = () => {
    setSubmission({
      status: 'idle',
      progress: 0,
      message: '',
      errors: [],
    });
  };

  const getDataSummary = () => {
    const summary: string[] = [];
    if (intake.photo) summary.push('📸 Photo captured');
    if (intake.voice) summary.push('🎤 Voice recorded');
    if (intake.faceAnalysis) summary.push('😊 Face analyzed');
    if (intake.personalityResult) summary.push('🧠 Personality assessed');
    if (intake.iqResults) summary.push('🧩 IQ assessed');
    if (intake.astrologicalResult) summary.push('⭐ Astrology complete');
    return summary;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <GlassCard className="p-8">
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold text-white">Confirm &amp; Submit</h2>
            <p className="text-white/70">Review your data and submit for analysis</p>

            {/* Data Summary */}
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-white mb-4">Data Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {getDataSummary().map((item, index) => (
                  <div key={index} className="text-white/80 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Validation/Runtime Errors */}
            <AnimatePresence>
              {submission.errors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl"
                >
                  <h4 className="text-red-100 font-semibold mb-2">Issues Found:</h4>
                  <ul className="text-red-100/80 text-sm space-y-1">
                    {submission.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress */}
            <AnimatePresence>
              {submission.status !== 'idle' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <motion.div
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${submission.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-white/80">{submission.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              {submission.status === 'idle' || submission.status === 'error' ? (
                <>
                  {submission.status === 'error' && (
                    <GlassButton onClick={handleRetry} className="bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30">
                      🔄 Retry Submission
                    </GlassButton>
                  )}
                  <GlassButton
                    onClick={handleSubmit}
                    disabled={submission.status === 'error' && submission.errors.length > 3}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  >
                    🚀 Submit My Profile
                  </GlassButton>
                </>
              ) : submission.status === 'success' ? (
                <GlassButton onClick={() => navigate('/intake/results')} className="bg-green-500/20 border-green-400/30 hover:bg-green-500/30">
                  ✅ View Results
                </GlassButton>
              ) : (
                <div className="text-white/60">Processing your submission...</div>
              )}
            </div>

            {/* Debug Info (safe, no large blobs) */}
            <details className="text-left">
              <summary className="text-white/60 text-sm cursor-pointer">Debug Info</summary>
              <pre className="text-white/40 text-xs mt-2 p-2 bg-black/20 rounded overflow-auto max-h-40">
                {JSON.stringify(
                  {
                    hasPhoto: !!intake.photo,
                    photoType: intake.photo?.type || null,
                    hasVoice: !!intake.voice,
                    voiceType: intake.voice?.type || null,
                    hasFaceAnalysis: !!intake.faceAnalysis,
                    hasPersonality: !!intake.personalityResult,
                    hasIQ: !!intake.iqResults,
                    hasAstrology: !!intake.astrologicalResult,
                    submissionStatus: submission.status,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default SubmitStep;
