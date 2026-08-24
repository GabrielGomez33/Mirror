// components/intake/entry/EntryIntakeFlow.tsx
// ----------------------------------------------------------------------------
// The Entry ("initial") intake — the fast onboarding shown right after signup.
// name -> birth -> mini-personality -> instant result -> dashboard. It is its
// own self-contained pipeline: it reuses computeAstrology + scoreEntryPersonality
// for real output, persists a one-sitting draft to localStorage, and POSTs to
// the authenticated /mirror/api/intake/entry/submit endpoint. It deliberately
// does NOT touch Core intake state (IntakeContext) — the two pipelines are
// decoupled and meet only server-side on read.
// ----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeAstrology, type AstrologicalResult } from '../shared/astrology/computeAstrology';
import { scoreEntryPersonality, type EntryPersonalityResult } from './logic/entryScoring';
import { entryPersonalityQuestions } from './data/entryQuestionBank';
import { submitEntryIntake, EntryApiError } from './logic/entryApi';
import { loadEntryDraft, saveEntryDraft, clearEntryDraft } from './logic/entryDraft';
import {
  allAnswered,
  answeredCount as countAnswered,
  firstUnansweredIndex,
  clampDraftStep,
  isValidBirthDate,
} from './logic/entryFlowLogic';

type Answers = Record<string, { value: string; score: number }>;

const STEP = { WELCOME: 0, BIRTH: 1, PERSONALITY: 2, RESULT: 3 } as const;

export default function EntryIntakeFlow() {
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(STEP.WELCOME);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [qIndex, setQIndex] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [astro, setAstro] = useState<AstrologicalResult | null>(null);
  const [personality, setPersonality] = useState<EntryPersonalityResult | null>(null);

  // ---- Restore a one-sitting draft on mount ----
  useEffect(() => {
    const d = loadEntryDraft();
    if (!d) return;
    // Clamp a possibly-stale step into the valid pre-result range.
    setStep(clampDraftStep(d.step, STEP.WELCOME, STEP.PERSONALITY));
    if (d.name) setName(d.name);
    if (d.birthDate) setBirthDate(d.birthDate);
    if (d.birthTime) setBirthTime(d.birthTime);
    if (d.birthPlace) setBirthPlace(d.birthPlace);
    if (d.answers) setAnswers(d.answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist the draft on any meaningful change (not the result step) ----
  useEffect(() => {
    if (step === STEP.RESULT) return;
    saveEntryDraft({ step, name, birthDate, birthTime, birthPlace, answers });
  }, [step, name, birthDate, birthTime, birthPlace, answers]);

  const questions = entryPersonalityQuestions;
  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const answered = countAnswered(questionIds, answers);
  const complete = allAnswered(questionIds, answers);

  const chooseAnswer = useCallback(
    (qid: string, value: string, score: number) => {
      setAnswers((prev) => ({ ...prev, [qid]: { value, score } }));
      // Auto-advance to the next unanswered question after a brief beat.
      setQIndex((i) => Math.min(i + 1, questions.length - 1));
    },
    [questions.length]
  );

  const handleSubmit = useCallback(async () => {
    // Guard: never submit without a real birth date (send the user back to fix it).
    if (!isValidBirthDate(birthDate)) {
      setError('Please enter a valid birth date to continue.');
      setStep(STEP.BIRTH);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const astrologyResult = computeAstrology({ date: birthDate, time: birthTime || undefined });
      const personalityResult = scoreEntryPersonality(answers);

      await submitEntryIntake({
        personalityResult,
        astrologyResult,
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
        birthPlace: birthPlace.trim() || undefined,
        displayName: name.trim() || undefined,
      });

      setAstro(astrologyResult);
      setPersonality(personalityResult);
      clearEntryDraft();
      setStep(STEP.RESULT);
    } catch (e) {
      // An expired/invalid session must route to re-auth, not dead-end the user.
      if (e instanceof EntryApiError && (e.status === 401 || e.status === 403)) {
        navigate('/login', { replace: true });
        return;
      }
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, birthDate, birthTime, birthPlace, name, navigate]);

  // ------------------------------------------------------------------ render
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {step === STEP.WELCOME && (
          <section style={styles.section}>
            <h1 style={styles.h1}>Meet your Mirror</h1>
            <p style={styles.sub}>
              A few quick questions and you'll see your first reflection — your chart and your type,
              in about three minutes. You can go deeper anytime.
            </p>
            <label style={styles.label} htmlFor="entry-name">What should we call you?</label>
            <input
              id="entry-name"
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={120}
              autoFocus
            />
            <button
              style={styles.primary}
              disabled={name.trim().length === 0}
              onClick={() => setStep(STEP.BIRTH)}
            >
              Begin
            </button>
          </section>
        )}

        {step === STEP.BIRTH && (
          <section style={styles.section}>
            <h2 style={styles.h2}>Your birth</h2>
            <p style={styles.sub}>This unlocks your astrology. Time and place are optional but sharpen it.</p>
            <label style={styles.label} htmlFor="entry-date">Birth date</label>
            <input id="entry-date" type="date" style={styles.input}
              value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <label style={styles.label} htmlFor="entry-time">Birth time (optional)</label>
            <input id="entry-time" type="time" style={styles.input}
              value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            <label style={styles.label} htmlFor="entry-place">Birth place (optional)</label>
            <input id="entry-place" style={styles.input} placeholder="City, Country"
              value={birthPlace} maxLength={180} onChange={(e) => setBirthPlace(e.target.value)} />
            <div style={styles.row}>
              <button style={styles.ghost} onClick={() => setStep(STEP.WELCOME)}>Back</button>
              <button style={styles.primary} disabled={!birthDate} onClick={() => setStep(STEP.PERSONALITY)}>
                Continue
              </button>
            </div>
          </section>
        )}

        {step === STEP.PERSONALITY && (
          <section style={styles.section}>
            <div style={styles.progressWrap}>
              <div style={{ ...styles.progressBar, width: `${(answered / questions.length) * 100}%` }} />
            </div>
            <p style={styles.count}>{answered} / {questions.length}</p>

            {(() => {
              const q = questions[Math.min(qIndex, questions.length - 1)];
              const current = answers[q.id];
              return (
                <div key={q.id}>
                  <h2 style={styles.question}>{q.text}</h2>
                  <div style={styles.options}>
                    {q.options.map((opt) => {
                      const selected = current?.value === opt.value;
                      return (
                        <button
                          key={opt.value}
                          style={{ ...styles.option, ...(selected ? styles.optionSelected : {}) }}
                          onClick={() => chooseAnswer(q.id, opt.value, opt.score)}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={styles.row}>
              <button
                style={styles.ghost}
                onClick={() => (qIndex > 0 ? setQIndex(qIndex - 1) : setStep(STEP.BIRTH))}
              >
                Back
              </button>
              {complete ? (
                // All answered — the reward is one tap away, from any question.
                <button style={styles.primary} disabled={submitting} onClick={handleSubmit}>
                  {submitting ? 'Reflecting…' : 'See my Mirror'}
                </button>
              ) : qIndex < questions.length - 1 ? (
                <button style={styles.ghost} onClick={() => setQIndex(qIndex + 1)}>Next</button>
              ) : (
                // On the last card with gaps: jump back to the first unanswered
                // rather than stranding the user behind a disabled button.
                <button
                  style={styles.primary}
                  onClick={() => setQIndex(Math.max(0, firstUnansweredIndex(questionIds, answers)))}
                >
                  Answer remaining ({questions.length - answered})
                </button>
              )}
            </div>
            {error && <p style={styles.error}>{error}</p>}
          </section>
        )}

        {step === STEP.RESULT && astro && personality && (
          <section style={styles.section}>
            <h1 style={styles.h1}>Your Mirror{name ? `, ${name}` : ''}</h1>
            <div style={styles.resultGrid}>
              <ResultTile label="Sun" value={astro.western.sunSign} />
              <ResultTile label="Rising" value={astro.western.risingSign} />
              <ResultTile label="Type" value={personality.mbtiType} />
            </div>
            <p style={styles.synthesis}>{astro.synthesis.lifeDirection}</p>
            {personality.description && <p style={styles.sub}>{personality.description}</p>}
            <p style={styles.prelim}>This is a preliminary reflection — deepen it anytime from your dashboard.</p>
            <button style={styles.primary} onClick={() => navigate('/dashboard')}>Enter your Mirror</button>
          </section>
        )}
      </div>
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileValue}>{value}</div>
      <div style={styles.tileLabel}>{label}</div>
    </div>
  );
}

// Inline styles keep this flow self-contained and free of external CSS coupling.
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'radial-gradient(1200px 800px at 50% -10%, #241b3a 0%, #0b0a14 60%)' },
  card: { width: '100%', maxWidth: 520, background: 'rgba(20,18,30,0.72)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' },
  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  h1: { color: '#f5f3ff', fontSize: 28, fontWeight: 700, margin: 0 },
  h2: { color: '#f5f3ff', fontSize: 22, fontWeight: 600, margin: 0 },
  sub: { color: '#b9b3cc', fontSize: 15, lineHeight: 1.5, margin: 0 },
  label: { color: '#c9c3dc', fontSize: 13, marginTop: 6 },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 16, outline: 'none' },
  primary: { background: 'linear-gradient(135deg,#7c5cff,#a855f7)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
  ghost: { background: 'transparent', color: '#c9c3dc', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '13px 18px', fontSize: 15, cursor: 'pointer' },
  row: { display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 },
  progressWrap: { height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
  progressBar: { height: '100%', background: 'linear-gradient(90deg,#7c5cff,#a855f7)', transition: 'width 200ms ease' },
  count: { color: '#8f89a6', fontSize: 12, margin: 0 },
  question: { color: '#f5f3ff', fontSize: 20, fontWeight: 600, margin: '6px 0 4px' },
  options: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: { textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#e7e3f5', fontSize: 15, cursor: 'pointer' },
  optionSelected: { background: 'rgba(124,92,255,0.25)', borderColor: '#7c5cff' },
  error: { color: '#ff9a9a', fontSize: 14, margin: 0 },
  resultGrid: { display: 'flex', gap: 12, justifyContent: 'space-between' },
  tile: { flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '16px 8px' },
  tileValue: { color: '#fff', fontSize: 20, fontWeight: 700 },
  tileLabel: { color: '#9c96b3', fontSize: 12, marginTop: 4 },
  synthesis: { color: '#e7e3f5', fontSize: 16, lineHeight: 1.5, margin: 0 },
  prelim: { color: '#8f89a6', fontSize: 13, margin: 0 },
};
