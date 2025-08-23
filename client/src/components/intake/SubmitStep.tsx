// src/components/intake/SubmitStep.tsx
// Secure + robust submission: proper endpoint wiring, resilient JSON parsing,
// file reference handling (matches server schema), and simple debug output.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserInfo } from '../../utils/token';

interface SubmissionState {
  status: 'idle' | 'validating' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  submissionId?: string;
  errors: string[];
  lastServer?: unknown;
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

const ENDPOINTS = {
  upload: '/mirror/api/storage/store',
  intakeStore: '/mirror/api/intake/store',
};

// ---- Fetch helper: always read text, then try JSON (handles bad/missing content-type) ----
async function safeFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<{ ok: boolean; status: number; json: SafeJSON; text: string; res: Response }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal, credentials: 'include' });
    const text = await res.text();
    let json: SafeJSON = null;
    try {
      json = JSON.parse(text) as SafeJSON;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text, res };
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
    if ((!intake.userRegistered && !intake.userLoggedIn) || !intake.userLoggedIn) {
      errors.push('User needs to create an account');
    }
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

  // ---- Build the hybrid intake payload expected by the server controller ----
  const buildHybridPayload = (opts: {
    userId: string;
    photoRef?: any;
    voiceRef?: any;
  }) => {
    const { userId, photoRef, voiceRef } = opts;

    const intakeData: Record<string, unknown> = {
      userLoggedIn: Boolean(intake.userLoggedIn || intake.userRegistered),
      name: String(intake.name || ''),

      // File references (from uploads)
      ...(photoRef ? { photoFileRef: photoRef } : {}),
      ...(voiceRef ? { voiceFileRef: voiceRef } : {}),

      // Structured data
      faceAnalysis: intake.faceAnalysis ?? null,
      voiceMetadata: intake.voiceMetadata ?? null,
      iqResults: intake.iqResults ?? null,
      iqAnswers: intake.iqAnswers ?? null,
      astrologicalResult: intake.astrologicalResult ?? null,
      personalityResult: intake.personalityResult ?? null,
      personalityAnswers: intake.personalityAnswers ?? null,

      // Progress is optional
      progress: intake.progress ?? null,
    };

    return {
      userId,      // string (server will convert as needed)
      intakeData,  // matches IntakeDataStructure
    };
  };

  // ---- Upload helpers: call /mirror/api/storage/store and adapt server schema to FileReference ----
  type UploadedFileEntry = { success: boolean; filename: string; size: number; mimetype: string; originalname?: string };

  const toPhotoFileRef = (serverJson: any): any => {
    // serverJson: { success, tier, files: UploadedFileEntry[], timestamp }
    const files: UploadedFileEntry[] = Array.isArray(serverJson?.files) ? serverJson.files : [];
    if (!serverJson?.success || files.length === 0) {
      throw new Error('Photo upload failed: empty or invalid response');
    }
    // Prefer a generated/UUID filename if present (often last)
    const chosen = files[files.length - 1] || files[0];
    return {
      filename: chosen.filename,
      tier: String(serverJson.tier || 'tier1'),
      size: Number(chosen.size || 0),
      mimetype: String(chosen.mimetype || 'image/jpeg'),
      uploadedAt: String(serverJson.timestamp || new Date().toISOString()),
      originalname: chosen.originalname || undefined,
    };
  };

  const toVoiceFileRef = (serverJson: any, durationMs?: number): any => {
    const files: UploadedFileEntry[] = Array.isArray(serverJson?.files) ? serverJson.files : [];
    if (!serverJson?.success || files.length === 0) {
      throw new Error('Voice upload failed: empty or invalid response');
    }
    const chosen = files[files.length - 1] || files[0];
    return {
      filename: chosen.filename,
      tier: String(serverJson.tier || 'tier2'),
      size: Number(chosen.size || 0),
      mimetype: String(chosen.mimetype || 'audio/webm'),
      uploadedAt: String(serverJson.timestamp || new Date().toISOString()),
      originalname: chosen.originalname || undefined,
      duration: typeof durationMs === 'number' ? durationMs : (intake.voiceMetadata?.duration ?? 0),
      deviceInfo: intake.voiceMetadata?.deviceInfo,
    };
  };

  // Upload one file/blob and return a FileReference object
  // Upload one file/blob and return a FileReference object
  const uploadOne = async (fileOrBlob: File | Blob, type: 'photo' | 'voice'): Promise<any> => {
    const form = new FormData();
  
    if (type === 'photo' && fileOrBlob instanceof File) {
      const safeName = fileOrBlob.name.replace(/[^\w.\-]/g, '_').slice(0, 120) || 'photo';
      form.append('data', fileOrBlob, safeName);
      form.append('filename', safeName);
      form.append('tier', 'tier1');
    } else {
      form.append('data', fileOrBlob, 'voice_recording.webm');
      form.append('filename', 'voice_recording.webm');
      form.append('tier', 'tier2');
    }
  
    const userInfo = getUserInfo();
    if (!userInfo?.userId) {
      throw new Error('Cannot upload: missing userId (user not logged in or localStorage corrupted).');
    }
    form.append('userId', String(userInfo.userId));
    form.append('mode', 'file');
  
    const { ok, status, json, text } = await safeFetch(ENDPOINTS.upload, { method: 'POST', body: form });
  
    // surface status + body to the debug panel
    setSubmission((p) => ({ ...p, lastServer: { status, body: json ?? text ?? null } }));
  
    // accept HTTP ok && (success:true | success missing)
    const serverSuccess =
      !!json && typeof json === 'object' && ('success' in json ? Boolean((json as any).success) : true);
  
    if (!ok || !serverSuccess) {
      const msg =
        (json && typeof json === 'object' && ((json as any).message || (json as any).error)) ||
        `Upload failed with status ${status}`;
      throw new Error(`${type[0].toUpperCase() + type.slice(1)} upload failed: ${String(msg)}`);
    }
    if (!json || typeof json !== 'object') {
      throw new Error(`${type[0].toUpperCase() + type.slice(1)} upload failed: invalid server response`);
    }
  
    // adapt to FileReference shapes
    return type === 'photo'
      ? toPhotoFileRef(json)
      : toVoiceFileRef(json, intake.voiceMetadata?.duration);
  };
  

  const uploadFiles = async (): Promise<{ photoFileRef?: any; voiceFileRef?: any }> => {
    const uploads: { photoFileRef?: any; voiceFileRef?: any } = {};

    if (intake.photo && intake.photo instanceof File) {
      uploads.photoFileRef = await uploadOne(intake.photo, 'photo');
      setSubmission((p) => ({ ...p, progress: Math.min(50, p.progress + 25) }));
    }

    if (intake.voice && intake.voice instanceof Blob) {
      uploads.voiceFileRef = await uploadOne(intake.voice, 'voice');
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

      const fileRefs = await uploadFiles();

      // Step 3: Prepare final hybrid payload
      setSubmission((p) => ({
        ...p,
        status: 'processing',
        progress: 60,
        message: 'Preparing submission...',
      }));

      const userInfo = getUserInfo();
      if (!userInfo?.userId) {
        throw new Error('Missing userId. Please log in again.');
      }

      const payload = buildHybridPayload({
        userId: String(userInfo.userId),
        photoRef: fileRefs.photoFileRef,
        voiceRef: fileRefs.voiceFileRef,
      });

      // Step 4: Submit to intake store endpoint
      setSubmission((p) => ({
        ...p,
        progress: 80,
        message: 'Submitting to processing engine...',
      }));

      const { ok, status, json, text } = await safeFetch(ENDPOINTS.intakeStore, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });

      setSubmission((p) => ({ ...p, lastServer: json ?? text ?? null }));

      if (!ok) {
        const msg =
          (json && typeof json === 'object' && typeof (json as any).error === 'string'
            ? (json as any).error
            : `Submission failed with status ${status}`) || 'Submission failed';
        throw new Error(msg);
      }

      const submissionId =
        json && typeof json === 'object' && typeof (json as any).intakeId === 'string'
          ? (json as any).intakeId
          : undefined;

      setSubmission({
        status: 'success',
        progress: 100,
        message: 'Submission successful!',
        submissionId,
        errors: [],
        lastServer: json ?? null,
      });

      navigate('/intake/results', { state: submissionId ? { submissionId } : undefined });
    } catch (err) {
      console.error('Submission failed:', err);
      setSubmission((p) => ({
        ...p,
        status: 'error',
        progress: 0,
        message: 'Submission failed',
        errors: [err instanceof Error ? err.message : 'Unknown error occurred'],
      }));
    }
  };

  const handleRetry = () => {
    setSubmission({
      status: 'idle',
      progress: 0,
      message: '',
      errors: [],
      lastServer: undefined,
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
              <pre className="text-white/40 text-xs mt-2 p-2 bg-black/20 rounded overflow-auto max-h-64">
                {JSON.stringify(
                  {
                    endpoints: ENDPOINTS,
                    hasPhoto: !!intake.photo,
                    photoType: intake.photo?.type || null,
                    hasVoice: !!intake.voice,
                    voiceType: intake.voice?.type || null,
                    hasFaceAnalysis: !!intake.faceAnalysis,
                    hasPersonality: !!intake.personalityResult,
                    hasIQ: !!intake.iqResults,
                    hasAstrology: !!intake.astrologicalResult,
                    submissionState: submission.status,
                    lastServer: submission.lastServer ?? null,
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

