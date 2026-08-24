// components/dashboard/IntakeProgressCard.tsx
// ----------------------------------------------------------------------------
// "Deepen your Mirror" — a collapsible dashboard card showing the five Core
// intake steps, their completion status, descriptions + benefits, and a deep
// link to complete each at the user's own pace. Reads GET /mirror/api/intake/
// progress. Styled to match the MyMirror Analysis tab: enhanced-glass-card, a
// completion ring (ScoreRing pattern), accent rows (borderLeft + tinted bg),
// and status pills. Fails safe — if progress can't be read, the card hides
// rather than breaking the dashboard.
// ----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchIntakeProgress, type IntakeProgressResponse, type StepStatus } from '../../services/intakeProgressApi';
import { INTAKE_STEP_CATALOG } from './intakeStepCatalog';
import { statusOf, completedCount, progressPercent } from './intakeProgressLogic';

const STATUS_META: Record<StepStatus, { label: string; color: string; glow: string }> = {
  completed: { label: 'Completed', color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  in_progress: { label: 'In progress', color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  not_started: { label: 'Not started', color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
};

const ACCENT = '#a78bfa';
const ACCENT_GLOW = 'rgba(167,139,250,0.35)';

/** Static completion ring — mirrors MyMirrorPanel's ScoreRing (no animation dep). */
function CompletionRing({ percent, size = 56, strokeWidth = 4 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${ACCENT_GLOW})`, transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="enhanced-glass-heading" style={{ fontSize: size * 0.28, color: ACCENT, margin: 0 }}>{Math.round(percent)}</span>
      </div>
    </div>
  );
}

export default function IntakeProgressCard() {
  const navigate = useNavigate();
  const [data, setData] = useState<IntakeProgressResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchIntakeProgress().then((d) => {
      if (!alive) return;
      setData(d);
      setLoaded(true);
      if (d && d.intakeCompleted) setOpen(false); // collapse when fully deep
    });
    return () => { alive = false; };
  }, []);

  // Hide entirely until loaded, or if progress is unavailable (fail-safe).
  if (!loaded || !data) return null;

  const steps = data.steps;
  const done = completedCount(steps);
  const total = INTAKE_STEP_CATALOG.length;
  const percent = progressPercent(steps);

  return (
    <div className="enhanced-glass-card" style={{ borderLeft: `3px solid ${ACCENT}80` }}>
      {/* Header — click to expand/collapse (the "dropdown") */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div style={{ textAlign: 'left' }}>
          <h3 className="enhanced-glass-heading" style={{ fontSize: 16, margin: 0 }}>Deepen your Mirror</h3>
          <p className="enhanced-glass-subtle" style={{ fontSize: 12, margin: '3px 0 0' }}>
            {done === total ? 'Your Mirror is fully realized ✨' : `${done} of ${total} reflections complete`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CompletionRing percent={percent} />
          <span
            aria-hidden
            style={{ color: ACCENT, fontSize: 14, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Step list */}
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {INTAKE_STEP_CATALOG.map((meta) => {
            const st = statusOf(steps, meta.key);
            const sm = STATUS_META[st];
            const isDone = st === 'completed';
            return (
              <div
                key={meta.key}
                style={{ padding: '10px 12px', borderRadius: 10, borderLeft: `3px solid ${sm.color}`, background: `${sm.color}0d` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden style={{ fontSize: 16 }}>{meta.emoji}</span>
                    <span className="enhanced-glass-text" style={{ fontSize: 14, fontWeight: 600 }}>{meta.title}</span>
                  </div>
                  <span
                    className="capitalize"
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: `${sm.color}20`, color: sm.color, boxShadow: `0 0 4px ${sm.glow}`, whiteSpace: 'nowrap' }}
                  >
                    {sm.label}
                  </span>
                </div>
                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '6px 0 2px' }}>{meta.description}</p>
                <p className="enhanced-glass-subtle" style={{ fontSize: 11, margin: 0 }}>{meta.benefit}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>~{meta.estMinutes} min</span>
                  {isDone ? (
                    <span style={{ fontSize: 11, color: STATUS_META.completed.color, fontWeight: 600 }}>✓ Done</span>
                  ) : (
                    <button
                      type="button"
                      className="enhanced-action-button"
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => navigate(meta.route)}
                    >
                      {st === 'in_progress' ? 'Continue →' : 'Start →'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
