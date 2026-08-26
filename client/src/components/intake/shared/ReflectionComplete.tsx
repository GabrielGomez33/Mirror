// components/intake/shared/ReflectionComplete.tsx
// ----------------------------------------------------------------------------
// Shared "one reflection = save → confirm → home" completion for every Core
// intake step. In the two-tier model each Core step is a STANDALONE reflection
// launched from the "Deepen your Mirror" card — there is no linear next/prev.
//
// This module gives every step ONE reliable, observable completion path:
//   1. persist the single section to the server (awaited, result CHECKED —
//      no more silent .finally() that swallowed failures),
//   2. show an explicit "saved & stored" confirmation (or a retryable error),
//   3. route the user back to their Mirror, where the card shows it completed.
//
// It also exports the always-present "Return to Mirror" button steps render so
// a user is never trapped in a step.
// ----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCoreSection } from '../../../services/coreIntakeSave';

/** Where a finished reflection (and the Return-to-Mirror button) lands. */
export const MIRROR_HOME = '/mymirror';

export type ReflectionPhase = 'idle' | 'saving' | 'saved' | 'error';

export interface ReflectionSave {
  phase: ReflectionPhase;
  error: string | null;
  /** Persist ONE section (e.g. { iqResults }) and drive the confirmation. */
  save: (section: Record<string, unknown>) => Promise<void>;
  /** Manual reset so a step can offer "try again" after an error. */
  reset: () => void;
}

/**
 * Reflection-completion state machine. `save` awaits the real POST and only
 * reports 'saved' when the server accepted it (res.ok) — a failure becomes
 * 'error' and is surfaced, never swallowed.
 */
export function useReflectionSave(): ReflectionSave {
  const [phase, setPhase] = useState<ReflectionPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  // Guard against a double-submit (e.g. rapid taps) creating two saves.
  const inFlight = useRef(false);

  const save = useCallback(async (section: Record<string, unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase('saving');
    setError(null);
    try {
      const ok = await saveCoreSection(section);
      if (ok) {
        setPhase('saved');
      } else {
        setPhase('error');
        setError("We couldn't save your reflection. Please check your connection and try again.");
      }
    } catch {
      setPhase('error');
      setError('Something went wrong saving your reflection. Please try again.');
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, save, reset };
}

/**
 * Full-card confirmation shown while/after a reflection is saved. On success it
 * auto-returns to the Mirror after a short beat AND offers an immediate button;
 * on error it offers Retry + a way back so the user is never stranded.
 */
export function ReflectionComplete({
  label,
  phase,
  error,
  onRetry,
}: {
  label: string;
  phase: ReflectionPhase;
  error: string | null;
  onRetry?: () => void;
}) {
  const navigate = useNavigate();

  // Auto-return home shortly after a confirmed save.
  useEffect(() => {
    if (phase !== 'saved') return;
    const t = setTimeout(() => navigate(MIRROR_HOME, { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {phase === 'saving' && (
          <>
            <div style={styles.spinner} aria-hidden />
            <h2 style={styles.h2}>Saving your {label} reflection…</h2>
            <p style={styles.sub}>Storing it securely to your Mirror.</p>
          </>
        )}

        {phase === 'saved' && (
          <>
            <div style={styles.check} aria-hidden>✓</div>
            <h2 style={styles.h2}>Your {label} reflection is complete</h2>
            <p style={styles.sub}>Saved and stored to your Mirror. Taking you back…</p>
            <button style={styles.primary} onClick={() => navigate(MIRROR_HOME, { replace: true })}>
              Return to your Mirror
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div style={styles.cross} aria-hidden>!</div>
            <h2 style={styles.h2}>We couldn't save that</h2>
            <p style={styles.sub}>{error || 'Please try again.'}</p>
            <div style={styles.row}>
              {onRetry && <button style={styles.primary} onClick={onRetry}>Try again</button>}
              <button style={styles.ghost} onClick={() => navigate(MIRROR_HOME, { replace: true })}>
                Back to your Mirror
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Always-present escape hatch on every step — a user can return to their Mirror
 * at any point without finishing (nothing is saved until they complete the
 * reflection). Fixed top-left so it never collides with step content.
 */
export function ReturnToMirrorButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(MIRROR_HOME)}
      style={styles.homeBtn}
      aria-label="Return to your Mirror"
    >
      ← Mirror
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'radial-gradient(1200px 800px at 50% -10%, #241b3a 0%, #0b0a14 60%)' },
  card: { width: '100%', maxWidth: 460, textAlign: 'center', background: 'rgba(20,18,30,0.72)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  h2: { color: '#f5f3ff', fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: '#b9b3cc', fontSize: 15, lineHeight: 1.5, margin: 0 },
  check: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,222,128,0.16)', border: '2px solid #4ade80', color: '#8ef0b0', fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cross: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(248,113,113,0.14)', border: '2px solid #f87171', color: '#fca5a5', fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite' },
  primary: { background: 'linear-gradient(135deg,#7c5cff,#a855f7)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
  ghost: { background: 'transparent', color: '#c9c3dc', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '12px 20px', fontSize: 15, cursor: 'pointer', marginTop: 6 },
  row: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  homeBtn: { position: 'fixed', top: 16, left: 16, zIndex: 50, background: 'rgba(20,18,30,0.6)', color: '#e7e3f5', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)' },
};
