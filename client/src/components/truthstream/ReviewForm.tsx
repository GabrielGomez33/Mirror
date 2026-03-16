// src/components/truthstream/ReviewForm.tsx
// Dynamic questionnaire-based review form — fetches questionnaire from backend
// and renders sections/questions based on their type definitions.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTruthStream } from '../../context/TruthStreamContext';
import { getTruthCard } from '../../services/truthStreamApi';
import RevieweeTruthCard from './RevieweeTruthCard';
import type { QuestionnaireSection, QuestionnaireQuestion, TruthCardData } from '../../types/truthstream';

const COLORS = {
  heading: '#3d1428',
  body: '#4a1c30',
  label: '#2d0a16',
};

// ============================================================================
// QUESTION RENDERERS
// ============================================================================

function ScaleQuestion({ question, value, onChange }: {
  question: QuestionnaireQuestion;
  value: number;
  onChange: (v: number) => void;
}) {
  const min = question.config?.min ?? 1;
  const max = question.config?.max ?? 10;
  const minLabel = question.config?.minLabel ?? String(min);
  const maxLabel = question.config?.maxLabel ?? String(max);
  const clamped = Math.max(min, Math.min(max, Math.round(value)));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: COLORS.heading }}>{question.text}</span>
        <span className="text-sm font-bold" style={{ color: COLORS.heading }}>{clamped}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={clamped}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-full"
        style={{ accentColor: '#f472b6' }}
        aria-label={question.text}
      />
      <div className="flex justify-between text-[10px]" style={{ color: COLORS.label }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function SelectWordsQuestion({ question, value, onChange }: {
  question: QuestionnaireQuestion;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const words: string[] = question.config?.words ?? [];
  const min = question.config?.min ?? 1;
  const max = question.config?.max ?? 5;

  const toggle = (word: string) => {
    if (value.includes(word)) {
      onChange(value.filter((w) => w !== word));
    } else if (value.length < max) {
      onChange([...value, word]);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
        {question.text}<span style={{ color: '#f472b6' }}> *</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => {
          const selected = value.includes(word);
          return (
            <button
              key={word}
              onClick={() => toggle(word)}
              className="px-2.5 py-1 rounded-full text-xs transition-all"
              style={{
                background: selected ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))' : 'rgba(255,255,255,0.06)',
                border: selected ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: selected ? COLORS.heading : COLORS.body,
              }}
              aria-pressed={selected}
            >
              {word}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] mt-1" style={{ color: value.length < min ? '#fca5a5' : COLORS.label }}>
        {value.length}/{max} selected (minimum {min})
      </div>
    </div>
  );
}

function FreeTextQuestion({ question, value, onChange, required }: {
  question: QuestionnaireQuestion;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
}) {
  const maxLength = question.config?.maxLength ?? 2000;
  const minLength = question.config?.minLength ?? 0;
  const charWarning = value.length > maxLength * 0.9;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1" style={{ color: COLORS.heading }}>
        {question.text}
        {(required || minLength > 0) && <span style={{ color: '#f472b6' }}> *</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={3}
        placeholder={minLength > 0 ? `Minimum ${minLength} characters...` : 'Optional...'}
        className="w-full rounded-lg p-3 text-sm resize-none"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: COLORS.body,
          outline: 'none',
        }}
        aria-required={required || minLength > 0}
      />
      <div className="text-right text-[10px] mt-0.5" style={{ color: charWarning ? '#f472b6' : COLORS.label }}>
        {value.length}/{maxLength}
      </div>
    </div>
  );
}

function CategoryExplainQuestion({ question, value, onChange }: {
  question: QuestionnaireQuestion;
  value: { categories: string[]; explanation: string };
  onChange: (v: { categories: string[]; explanation: string }) => void;
}) {
  const categories: string[] = question.config?.categories ?? [];
  const selectCount = question.config?.selectCount ?? 1;
  const requireExplanation = question.config?.requireExplanation ?? false;
  const maxExplainLen = question.config?.maxLength ?? 1000;

  const toggleCat = (cat: string) => {
    const current = value.categories;
    if (current.includes(cat)) {
      onChange({ ...value, categories: current.filter((c) => c !== cat) });
    } else if (current.length < selectCount) {
      onChange({ ...value, categories: [...current, cat] });
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
        {question.text}<span style={{ color: '#f472b6' }}> *</span>
      </label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {categories.map((cat) => {
          const selected = value.categories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className="px-3 py-1.5 rounded-full text-xs transition-all"
              style={{
                background: selected ? 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(59,130,246,0.2))' : 'rgba(255,255,255,0.06)',
                border: selected ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: COLORS.body,
              }}
              aria-pressed={selected}
            >
              {cat}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] mb-2" style={{ color: value.categories.length < selectCount ? '#fca5a5' : COLORS.label }}>
        {value.categories.length}/{selectCount} selected
      </div>
      {requireExplanation && (
        <textarea
          value={value.explanation}
          onChange={(e) => onChange({ ...value, explanation: e.target.value })}
          maxLength={maxExplainLen}
          rows={2}
          placeholder="Explain your selection..."
          className="w-full rounded-lg p-2 text-sm resize-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: COLORS.body,
            outline: 'none',
          }}
          aria-label="Explanation"
          aria-required={true}
        />
      )}
    </div>
  );
}

function MultiChoiceQuestion({ question, value, onChange }: {
  question: QuestionnaireQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const options: string[] = question.config?.options ?? [];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
        {question.text}<span style={{ color: '#f472b6' }}> *</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: value === opt ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))' : 'rgba(255,255,255,0.06)',
              border: value === opt ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
              color: COLORS.body,
            }}
            aria-pressed={value === opt}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DYNAMIC QUESTION ROUTER
// ============================================================================

function QuestionRenderer({ question, value, onChange, sectionRequired }: {
  question: QuestionnaireQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  sectionRequired: boolean;
}) {
  switch (question.type) {
    case 'scale':
      return (
        <ScaleQuestion
          question={question}
          value={typeof value === 'number' ? value : (question.config?.min ?? 5)}
          onChange={(v) => onChange(v)}
        />
      );
    case 'select_words':
      return (
        <SelectWordsQuestion
          question={question}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v)}
        />
      );
    case 'free_text':
      return (
        <FreeTextQuestion
          question={question}
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
          required={sectionRequired}
        />
      );
    case 'category_explain':
      return (
        <CategoryExplainQuestion
          question={question}
          value={
            value && typeof value === 'object' && 'categories' in (value as any)
              ? (value as { categories: string[]; explanation: string })
              : { categories: [], explanation: '' }
          }
          onChange={(v) => onChange(v)}
        />
      );
    case 'multi_choice':
      return (
        <MultiChoiceQuestion
          question={question}
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return null;
  }
}

// ============================================================================
// MAIN REVIEW FORM
// ============================================================================

export default function ReviewForm() {
  const { activeQueueItemId, queue, isSubmitting, error, submitReview, loadQuestionnaire, setView } = useTruthStream();

  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isLoadingQuestionnaire, setIsLoadingQuestionnaire] = useState(true);
  const submitGuardRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Reviewee Truth Card state
  const [truthCard, setTruthCard] = useState<TruthCardData | null>(null);
  const [truthCardCollapsed, setTruthCardCollapsed] = useState(false);
  const [truthCardLoading, setTruthCardLoading] = useState(false);
  const [truthCardError, setTruthCardError] = useState<string | null>(null);
  const truthCardAbortRef = useRef<AbortController | null>(null);

  // Find the active queue item
  const activeItem = queue?.items.find((i) => i.id === activeQueueItemId);
  const isExpired = activeItem ? new Date(activeItem.expiresAt).getTime() < Date.now() : false;

  // Fetch the reviewee's Truth Card when review starts — with abort and retry
  useEffect(() => {
    if (!activeItem) return;
    const revieweeId = activeItem.revieweeId;
    if (!revieweeId) return;

    // Cancel any in-flight fetch
    truthCardAbortRef.current?.abort();
    const controller = new AbortController();
    truthCardAbortRef.current = controller;

    let retries = 0;
    const maxRetries = 2;

    const fetchCard = () => {
      if (controller.signal.aborted) return;
      setTruthCardLoading(true);
      setTruthCardError(null);

      getTruthCard(revieweeId)
        .then((res) => {
          if (controller.signal.aborted) return;
          if (res.data) {
            setTruthCard(res.data);
          } else {
            setTruthCardError('Truth Card data unavailable');
          }
        })
        .catch((err: any) => {
          if (controller.signal.aborted) return;
          // Retry on network errors (not 403/404)
          const status = err?.status || err?.response?.status;
          if (!status && retries < maxRetries) {
            retries++;
            const delay = retries * 2000;
            setTimeout(fetchCard, delay);
            return;
          }
          if (status === 403) {
            setTruthCardError('Not authorized to view this Truth Card');
          } else if (status === 404) {
            setTruthCardError('Reviewee profile not found');
          } else {
            setTruthCardError('Could not load Truth Card');
          }
          console.error('[ReviewForm] Truth Card fetch failed:', err?.message || err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setTruthCardLoading(false);
        });
    };

    fetchCard();
    return () => { controller.abort(); };
  }, [activeItem]);

  // Load questionnaire when review starts
  useEffect(() => {
    if (!activeItem) return;
    const goalCategory = activeItem.goalCategory || 'personal_growth';
    setIsLoadingQuestionnaire(true);
    loadQuestionnaire(goalCategory).then((data) => {
      if (data?.sections) {
        setSections(data.sections);
        // Initialize responses structure
        const initial: Record<string, Record<string, unknown>> = {};
        for (const section of data.sections) {
          initial[section.id] = {};
          for (const q of section.questions) {
            if (q.type === 'scale') initial[section.id][q.id] = q.config?.min ?? 5;
            else if (q.type === 'select_words') initial[section.id][q.id] = [];
            else if (q.type === 'category_explain') initial[section.id][q.id] = { categories: [], explanation: '' };
            else initial[section.id][q.id] = '';
          }
        }
        setResponses(initial);
      }
      setIsLoadingQuestionnaire(false);
    });
    startTimeRef.current = Date.now();
  }, [activeItem, loadQuestionnaire]);

  // Check for unsaved work
  const hasUnsavedWork = Object.values(responses).some((section) =>
    Object.values(section).some((v) => {
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === 'object' && 'categories' in (v as any)) {
        const cv = v as { categories: string[]; explanation: string };
        return cv.categories.length > 0 || cv.explanation.trim().length > 0;
      }
      return false;
    })
  );

  // Warn on navigation away
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  const handleBack = useCallback(() => {
    if (hasUnsavedWork) {
      setShowExitConfirm(true);
    } else {
      setView('queue');
    }
  }, [hasUnsavedWork, setView]);

  // Update a single answer
  const updateAnswer = useCallback((sectionId: string, questionId: string, value: unknown) => {
    setResponses((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], [questionId]: value },
    }));
  }, []);

  // No active queue item
  if (!activeQueueItemId) {
    return (
      <div className="enhanced-glass-card text-center py-12">
        <p className="text-sm" style={{ color: COLORS.body }}>No active review. Go back to the queue.</p>
        <button onClick={() => setView('queue')} className="enhanced-action-button mt-4 px-6 py-2">
          <span className="font-medium" style={{ color: COLORS.label }}>Back to Queue</span>
        </button>
      </div>
    );
  }

  // Expired
  if (isExpired) {
    return (
      <div className="enhanced-glass-card text-center py-12">
        <span className="text-4xl block mb-4">⏰</span>
        <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.heading }}>Review Expired</h3>
        <p className="text-sm mb-4" style={{ color: COLORS.body }}>
          This review item has expired. Please start a new review from the queue.
        </p>
        <button onClick={() => setView('queue')} className="enhanced-action-button px-6 py-2">
          <span className="font-medium" style={{ color: COLORS.label }}>Back to Queue</span>
        </button>
      </div>
    );
  }

  // Loading questionnaire
  if (isLoadingQuestionnaire || sections.length === 0) {
    return (
      <div className="enhanced-glass-card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: COLORS.heading }} />
        <p className="text-sm" style={{ color: COLORS.body }}>Loading review form...</p>
      </div>
    );
  }

  const currentSection = sections[sectionIndex];
  const sectionResponses = responses[currentSection.id] || {};

  // Validate current section before advancing
  const validateSection = (section: QuestionnaireSection): string | null => {
    if (!section.required) return null;
    const sResp = responses[section.id] || {};

    for (const q of section.questions) {
      const answer = sResp[q.id];
      switch (q.type) {
        case 'select_words': {
          const arr = Array.isArray(answer) ? answer : [];
          const min = q.config?.min ?? 1;
          if (arr.length < min) return `Select at least ${min} words for "${q.text}"`;
          break;
        }
        case 'free_text': {
          const text = typeof answer === 'string' ? answer.trim() : '';
          const minLen = q.config?.minLength ?? 0;
          if (minLen > 0 && text.length < minLen) return `"${q.text}" requires at least ${minLen} characters`;
          break;
        }
        case 'category_explain': {
          const val = answer as { categories: string[]; explanation: string } | undefined;
          const selectCount = q.config?.selectCount ?? 1;
          if (!val || val.categories.length < selectCount) return `Select ${selectCount} option(s) for "${q.text}"`;
          if (q.config?.requireExplanation && (!val.explanation || val.explanation.trim().length < 10)) {
            return `Please explain your selection for "${q.text}"`;
          }
          break;
        }
        case 'multi_choice': {
          // Optional check — multi_choice in required sections should have an answer
          break;
        }
      }
    }
    return null;
  };

  const goNext = () => {
    setLocalError(null);
    const err = validateSection(currentSection);
    if (err) { setLocalError(err); return; }
    if (sectionIndex < sections.length - 1) {
      setSectionIndex(sectionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goPrev = () => {
    setLocalError(null);
    if (sectionIndex > 0) {
      setSectionIndex(sectionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (submitGuardRef.current || isSubmitting) return;
    submitGuardRef.current = true;
    setLocalError(null);

    // Validate all required sections
    for (const section of sections) {
      const err = validateSection(section);
      if (err) {
        setLocalError(err);
        submitGuardRef.current = false;
        return;
      }
    }

    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      await submitReview(activeQueueItemId, responses, timeSpentSeconds);
    } finally {
      submitGuardRef.current = false;
    }
  };

  const displayError = localError || error;

  return (
    <div className="space-y-4">
      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="enhanced-glass-card p-6 max-w-sm mx-4" style={{ background: 'rgba(30,30,45,0.95)' }}>
            <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.heading }}>Discard Review?</h3>
            <p className="text-sm mb-4" style={{ color: COLORS.body }}>
              You have unsaved progress. Your review will be lost if you leave now.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 enhanced-action-button py-2"
              >
                <span className="font-medium" style={{ color: COLORS.label }}>Keep Editing</span>
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); setView('queue'); }}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Nav */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="text-sm" style={{ color: COLORS.label }} aria-label="Back to queue">
              ←
            </button>
            <h2 className="text-lg font-semibold" style={{ color: COLORS.heading }}>
              {currentSection.title}
            </h2>
          </div>
          <span className="text-xs" style={{ color: COLORS.label }}>
            {sectionIndex + 1}/{sections.length}
          </span>
        </div>
        <div className="flex gap-1" role="progressbar" aria-valuenow={sectionIndex + 1} aria-valuemin={1} aria-valuemax={sections.length}>
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setLocalError(null); setSectionIndex(i); }}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                background: i <= sectionIndex
                  ? 'linear-gradient(90deg, #f472b6, #a78bfa)'
                  : 'rgba(255,255,255,0.1)',
              }}
              aria-label={`Section: ${s.title}`}
            />
          ))}
        </div>
        {!currentSection.required && (
          <p className="text-[10px] mt-1 italic" style={{ color: COLORS.label }}>This section is optional</p>
        )}
      </div>

      {/* Reviewee Truth Card — collapsible, shown on all sections */}
      {truthCardLoading && (
        <div className="enhanced-glass-card text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto mb-2" style={{ borderColor: COLORS.heading }} />
          <p className="text-xs" style={{ color: COLORS.body }}>Loading reviewee profile...</p>
        </div>
      )}
      {truthCardError && !truthCardLoading && !truthCard && (
        <div
          className="enhanced-glass-card text-center py-4"
          style={{ border: '1px solid rgba(251,191,36,0.3)' }}
          role="alert"
        >
          <p className="text-xs mb-2" style={{ color: COLORS.body }}>{truthCardError}</p>
          <button
            onClick={() => {
              if (activeItem?.revieweeId) {
                setTruthCardLoading(true);
                setTruthCardError(null);
                getTruthCard(activeItem.revieweeId)
                  .then((res) => { if (res.data) setTruthCard(res.data); })
                  .catch(() => setTruthCardError('Could not load Truth Card'))
                  .finally(() => setTruthCardLoading(false));
              }
            }}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}
          >
            Retry
          </button>
        </div>
      )}
      {truthCard && activeItem && (
        <RevieweeTruthCard
          truthCard={truthCard}
          revieweeUserId={activeItem.revieweeId}
          isCollapsed={truthCardCollapsed}
          onToggleCollapse={() => setTruthCardCollapsed((prev) => !prev)}
        />
      )}

      {/* Section Content */}
      <div className="enhanced-glass-card">
        {currentSection.questions.map((q) => (
          <QuestionRenderer
            key={q.id}
            question={q}
            value={sectionResponses[q.id]}
            onChange={(v) => updateAnswer(currentSection.id, q.id, v)}
            sectionRequired={currentSection.required}
          />
        ))}
      </div>

      {/* Error */}
      {displayError && (
        <div
          className="rounded-lg p-3 text-sm"
          role="alert"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
        >
          {displayError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {sectionIndex > 0 && (
          <button onClick={goPrev} className="flex-1 enhanced-action-button py-3">
            <span className="font-medium" style={{ color: COLORS.label }}>Previous</span>
          </button>
        )}
        {sectionIndex < sections.length - 1 ? (
          <button onClick={goNext} className="flex-1 enhanced-action-button py-3">
            <span className="font-medium" style={{ color: COLORS.label }}>Next</span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || submitGuardRef.current}
            className="flex-1 enhanced-action-button py-3"
            style={{ opacity: isSubmitting ? 0.6 : 1 }}
            aria-busy={isSubmitting}
          >
            <span className="font-medium" style={{ color: COLORS.label }}>
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
