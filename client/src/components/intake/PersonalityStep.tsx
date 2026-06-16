// src/components/intake/PersonalityStep.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

import {
  scientificQuestions,
  getAttentionExpectedValue,
  PERSONALITY_DISCLAIMER,
} from './personality/scientificQuestionBank';
import type { Question } from './personality/scientificQuestionBank';

import { mbtiQuestions, MBTI_DISCLAIMER } from './personality/mbtiQuestionBank';
import type { MBTIQuestion } from './personality/mbtiQuestionBank';

import { DataQualityMonitor } from './personality/dataQualityMonitor';
import { IntegratedPersonalityScorer } from './personality/integratedScoring';
import type { ComprehensivePersonalityResult } from './personality/integratedScoring';

import { PersonalityResultAdapter } from './personality/personalityResultAdapter';
import type { AnswerMap } from './personality/types';

// Combined question shape used by the renderer.
type AllQuestions =
  | Question
  | MBTIQuestion
  | {
      id: string;
      text: string;
      category: 'attention' | 'reflection';
      dimension: string;
      attentionExpectedValue?: string;
      options: { text: string; value: string; score: number }[];
    };

const REFLECTION_MIN_LENGTH = 20;
const REFLECTION_MAX_LENGTH = 1000;
// v3: stores the question order + index + answers (v2 only stored answers, which
// could not pin the user back to the exact question after a reshuffle).
const PROGRESS_STORAGE_KEY = 'mirror:intake:personality:progress:v3';
const ADVANCE_DELAY_MS = 350;

// Stable lookup of every question by id, used to rebuild a saved order on resume.
const ALL_QUESTIONS: AllQuestions[] = [...scientificQuestions, ...mbtiQuestions];
const ALL_QUESTION_BY_ID = new Map<string, AllQuestions>(
  ALL_QUESTIONS.map((q) => [q.id, q])
);

/** Build a fresh, shuffled order: Big Five ⇄ MBTI interleave, attention checks
 *  at ~1/4 and ~3/4, reflection last. */
function buildFreshQuestionOrder(): AllQuestions[] {
  const big5 = scientificQuestions.filter((q) => q.category === 'big5');
  const attention = scientificQuestions.filter((q) => q.category === 'attention');
  const reflection = scientificQuestions.filter((q) => q.category === 'reflection');

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffledBig5 = shuffle(big5);
  const shuffledMBTI = shuffle([...mbtiQuestions]);

  const interleaved: AllQuestions[] = [];
  const maxLen = Math.max(shuffledBig5.length, shuffledMBTI.length);
  for (let i = 0; i < maxLen; i++) {
    if (shuffledBig5[i]) interleaved.push(shuffledBig5[i]);
    if (shuffledMBTI[i]) interleaved.push(shuffledMBTI[i]);
  }

  if (interleaved.length > 0 && attention[0]) {
    interleaved.splice(Math.max(1, Math.floor(interleaved.length / 4)), 0, attention[0]);
  }
  if (interleaved.length > 0 && attention[1]) {
    interleaved.splice(
      Math.min(interleaved.length, Math.floor((interleaved.length * 3) / 4) + 1),
      0,
      attention[1]
    );
  }

  return [...interleaved, ...reflection];
}

interface SavedProgress {
  orderIds: string[];
  index: number;
  answers: AnswerMap;
}

/** Read saved in-progress state. Returns null if absent/empty/corrupt. */
function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PROGRESS_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const answers =
      parsed.answers && typeof parsed.answers === 'object' ? (parsed.answers as AnswerMap) : null;
    if (!answers || Object.keys(answers).length === 0) return null;
    const orderIds = Array.isArray(parsed.orderIds)
      ? (parsed.orderIds.filter((x: unknown) => typeof x === 'string') as string[])
      : [];
    const index = Number.isInteger(parsed.index) ? (parsed.index as number) : 0;
    return { orderIds, index, answers };
  } catch {
    try {
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

interface InitialState {
  questions: AllQuestions[];
  answers: AnswerMap;
  index: number;
  resumed: boolean;
}

/** Compute the starting questions/answers/index ONCE per mount, honoring saved
 *  progress so a refresh resumes on the exact question the user left off on. */
function computeInitialState(): InitialState {
  const saved = loadSavedProgress();
  if (saved) {
    // Preferred path: rebuild the exact saved order so the same question sits at
    // the same index, and resume at the saved index (the question they were on).
    if (saved.orderIds.length === ALL_QUESTIONS.length) {
      const rebuilt = saved.orderIds
        .map((id) => ALL_QUESTION_BY_ID.get(id))
        .filter((q): q is AllQuestions => Boolean(q));
      if (rebuilt.length === ALL_QUESTIONS.length) {
        const index = Math.min(Math.max(saved.index, 0), rebuilt.length - 1);
        return { questions: rebuilt, answers: saved.answers, index, resumed: true };
      }
    }
    // Fallback (e.g. question bank changed): fresh order, resume at the first
    // still-unanswered question rather than restarting from the top.
    const fresh = buildFreshQuestionOrder();
    const firstUnanswered = fresh.findIndex((q) =>
      q.category === 'reflection' ? !saved.answers[q.id]?.text : !saved.answers[q.id]
    );
    return {
      questions: fresh,
      answers: saved.answers,
      index: firstUnanswered === -1 ? fresh.length - 1 : firstUnanswered,
      resumed: true,
    };
  }
  return { questions: buildFreshQuestionOrder(), answers: {}, index: 0, resumed: false };
}

const PersonalityStep = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete } = useIntake();

  // Resolve saved progress (if any) exactly once. Resuming the exact question
  // order + index here — synchronously, before the first render — is what lets a
  // refresh land on the last question instead of restarting at question 1.
  const [initial] = useState<InitialState>(computeInitialState);

  const [questions] = useState<AllQuestions[]>(initial.questions);

  // ── State ──────────────────────────────────────────────────────────────
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(initial.index);
  const [answers, setAnswers] = useState<AnswerMap>(initial.answers);
  const [comprehensiveResult, setComprehensiveResult] =
    useState<ComprehensivePersonalityResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(!initial.resumed);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [scoringError, setScoringError] = useState<string | null>(null);

  const [qualityMonitor] = useState(() => new DataQualityMonitor());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length
    ? ((currentQuestionIndex + 1) / questions.length) * 100
    : 0;

  const isReflection = currentQuestion?.category === 'reflection';
  const reflectionReady = textInput.trim().length >= REFLECTION_MIN_LENGTH;
  const currentAnswered = currentQuestion
    ? isReflection
      ? !!answers[currentQuestion.id]?.text
      : !!answers[currentQuestion.id]
    : false;

  // Clear any pending auto-advance timer on unmount.
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Re-hydrate the quality monitor from restored answers, once. Navigation was
  // already positioned by computeInitialState; here we only replay answer
  // content (timing stays session-local so speed flags remain honest).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (!initial.resumed) return;
    for (const [id, ans] of Object.entries(initial.answers)) {
      if (!ans) continue;
      const q = ALL_QUESTION_BY_ID.get(id);
      if (q?.category === 'attention') {
        const expected = getAttentionExpectedValue(id);
        if (expected && ans.value) qualityMonitor.validateAttentionCheck(id, expected, ans.value);
      }
      qualityMonitor.restoreResponse(id, ans);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist order + current index + answers as the user progresses, so a refresh
  // resumes on the exact question. Skipped once results are shown.
  useEffect(() => {
    if (showResult) return;
    if (Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          orderIds: questions.map((q) => q.id),
          index: currentQuestionIndex,
          answers,
          ts: Date.now(),
        })
      );
    } catch (err) {
      console.warn('[PersonalityStep] Failed to persist progress:', err);
    }
  }, [answers, currentQuestionIndex, questions, showResult]);

  // Reset the per-question timer and restore any prior selection when the
  // current question changes.
  useEffect(() => {
    if (!currentQuestion || showDisclaimer) return;
    setQuestionStartTime(Date.now());
    if (currentQuestion.category === 'reflection') {
      setTextInput(answers[currentQuestion.id]?.text ?? '');
      setSelectedOption(null);
    } else {
      setSelectedOption(answers[currentQuestion.id]?.value ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, showDisclaimer]);

  const clearProgressStorage = useCallback(() => {
    try {
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // ── Scoring (crash-proof) ──────────────────────────────────────────────
  const calculateResults = useCallback(() => {
    try {
      const qualityMetrics = qualityMonitor.generateQualityMetrics(questions);
      const big5Questions = questions.filter((q) => q.category === 'big5') as Question[];
      const mbtiQs = questions.filter((q) => q.category === 'mbti') as MBTIQuestion[];

      const result = IntegratedPersonalityScorer.calculateComprehensiveResult(
        answers,
        big5Questions,
        mbtiQs,
        qualityMetrics
      );

      setComprehensiveResult(result);
      setScoringError(null);

      const adaptedResult = PersonalityResultAdapter.adaptToExistingFormat(result);
      const detailedSummary = PersonalityResultAdapter.createDetailedSummary(result);

      updateIntake({
        personalityResult: adaptedResult,
        personalityAnswers: answers,
        personalityDetails: detailedSummary,
      });
    } catch (err) {
      console.error('[PersonalityStep] Scoring failed:', err);
      setScoringError(
        'We hit a snag while calculating your results. Your answers are safe — please try again.'
      );
    }
  }, [answers, questions, qualityMonitor, updateIntake]);

  useEffect(() => {
    if (showResult && !comprehensiveResult && !scoringError) {
      calculateResults();
    }
  }, [showResult, comprehensiveResult, scoringError, calculateResults]);

  // ── Answer handling ────────────────────────────────────────────────────
  const commitOptionAnswer = useCallback(
    (option: { text: string; value: string; score: number }) => {
      if (!currentQuestion) return;

      if (currentQuestion.category === 'attention') {
        const expected = getAttentionExpectedValue(currentQuestion.id);
        if (expected) {
          qualityMonitor.validateAttentionCheck(currentQuestion.id, expected, option.value);
        }
      }
      qualityMonitor.recordResponse(currentQuestion.id, option, questionStartTime);
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
      setSelectedOption(option.value);
    },
    [currentQuestion, qualityMonitor, questionStartTime]
  );

  const goToNext = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      setShowResult(true);
    }
  }, [currentQuestionIndex, questions.length]);

  const goToPrevious = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1);
    }
  }, [currentQuestionIndex]);

  const handleOptionSelect = (option: { text: string; value: string; score: number }) => {
    commitOptionAnswer(option);
    // Snappy auto-advance for forward progress; Back/Next still available.
    advanceTimer.current = setTimeout(() => goToNext(), ADVANCE_DELAY_MS);
  };

  const handleReflectionComplete = () => {
    if (!currentQuestion || !reflectionReady) return;
    const answer = { text: textInput.trim(), value: 'reflection', score: 0 };
    qualityMonitor.recordResponse(currentQuestion.id, answer, questionStartTime);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    setShowResult(true);
  };

  // Keyboard navigation within the radio group.
  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    const count = currentQuestion && 'options' in currentQuestion ? currentQuestion.options.length : 0;
    if (count === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      optionRefs.current[(index + 1) % count]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      optionRefs.current[(index - 1 + count) % count]?.focus();
    }
  };

  const handleNext = () => {
    markStepComplete('PersonalityStep', { completed: true });
    clearProgressStorage();
    try {
      localStorage.setItem('mirror:intake:lastStep', 'personality');
    } catch {
      /* noop */
    }
    navigate('/intake/submit');
  };

  const restartAssessment = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setComprehensiveResult(null);
    setShowResult(false);
    setSelectedOption(null);
    setTextInput('');
    setScoringError(null);
    setShowDisclaimer(true);
    qualityMonitor.reset();
    clearProgressStorage();
  };

  const retryScoring = () => {
    setScoringError(null);
    setComprehensiveResult(null);
  };

  const getQuestionTypeInfo = (question: AllQuestions) => {
    if (question.category === 'attention') return { label: 'Quality Check', color: 'bg-yellow-500/20' };
    if (question.category === 'reflection') return { label: 'Personal Reflection', color: 'bg-purple-500/20' };
    if (question.category === 'big5') {
      const dim = (question as Question).dimension;
      return { label: `Big Five: ${dim ? dim.charAt(0).toUpperCase() + dim.slice(1) : ''}`, color: 'bg-blue-500/20' };
    }
    if (question.category === 'mbti') return { label: `MBTI: ${(question as MBTIQuestion).dimension}`, color: 'bg-indigo-500/20' };
    return { label: 'Assessment', color: 'bg-gray-500/20' };
  };

  // ── Disclaimer screen ──────────────────────────────────────────────────
  if (showDisclaimer) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
        />
        <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
          <div className="w-full max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <GlassCard enhanced gradient className="text-center space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-4 md:m-[40px]">
                <div className="space-y-4 items-center justify-center flex flex-col">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white text-shadow-soft">Comprehensive Personality Assessment</h2>
                  <p className="text-white/80">Scientific Big Five analysis combined with MBTI type exploration</p>
                </div>

                <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                  <h3 className="text-white font-semibold mb-4">What You'll Discover</h3>
                  <div className="text-white/80 text-left space-y-3 text-sm">
                    <p><strong>Big Five Traits:</strong> Research-backed dimensions scored against published reference norms</p>
                    <p><strong>MBTI Type:</strong> A popular framework for self-understanding, with balanced preferences flagged honestly</p>
                    <p><strong>Integrated Insights:</strong> How both approaches complement each other</p>
                    <p><strong>Quality &amp; Validity:</strong> Reliability estimates, confidence intervals, and response-validity checks</p>
                    <p><strong>Total Time:</strong> 12–18 minutes ({questions.length} questions). Your progress is saved automatically.</p>
                  </div>
                </div>

                <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                  <h3 className="text-white font-semibold mb-4">Scientific Context &amp; Important Disclaimers</h3>
                  <div className="text-white/70 text-left space-y-4 text-xs">
                    <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                      <p className="font-medium text-blue-200 mb-2">Big Five Model:</p>
                      <div className="whitespace-pre-line">{PERSONALITY_DISCLAIMER}</div>
                    </div>
                    <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <p className="font-medium text-purple-200 mb-2">MBTI Framework:</p>
                      <div className="whitespace-pre-line">{MBTI_DISCLAIMER}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <GlassButton
                    onClick={() => setShowDisclaimer(false)}
                    className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30"
                  >
                    <span className="flex items-center space-x-2">
                      <span>Begin Comprehensive Assessment</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main screen ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BasicScene />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="w-full max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]">
              {showResult ? (
                scoringError ? (
                  <ScoringErrorCard message={scoringError} onRetry={retryScoring} onRestart={restartAssessment} />
                ) : comprehensiveResult ? (
                  <ComprehensiveResultsDisplay
                    result={comprehensiveResult}
                    onRestart={restartAssessment}
                    onNext={handleNext}
                  />
                ) : (
                  <div className="py-16 text-white/80">Calculating your results…</div>
                )
              ) : currentQuestion ? (
                <>
                  <div className="space-y-4 items-center justify-center flex flex-col">
                    <h2 className="text-3xl font-bold text-white text-shadow-soft">Personality Assessment</h2>
                    <p className="text-white/80">Respond thoughtfully and honestly to each statement</p>
                  </div>

                  <div className="glass-card-enhanced p-4 rounded-xl mx-auto max-w-xl">
                    <div className="flex justify-between text-sm text-white/70 mb-2">
                      <span>Progress</span>
                      <span>{currentQuestionIndex + 1} of {questions.length}</span>
                    </div>
                    <GlassProgress value={progress} max={100} />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQuestion.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="glass-card-enhanced p-4 md:p-6 rounded-xl mx-auto max-w-xl">
                        <div className="mb-4">
                          <span className={`text-xs text-white/50 px-3 py-1 rounded-full ${getQuestionTypeInfo(currentQuestion).color}`}>
                            {getQuestionTypeInfo(currentQuestion).label}
                          </span>
                        </div>
                        <h3 className="text-lg md:text-xl text-white font-medium mb-4 text-center">{currentQuestion.text}</h3>

                        {isReflection && (
                          <div className="mt-4">
                            <textarea
                              value={textInput}
                              onChange={(e) => setTextInput(e.target.value)}
                              placeholder={`Share your authentic self here… (minimum ${REFLECTION_MIN_LENGTH} characters for meaningful analysis)`}
                              className="w-full p-4 rounded-xl bg-white/10 text-white placeholder-white/50 border border-white/20 focus:border-white/40 focus:outline-none resize-none"
                              rows={6}
                              maxLength={REFLECTION_MAX_LENGTH}
                              aria-label="Personal reflection"
                            />
                            <div className="flex justify-between text-xs text-white/50 mt-2">
                              <span>
                                {reflectionReady
                                  ? '✓ Ready to submit'
                                  : `Need ${REFLECTION_MIN_LENGTH - textInput.trim().length} more characters`}
                              </span>
                              <span>{textInput.length}/{REFLECTION_MAX_LENGTH}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isReflection && 'options' in currentQuestion ? (
                        <div
                          role="radiogroup"
                          aria-label={currentQuestion.text}
                          className="space-y-2 mx-auto max-w-xl"
                        >
                          {currentQuestion.options.map((option, index) => {
                            const checked = selectedOption === option.value;
                            return (
                              <motion.button
                                key={option.value}
                                ref={(el) => { optionRefs.current[index] = el; }}
                                role="radio"
                                aria-checked={checked}
                                tabIndex={checked || (selectedOption === null && index === 0) ? 0 : -1}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                                onClick={() => handleOptionSelect(option)}
                                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                                className={[
                                  'w-full py-2.5 px-4 rounded-xl transition-all duration-300',
                                  'flex items-center justify-center text-center',
                                  'glass-card hover:scale-[1.02] hover:bg-black/20',
                                  'focus:outline-none focus:ring-2 focus:ring-indigo-300/60',
                                  checked ? 'glass-card-enhanced bg-gradient-to-r from-indigo-400/30 to-purple-400/30 scale-105' : '',
                                ].join(' ')}
                              >
                                <span className="text-white font-semibold text-base md:text-lg">{option.text}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      ) : isReflection ? (
                        <div className="mx-auto max-w-xl">
                          <GlassButton
                            onClick={handleReflectionComplete}
                            disabled={!reflectionReady}
                            className="w-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 disabled:opacity-50"
                          >
                            Complete Assessment
                          </GlassButton>
                        </div>
                      ) : null}

                      {/* Navigation: Back is always available; Next appears once answered. */}
                      <div className="flex items-center justify-between gap-3 mx-auto max-w-xl pt-1">
                        <GlassButton
                          onClick={goToPrevious}
                          disabled={currentQuestionIndex === 0}
                          className="bg-white/10 hover:bg-white/20 disabled:opacity-40"
                        >
                          <span className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back</span>
                          </span>
                        </GlassButton>

                        {!isReflection && currentAnswered && (
                          <GlassButton
                            onClick={goToNext}
                            className="bg-white/10 hover:bg-white/20"
                          >
                            <span className="flex items-center space-x-2">
                              <span>{currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </GlassButton>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </>
              ) : (
                <div className="py-16 text-white/80">Preparing your assessment…</div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// ── Error card ─────────────────────────────────────────────────────────────
const ScoringErrorCard: React.FC<{ message: string; onRetry: () => void; onRestart: () => void }> = ({
  message,
  onRetry,
  onRestart,
}) => (
  <div className="space-y-6 py-6">
    <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-rose-400 to-red-400 flex items-center justify-center">
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
    <p className="text-white/80 mx-auto max-w-md">{message}</p>
    <div className="flex gap-3 justify-center pt-2">
      <GlassButton onClick={onRetry} className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30">
        Try Again
      </GlassButton>
      <GlassButton onClick={onRestart} className="bg-white/10 hover:bg-white/20">
        Restart Assessment
      </GlassButton>
    </div>
  </div>
);

// ── Results display ──────────────────────────────────────────────────────
const ComprehensiveResultsDisplay: React.FC<{
  result: ComprehensivePersonalityResult;
  onRestart: () => void;
  onNext: () => void;
}> = ({ result, onRestart, onNext }) => {
  const getTraitColor = (trait: string) => {
    const colors: Record<string, string> = {
      openness: 'from-blue-400 to-indigo-400',
      conscientiousness: 'from-green-400 to-emerald-400',
      extraversion: 'from-yellow-400 to-orange-400',
      agreeableness: 'from-pink-400 to-rose-400',
      neuroticism: 'from-purple-400 to-violet-400',
    };
    return colors[trait] || 'from-gray-400 to-gray-500';
  };

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'excellent': return 'text-green-300';
      case 'good': return 'text-blue-300';
      case 'adequate': return 'text-yellow-300';
      default: return 'text-red-300';
    }
  };

  const validityColor: Record<string, string> = {
    valid: 'text-green-300',
    acceptable: 'text-blue-300',
    questionable: 'text-yellow-300',
    invalid: 'text-red-300',
  };

  const showValidityBanner =
    result.validity?.overallValidity === 'questionable' ||
    result.validity?.overallValidity === 'invalid';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="space-y-6">
        <div className="space-y-4 items-center justify-center flex flex-col">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white text-shadow-soft">Your Complete Personality Profile</h2>
          <p className="text-white/80">Comprehensive analysis combining scientific research and popular frameworks</p>
        </div>

        {/* Validity banner (only when results warrant caution) */}
        {showValidityBanner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card-enhanced p-4 rounded-xl mx-auto max-w-xl bg-yellow-500/10 border border-yellow-500/30"
          >
            <p className="text-yellow-200 text-sm font-medium mb-1">A note on these results</p>
            <ul className="text-yellow-100/80 text-xs space-y-1 text-left">
              {(result.validity?.warnings ?? []).slice(0, 2).map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Quality & validity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Assessment Quality</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getReliabilityColor(result.big5.profileReliability)}`}>
              {result.big5.profileReliability.toUpperCase()}
            </span>
          </div>
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex justify-between"><span>Data Quality:</span><span className="text-white font-medium">{result.dataQuality.overallQuality}</span></div>
            <div className="flex justify-between"><span>Response Validity:</span><span className={`font-medium ${validityColor[result.validity?.overallValidity] || 'text-white'}`}>{result.validity?.overallValidity ?? 'n/a'}</span></div>
            <div className="flex justify-between"><span>Big Five Reliability:</span><span className="text-white font-medium">{Math.round(result.big5.overallReliability * 100)}%</span></div>
            <div className="flex justify-between"><span>Response Consistency:</span><span className="text-white font-medium">{Math.round(result.big5.overallConsistency * 100)}%</span></div>
            <div className="flex justify-between"><span>MBTI Clarity:</span><span className="text-white font-medium">{result.mbti.overallClarity}%</span></div>
          </div>
        </motion.div>

        {/* Integrated summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
          <h3 className="text-white font-semibold text-lg mb-4">Integrated Profile Summary</h3>
          <p className="text-white/90 text-base leading-relaxed mb-4">{result.integration.combinedSummary}</p>
          {result.integration.keyPatterns.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white/80 font-medium text-sm">Key Patterns:</h4>
              <ul className="space-y-1 text-white/70 text-sm">
                {result.integration.keyPatterns.map((pattern, index) => (<li key={index}>• {pattern}</li>))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* MBTI */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
          <h3 className="text-white font-semibold text-lg mb-4">MBTI Type Profile</h3>
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-white mb-2 tracking-wider">{result.mbti.type}</div>
            <p className="text-white/80 text-sm">{result.mbti.typeDescription}</p>
            {result.mbti.hasBorderlinePreferences && result.mbti.alternateTypes.length > 0 && (
              <p className="text-white/60 text-xs mt-2 italic">
                Some preferences are nearly balanced — you may also relate to {result.mbti.alternateTypes.join(', ')}.
              </p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {Object.entries(result.mbti.preferences).map(([dimension, pref]) => (
              <div key={dimension} className="flex justify-between items-center">
                <span className="text-white/70">{dimension}:</span>
                <div className="text-right">
                  <span className="text-white font-medium">
                    {pref.borderline
                      ? `${pref.preferredType}/${pref.alternateType} (balanced)`
                      : `${pref.preferredType} (${pref.strength})`}
                  </span>
                  <div className="text-xs text-white/50">{Math.round(pref.clarity)}% clarity</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/60 text-xs mt-4 italic">{result.mbti.reliabilityNote}</p>
        </motion.div>

        {/* Big Five */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
          <h3 className="text-white font-semibold text-lg mb-6">Big Five Personality Traits</h3>
          <div className="space-y-6">
            {Object.entries(result.big5.traits).map(([trait, score], index) => (
              <div key={trait} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-white font-medium">{trait.charAt(0).toUpperCase() + trait.slice(1)}</h4>
                  <div className="text-right">
                    <div className="text-white font-semibold">{score.percentileRank}<span className="text-xs text-white/60 ml-1">percentile</span></div>
                    <div className="text-xs text-white/50">{score.confidenceInterval.lower}–{score.confidenceInterval.upper}% CI</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${score.percentileRank}%` }} transition={{ duration: 1, delay: 0.5 + index * 0.1 }} className={`h-full bg-gradient-to-r ${getTraitColor(trait)} rounded-full`} />
                  </div>
                </div>
                <p className="text-white/80 text-sm">
                  <span className="font-medium text-white">{score.interpretation.level.charAt(0).toUpperCase() + score.interpretation.level.slice(1)}:</span>{' '}
                  {score.interpretation.description.substring(0, 120)}{score.interpretation.description.length > 120 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Personal reflection */}
        {result.personalReflection && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
            <h3 className="text-white font-semibold text-lg mb-4">Your Personal Reflection</h3>
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <p className="text-white/90 text-sm italic leading-relaxed">"{result.personalReflection.text.substring(0, 200)}{result.personalReflection.text.length > 200 ? '…' : ''}"</p>
            </div>
            {result.personalReflection.insights.length > 0 && (
              <div>
                <h4 className="text-white/80 font-medium text-sm mb-2">Reflection Insights:</h4>
                <ul className="space-y-1 text-white/70 text-sm">
                  {result.personalReflection.insights.map((insight, index) => (<li key={index}>• {insight}</li>))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Recommendations */}
        {result.integration.unifiedRecommendations.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
            <h3 className="text-white font-semibold text-lg mb-4">Personalized Recommendations</h3>
            <ul className="space-y-2 text-white/80 text-sm">
              {result.integration.unifiedRecommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="flex items-start space-x-2"><span className="text-indigo-300 mt-1">•</span><span>{rec}</span></li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Disclaimers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
          <h3 className="text-yellow-300 font-semibold text-lg mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Important Context
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <p className="text-blue-200 text-xs font-medium mb-1">Big Five Assessment:</p>
              <ul className="space-y-1 text-blue-100/80 text-xs">
                {result.disclaimers.big5.slice(0, 2).map((d, i) => (<li key={i}>• {d}</li>))}
              </ul>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <p className="text-purple-200 text-xs font-medium mb-1">MBTI Framework:</p>
              <ul className="space-y-1 text-purple-100/80 text-xs">
                {result.disclaimers.mbti.slice(0, 2).map((d, i) => (<li key={i}>• {d}</li>))}
              </ul>
            </div>
            <ul className="space-y-1 text-white/60 text-xs">
              {result.disclaimers.combined.slice(0, 2).map((d, i) => (<li key={i}>• {d}</li>))}
            </ul>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex gap-3 justify-center pt-4">
          <GlassButton onClick={onRestart} className="bg-white/10 hover:bg-white/20">Retake Assessment</GlassButton>
          <GlassButton onClick={onNext} className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30">
            <span className="flex items-center space-x-2">
              <span>Continue to Complete Profile</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </GlassButton>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PersonalityStep;