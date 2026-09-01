// src/components/intake/IQStep.tsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useIntake } from '../../context/IntakeContext';
import { useReflectionSave, ReflectionComplete, ReturnToMirrorButton } from './shared/ReflectionComplete';
import { useCoreDraftServerSync } from '../../hooks/useCoreDraftServerSync';
import { localDraftKey } from '../../services/coreDraftLocal';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Use Vite base so assets work in dev and under a sub-path (e.g., /mirror/) in prod
const IQ_ASSET = (file: string) => `${import.meta.env.BASE_URL}/images/iq/${file}`;

// Version tag for the question bank below. The server keeps a matching answer
// key under this string (mirror-server: controllers/iqNormsController.ts) and
// uses it to score attempts and bucket self-norm samples. If you change the
// questions or answers, bump this on BOTH sides so norms don't mix item sets.
const ITEM_SET_VERSION = 'mirror-iq-v1';

// Server endpoint that returns where a raw score falls in the distribution of
// other Mirror users' scores (self-norm). Same relative base as SubmitStep.
const NORMS_ENDPOINT = '/mirror/api/intake/iq/norms';

interface NormResponse {
  success: boolean;
  ready: boolean;       // false until enough users have completed the test
  n: number;            // verified samples in the norm
  threshold: number;    // minimum n before a percentile is reported
  percentile?: number;  // this score's percentile among Mirror users
  band?: string;        // coarse label, e.g. "top 25%"
  scope?: 'pooled' | 'age-band';
}

// Types
interface IQQuestion {
  id: string;
  type: 'numerical' | 'spatial' | 'logical' | 'verbal';
  text: string;
  options: { text: string; value: string }[];
  correctAnswer: string;
  image?: string;
  ariaLabel?: string;
}

interface CategoryScore {
  type: IQQuestion['type'];
  label: string;
  correct: number;
  total: number;
}

interface IQResult {
  rawScore: number;
  totalQuestions: number;
  iqScore: number;
  category: string;
  strengths: string[];
  description: string;
  categoryBreakdown: CategoryScore[];
  itemSetVersion: string;
}

/** ---------- Question Bank (builds on your existing) ---------- */
const iqQuestions: IQQuestion[] = [
  // Numerical (5 original)
  {
    id: 'iq-num-1',
    type: 'numerical',
    text: 'What number comes next in the sequence: 2, 4, 8, 16, ?',
    options: [
      { text: '24', value: '24' },
      { text: '30', value: '30' },
      { text: '32', value: '32' },
      { text: '64', value: '64' },
    ],
    correctAnswer: '32',
  },
  {
    id: 'iq-num-2',
    type: 'numerical',
    text: 'If a baker can bake 3 cakes in 1.5 hours, how many cakes can they bake in 5 hours?',
    options: [
      { text: '8', value: '8' },
      { text: '10', value: '10' },
      { text: '12', value: '12' },
      { text: '15', value: '15' },
    ],
    correctAnswer: '10',
  },
  {
    id: 'iq-num-3',
    type: 'numerical',
    text: 'Which number is the odd one out? 1, 4, 9, 16, 20, 25',
    options: [
      { text: '4', value: '4' },
      { text: '9', value: '9' },
      { text: '20', value: '20' },
      { text: '25', value: '25' },
    ],
    correctAnswer: '20',
  },
  {
    id: 'iq-num-4',
    type: 'numerical',
    text: 'A clock gains 5 minutes every hour. If it is set correctly at 9 AM, what time will it show at 3 PM the same day?',
    options: [
      { text: '3:20 PM', value: '3:20 PM' },
      { text: '3:25 PM', value: '3:25 PM' },
      { text: '3:30 PM', value: '3:30 PM' },
      { text: '3:35 PM', value: '3:35 PM' },
    ],
    correctAnswer: '3:30 PM',
  },
  {
    id: 'iq-num-5',
    type: 'numerical',
    text: 'What number comes next in the sequence: 3, 5, 8, 13, ?',
    options: [
      { text: '18', value: '18' },
      { text: '21', value: '21' },
      { text: '24', value: '24' },
      { text: '26', value: '26' },
    ],
    correctAnswer: '21',
  },

  // Spatial (kept reliable visuals)
  {
    id: 'iq-spat-4',
    type: 'spatial',
    text: 'If the square is folded along a diagonal, which statement is true?',
    image: IQ_ASSET('square_outline.svg'),
    options: [
      { text: 'Two right triangles overlap perfectly', value: 'overlap' },
      { text: 'Two rectangles are formed', value: 'rectangles' },
      { text: 'Two circles are formed', value: 'circles' },
      { text: 'Two unequal triangles form', value: 'unequal' },
    ],
    correctAnswer: 'overlap',
    ariaLabel: 'Square outline used to illustrate folding along its diagonal',
  },
  {
    id: 'iq-spat-6',
    type: 'spatial',
    text: 'Which shape is the odd one out based on the number of sides?',
    image: IQ_ASSET('geometric_shapes_set.svg'),
    options: [
      { text: 'Circle', value: 'circle' },
      { text: 'Triangle', value: 'triangle' },
      { text: 'Square', value: 'square' },
      { text: 'Pentagon', value: 'pentagon' },
    ],
    correctAnswer: 'circle',
    ariaLabel: 'A set of basic shapes: circle, triangle, square, pentagon',
  },
  // New, robust visuals with proven answers
  {
    id: 'iq-spat-7',
    type: 'spatial',
    text: 'How many triangles (of all sizes) are present in the figure?',
    image: IQ_ASSET('Subdivided_triangle_04_00.svg'),
    options: [
      { text: '24', value: '24' },
      { text: '27', value: '27' }, // correct for n=4 grid
      { text: '28', value: '28' },
      { text: '30', value: '30' },
    ],
    correctAnswer: '27',
    ariaLabel: 'Equilateral triangle subdivided into a 4-by-4 triangular grid',
  },
  {
    id: 'iq-spat-8',
    type: 'spatial',
    text: 'How many distinct nets can fold into a cube?',
    image: IQ_ASSET('The_11_cubic_nets.svg'),
    options: [
      { text: '9', value: '9' },
      { text: '10', value: '10' },
      { text: '11', value: '11' }, // correct
      { text: '12', value: '12' },
    ],
    correctAnswer: '11',
    ariaLabel: 'Diagram showing the 11 distinct cube nets',
  },

  // Logical (5 originals)
  {
    id: 'iq-log-1',
    type: 'logical',
    text: 'All roses are flowers. Some flowers fade quickly. Therefore:',
    options: [
      { text: 'All roses fade quickly.', value: 'All roses fade quickly.' },
      { text: 'Some roses fade quickly.', value: 'Some roses fade quickly.' },
      { text: 'No roses fade quickly.', value: 'No roses fade quickly.' },
      { text: 'It cannot be determined whether any roses fade quickly.', value: 'It cannot be determined whether any roses fade quickly.' },
    ],
    // Valid: "some flowers fade quickly" says nothing about whether the
    // rose-subset overlaps the fast-fading subset — it is undetermined.
    correctAnswer: 'It cannot be determined whether any roses fade quickly.',
  },
  {
    id: 'iq-log-2',
    type: 'logical',
    text: 'If it is raining, then the ground is wet. The ground is not wet. Therefore:',
    options: [
      { text: 'It is raining.', value: 'It is raining.' },
      { text: 'It is not raining.', value: 'It is not raining.' },
      { text: 'The ground is always wet.', value: 'The ground is always wet.' },
      { text: 'It might be raining.', value: 'It might be raining.' },
    ],
    correctAnswer: 'It is not raining.',
  },
  {
    id: 'iq-log-3',
    type: 'logical',
    text: 'What comes next in the sequence: A1, C2, E4, G8, ?',
    options: [
      { text: 'I16', value: 'I16' }, // letters +2 (A,C,E,G,I); numbers ×2 (1,2,4,8,16)
      { text: 'H16', value: 'H16' },
      { text: 'I8', value: 'I8' },
      { text: 'J16', value: 'J16' },
    ],
    correctAnswer: 'I16',
  },
  {
    id: 'iq-log-4',
    type: 'logical',
    text: 'Complete the analogy: Finger is to Hand as Toe is to ?',
    options: [
      { text: 'Foot', value: 'Foot' },
      { text: 'Leg', value: 'Leg' },
      { text: 'Shoe', value: 'Shoe' },
      { text: 'Glove', value: 'Glove' },
    ],
    correctAnswer: 'Foot',
  },
  {
    id: 'iq-log-5',
    type: 'logical',
    text: 'If all cats like fish, and some fish are blue, then:',
    options: [
      { text: 'All blue fish are liked by cats.', value: 'All blue fish are liked by cats.' },
      { text: 'Some cats like blue fish.', value: 'Some cats like blue fish.' },
      { text: 'No cats like blue fish.', value: 'No cats like blue fish.' },
      { text: 'It is impossible to tell if any cats like blue fish.', value: 'It is impossible to tell if any cats like blue fish.' },
    ],
    correctAnswer: 'It is impossible to tell if any cats like blue fish.',
  },

  // Verbal (5 originals)
  {
    id: 'iq-verb-1',
    type: 'verbal',
    text: 'Which word is the odd one out?',
    options: [
      { text: 'Apple', value: 'Apple' },
      { text: 'Banana', value: 'Banana' },
      { text: 'Carrot', value: 'Carrot' },
      { text: 'Orange', value: 'Orange' },
    ],
    correctAnswer: 'Carrot',
  },
  {
    id: 'iq-verb-2',
    type: 'verbal',
    text: 'Choose the word that means the opposite of "Optimistic".',
    options: [
      { text: 'Hopeful', value: 'Hopeful' },
      { text: 'Positive', value: 'Positive' },
      { text: 'Pessimistic', value: 'Pessimistic' },
      { text: 'Cheerful', value: 'Cheerful' },
    ],
    correctAnswer: 'Pessimistic',
  },
  {
    id: 'iq-verb-3',
    type: 'verbal',
    text: 'Rearrange the letters "LENPYT" to form a common English word.',
    options: [
      { text: 'TYPEL', value: 'TYPEL' },
      { text: 'PLENTY', value: 'PLENTY' },
      { text: 'LETTP', value: 'LETTP' },
      { text: 'YETLP', value: 'YETLP' },
    ],
    correctAnswer: 'PLENTY',
  },
  {
    id: 'iq-verb-4',
    type: 'verbal',
    text: 'What is a synonym for "Ubiquitous"?',
    options: [
      { text: 'Scarce', value: 'Scarce' },
      { text: 'Rare', value: 'Rare' },
      { text: 'Pervasive', value: 'Pervasive' },
      { text: 'Limited', value: 'Limited' },
    ],
    correctAnswer: 'Pervasive',
  },
  {
    id: 'iq-verb-5',
    type: 'verbal',
    text: 'Identify the word that does not belong: Violin, Guitar, Piano, Trumpet.',
    options: [
      { text: 'Violin', value: 'Violin' },
      { text: 'Guitar', value: 'Guitar' },
      { text: 'Piano', value: 'Piano' },
      { text: 'Trumpet', value: 'Trumpet' },
    ],
    correctAnswer: 'Trumpet',
  },

  /** Replacements for previously-problematic visuals (IDs preserved; type now logical) */
  {
    id: 'iq-spat-1',
    type: 'logical',
    text: 'All squares are rectangles. No circles are rectangles. Which conclusion must be true?',
    options: [
      { text: 'No circles are squares.', value: 'No circles are squares.' }, // correct
      { text: 'All rectangles are squares.', value: 'All rectangles are squares.' },
      { text: 'Some squares are circles.', value: 'Some squares are circles.' },
      { text: 'Some circles are rectangles.', value: 'Some circles are rectangles.' },
    ],
    correctAnswer: 'No circles are squares.',
  },
  {
    id: 'iq-spat-2',
    type: 'logical',
    text: 'If the alarm is set, the door is locked. The door is not locked. Therefore:',
    options: [
      { text: 'The alarm is set.', value: 'The alarm is set.' },
      { text: 'The alarm is not set.', value: 'The alarm is not set.' }, // correct
      { text: 'The door is open.', value: 'The door is open.' },
      { text: 'It is impossible to tell.', value: 'It is impossible to tell.' },
    ],
    correctAnswer: 'The alarm is not set.',
  },
  {
    id: 'iq-spat-3',
    type: 'logical',
    text: 'Find the next term in the sequence: M, J, G, D, ?',
    options: [
      { text: 'A', value: 'A' }, // correct (−3 letters each step)
      { text: 'C', value: 'C' },
      { text: 'B', value: 'B' },
      { text: 'E', value: 'E' },
    ],
    correctAnswer: 'A',
  },
  {
    id: 'iq-spat-5',
    type: 'logical',
    text: 'Some musicians are painters. No painters are poets. Therefore:',
    options: [
      { text: 'Some musicians are not poets.', value: 'Some musicians are not poets.' }, // correct
      { text: 'All musicians are poets.', value: 'All musicians are poets.' },
      { text: 'Some poets are musicians.', value: 'Some poets are musicians.' },
      { text: 'All painters are musicians.', value: 'All painters are musicians.' },
    ],
    correctAnswer: 'Some musicians are not poets.',
  },

  /** Appended items to reach 30 total */
  {
    id: 'iq-num-6',
    type: 'numerical',
    text: 'If 3x + 5 = 26, what is x?',
    options: [
      { text: '5', value: '5' },
      { text: '7', value: '7' }, // correct
      { text: '8', value: '8' },
      { text: '11', value: '11' },
    ],
    correctAnswer: '7',
  },
  {
    id: 'iq-num-7',
    type: 'numerical',
    text: 'The average of five numbers is 18. If four are 10, 16, 20, and 24, what is the fifth?',
    options: [
      { text: '18', value: '18' },
      { text: '20', value: '20' }, // correct
      { text: '22', value: '22' },
      { text: '24', value: '24' },
    ],
    correctAnswer: '20',
  },
  {
    id: 'iq-log-6',
    type: 'logical',
    text: 'If (1) All A are B and (2) All B are C, which conclusion must be true?',
    options: [
      { text: 'All A are C', value: 'All A are C' }, // correct
      { text: 'All C are A', value: 'All C are A' },
      { text: 'Some C are A', value: 'Some C are A' },
      { text: 'No A are C', value: 'No A are C' },
    ],
    correctAnswer: 'All A are C',
  },
  {
    id: 'iq-log-7',
    type: 'logical',
    text: 'From “No squares are circles” and “Some polygons are squares”, what follows?',
    options: [
      { text: 'Some polygons are circles.', value: 'Some polygons are circles.' },
      { text: 'No polygons are circles.', value: 'No polygons are circles.' },
      { text: 'Some polygons are not circles.', value: 'Some polygons are not circles.' }, // correct
      { text: 'All polygons are circles.', value: 'All polygons are circles.' },
    ],
    correctAnswer: 'Some polygons are not circles.',
  },
  {
    id: 'iq-log-8',
    type: 'logical',
    text: 'All poets are writers. Some artists are poets. Therefore:',
    options: [
      { text: 'Some artists are writers.', value: 'Some artists are writers.' }, // correct
      { text: 'All artists are writers.', value: 'All artists are writers.' },
      { text: 'No artists are writers.', value: 'No artists are writers.' },
      { text: 'Artists cannot be writers.', value: 'Artists cannot be writers.' },
    ],
    correctAnswer: 'Some artists are writers.',
  },
  {
    id: 'iq-verb-6',
    type: 'verbal',
    text: 'Pick the closest meaning to “Ephemeral”.',
    options: [
      { text: 'Lasting a very short time', value: 'Lasting a very short time' }, // correct
      { text: 'Extremely large', value: 'Extremely large' },
      { text: 'Difficult to understand', value: 'Difficult to understand' },
      { text: 'Relating to language', value: 'Relating to language' },
    ],
    correctAnswer: 'Lasting a very short time',
  },
  {
    id: 'iq-verb-7',
    type: 'verbal',
    text: 'Wheel is to Car as Wing is to:',
    options: [
      { text: 'Birdhouse', value: 'Birdhouse' },
      { text: 'Airplane', value: 'Airplane' }, // correct
      { text: 'Sail', value: 'Sail' },
      { text: 'Engine', value: 'Engine' },
    ],
    correctAnswer: 'Airplane',
  },
];

/** ---------- Integrity helpers ---------- */
// Fisher–Yates shuffle (immutable). Used to randomize question + option order
// per attempt so answer positions can't be memorized or shared.
function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a fresh randomized quiz: shuffled questions, each with shuffled options.
// correctAnswer is matched by value, so shuffling options is always safe.
function buildQuiz(): IQQuestion[] {
  return shuffle(iqQuestions).map(q => ({ ...q, options: shuffle(q.options) }));
}

// ---------- Resume-after-reload persistence ----------
// The quiz is randomized per attempt (question order + option order), and the
// current index / recorded answers are tied to that exact randomized array.
// So a reload-safe snapshot has to include `questions` too — not just progress.
// Resume key lives in the shared registry so the dashboard "Erase" affordance
// clears the exact same localStorage entry this step reads on mount.
const PROGRESS_KEY = localDraftKey('iq');

interface SavedProgress {
  v: string; // item-set version; stale snapshots are discarded on bump
  questions: IQQuestion[];
  currentQuestionIndex: number;
  userAnswers: Record<string, string | null>;
  showResult: boolean;
}

function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedProgress;
    if (
      !data ||
      data.v !== ITEM_SET_VERSION ||
      !Array.isArray(data.questions) ||
      data.questions.length === 0 ||
      typeof data.currentQuestionIndex !== 'number' ||
      typeof data.userAnswers !== 'object' ||
      data.userAnswers === null
    ) {
      return null;
    }
    // Clamp the index so a corrupt value can never index out of bounds.
    data.currentQuestionIndex = Math.max(
      0,
      Math.min(data.questions.length - 1, Math.floor(data.currentQuestionIndex)),
    );
    return data;
  } catch {
    return null; // unparseable / localStorage unavailable → start fresh
  }
}

function clearSavedProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* localStorage unavailable */
  }
}


// Dev-only authoring guard: catches answer-key drift (a correctAnswer that is
// not among the options) and duplicate ids before they ship.
if (import.meta.env.DEV) {
  const seen = new Set<string>();
  for (const q of iqQuestions) {
    if (seen.has(q.id)) console.error(`[IQStep] duplicate question id: ${q.id}`);
    seen.add(q.id);
    if (!q.options.some(o => o.value === q.correctAnswer)) {
      console.error(`[IQStep] ${q.id}: correctAnswer "${q.correctAnswer}" is not among its options`);
    }
  }
}

/** ---------- Component ---------- */
const IQStep = () => {
  const reflect = useReflectionSave();
  const { updateIntake, markStepComplete } = useIntake();

  // State
  // Restore an in-progress (or completed) attempt from a prior session so a
  // reload doesn't wipe the user's answers. Read once on first render.
  const [saved] = useState<SavedProgress | null>(loadSavedProgress);

  // Randomized once per attempt (and again on Retake) for test integrity.
  const [questions, setQuestions] = useState<IQQuestion[]>(() => saved?.questions ?? buildQuiz());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => saved?.currentQuestionIndex ?? 0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>(() => saved?.userAnswers ?? {});
  const [showResult, setShowResult] = useState(() => saved?.showResult ?? false);
  const [selectedOptionValue, setSelectedOptionValue] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Server-backed cross-device draft sync (Phase 2). Local localStorage resume
  // is unchanged; this adds a durable server copy + one-shot cross-device
  // hydrate. touchedRef flips on the first answer so a late server load can
  // never overwrite answers the user has already started entering here.
  const draftServer = useCoreDraftServerSync('iq');
  const touchedRef = useRef(false);
  const userAnswersRef = useRef(userAnswers);
  userAnswersRef.current = userAnswers;

  // One-shot cross-device resume: if the server draft is further along than this
  // device's local draft and the user hasn't answered yet, adopt it.
  useEffect(() => draftServer.hydrateOnce({
    localDraft: () => ({ userAnswers: userAnswersRef.current }),
    isTouched: () => touchedRef.current,
    apply: (d) => {
      const draft = d as Partial<SavedProgress>;
      if (Array.isArray(draft.questions) && draft.questions.length) setQuestions(draft.questions);
      if (typeof draft.currentQuestionIndex === 'number') setCurrentQuestionIndex(draft.currentQuestionIndex);
      if (draft.userAnswers && typeof draft.userAnswers === 'object') setUserAnswers(draft.userAnswers);
      if (typeof draft.showResult === 'boolean') setShowResult(draft.showResult);
    },
  }), [draftServer]);

  // Save guard

  // Self-norm: how this score compares to other Mirror users (server-computed).
  // null until fetched; .ready is false until enough users have completed.
  const [norms, setNorms] = useState<NormResponse | null>(null);

  // Soft DevTools detection (friction)
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  useEffect(() => {
    const checkSize = () => {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      setDevtoolsOpen(w > 160 || h > 160);
    };
    const id = window.setInterval(checkSize, 1200);
    window.addEventListener('resize', checkSize);
    checkSize();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', checkSize);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mirror:intake:lastStep', 'iq');
    } catch { /* localStorage unavailable */ }
  }, []);

  // Persist a reload-safe snapshot whenever progress changes.
  useEffect(() => {
    const snapshot: SavedProgress = {
      v: ITEM_SET_VERSION,
      questions,
      currentQuestionIndex,
      userAnswers,
      showResult,
    };
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(snapshot));
    } catch { /* quota exceeded / localStorage unavailable */ }
    // Mirror the same snapshot to the server (debounced, fail-safe) so a draft
    // survives a device switch. Media is never in this snapshot; the server also
    // strips any media defensively.
    draftServer.pushDraft(snapshot);
  }, [questions, currentQuestionIndex, userAnswers, showResult, draftServer]);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // IQ Score Calculation — single source of truth (derives everything from the
  // recorded answers), chance-corrected and smoothly monotonic.
  //
  // Why this replaces the old piecewise map:
  //   - The old map had a ~13-point discontinuity at the 75% boundary, so one
  //     question could swing the score ~15 points (non-monotonic, unfair).
  //   - It ignored guessing: 4-option MC has a 25% chance floor.
  //
  // Method: convert proportion-correct (p) into ability above chance
  //   ability = clamp((p - chance) / (1 - chance), 0, 1)
  // then a continuous linear map anchored at ability 0.5 → 100 (±35 across the
  // range), clamped to [55, 145]. Bands follow conventional IQ ranges. This is
  // a self-assessment estimate, not a norm-referenced clinical score.
  const calculateIQScore = useCallback((answers: Record<string, string | null>, quiz: IQQuestion[]): IQResult => {
    const types: IQQuestion['type'][] = ['numerical', 'spatial', 'logical', 'verbal'];
    const byType: Record<string, { correct: number; total: number }> = {};
    types.forEach(t => { byType[t] = { correct: 0, total: 0 }; });

    let rawScore = 0;
    let chanceSum = 0;
    quiz.forEach(q => {
      byType[q.type].total++;
      chanceSum += q.options.length > 0 ? 1 / q.options.length : 0.25;
      if (answers[q.id] != null && answers[q.id] === q.correctAnswer) {
        rawScore++;
        byType[q.type].correct++;
      }
    });

    const total = quiz.length;
    const p = total > 0 ? rawScore / total : 0;
    const chance = total > 0 ? chanceSum / total : 0.25; // ≈ 0.25 for 4-option MC
    const ability = Math.max(0, Math.min(1, (p - chance) / (1 - chance)));
    let iqScore = Math.round(100 + (ability - 0.5) * 70); // 0→65, 0.5→100, 1→135
    iqScore = Math.max(55, Math.min(145, iqScore));

    const category =
      iqScore >= 130 ? 'Very High' :
      iqScore >= 115 ? 'High' :
      iqScore >= 85  ? 'Average' : 'Below Average';

    const categoryBreakdown: CategoryScore[] = types.map(t => ({
      type: t,
      label: `${t[0].toUpperCase()}${t.slice(1)}`,
      correct: byType[t].correct,
      total: byType[t].total,
    }));

    const strengths = categoryBreakdown
      .filter(c => c.total > 0 && c.correct / c.total > 0.7)
      .map(c => `${c.label} Reasoning`);
    if (!strengths.length) strengths.push('Diverse cognitive abilities');

    const description =
      category === 'Very High' ? 'Outstanding cognitive abilities and exceptional problem-solving skills.' :
      category === 'High'      ? 'Strong cognitive skills, demonstrating high capacity for learning and reasoning.' :
      category === 'Average'   ? 'Solid and practical thinking skills, capable of handling most cognitive tasks.' :
                                 'May benefit from focused development in specific cognitive areas.';

    return { rawScore, totalQuestions: total, iqScore, category, strengths, description, categoryBreakdown, itemSetVersion: ITEM_SET_VERSION };
  }, []);

  // Answer handling with slight randomization to reduce timing side-channels
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOption = (i: number) => optionRefs.current[i]?.focus();

  const handleAnswer = (optionValue: string) => {
    if (selectedOptionValue) return; // guard against double-answer
    touchedRef.current = true; // user is answering here — lock out server override
    setSelectedOptionValue(optionValue);

    const delay = 600 + Math.floor(Math.random() * 90); // 600–689ms
    setTimeout(() => {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: optionValue }));

      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOptionValue(null);
      } else {
        setShowResult(true);
      }
    }, delay);
  };

  // Compute result from the authoritative answer record (single source of truth).
  const iqResult = useMemo(() => {
    return showResult ? calculateIQScore(userAnswers, questions) : null;
  }, [showResult, userAnswers, questions, calculateIQScore]);

  // Fetch the self-norm once results are shown. Best-effort: if it fails or the
  // norm isn't ready yet, we fall back to the provisional estimate below.
  useEffect(() => {
    if (!showResult || !iqResult) return;
    let cancelled = false;
    const params = new URLSearchParams({
      rawScore: String(iqResult.rawScore),
      itemSetVersion: iqResult.itemSetVersion,
    });
    fetch(`${NORMS_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: NormResponse | null) => {
        if (!cancelled) setNorms(data && data.success ? data : null);
      })
      .catch(() => { if (!cancelled) setNorms(null); });
    return () => { cancelled = true; };
  }, [showResult, iqResult]);

  // Complete this reflection: record it in the in-memory intake context, then
  // persist the single section to the server. The shared hook awaits + CHECKS
  // the result and drives the confirmation/return-home (or a retryable error) —
  // no silent failure. There is no "next step": each Core step stands alone.
  const handleNext = async () => {
    if (!iqResult) return;
    updateIntake({ iqResults: iqResult, iqAnswers: userAnswers });
    markStepComplete('IQStep', { iqScore: iqResult.iqScore });
    clearSavedProgress(); // committed to intake — don't resurrect this attempt
    draftServer.clearServerDraft(); // draft superseded by the committed submission
    await reflect.save({ iqResults: iqResult, iqAnswers: userAnswers });
  };

  // Focus first option on question change (keyboard UX); reset image state.
  useEffect(() => {
    setImageError(false);
    const t = window.setTimeout(() => focusOption(0), 50);
    return () => window.clearTimeout(t);
  }, [currentQuestion.id]);

  // Focus Continue on results (without needing an id on GlassButton)
  const resultActionsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showResult) {
      const t = window.setTimeout(() => {
        const el = resultActionsRef.current?.querySelector('button');
        if (el instanceof HTMLButtonElement) el.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showResult]);

  // Saving / saved / error takes over the whole view (confirmation + auto-home).
  if (reflect.phase !== 'idle') {
    return <ReflectionComplete label="IQ" phase={reflect.phase} error={reflect.error} onRetry={handleNext} />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <ReturnToMirrorButton />
      {/* Background */}
      <BasicScene />

      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-cyan-100/50 via-teal-50/30 to-blue-100/50 pointer-events-none"
      />

      {/* DevTools friction banner */}
      {devtoolsOpen && (
        <div className="absolute top-0 inset-x-0 z-20 p-3 text-center text-xs text-black bg-yellow-200/80 backdrop-blur-sm">
          Developer tools detected. Certain visual cues are reduced to protect test integrity.
        </div>
      )}

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl mx-auto"
        >
          <GlassCard
            enhanced
            gradient
            className="text-center space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-4 md:m-[40px]"
          >
            {/* Header */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4 items-center justify-center flex flex-col"
            >
              
              <h2 className="text-3xl font-bold text-white text-shadow-soft">IQ &amp; Cognitive Assessment</h2>
              <p className="text-white/80">
                {showResult ? 'Your cognitive profile is ready!' : 'Test your numerical, spatial, logical, and verbal reasoning.'}
              </p>
            </motion.div>

            {/* Progress (ARIA) */}
            <div
              className="glass-card-enhanced p-4 rounded-xl mx-auto max-w-xl"
              role="region"
              aria-labelledby="iq-progress-title"
            >
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span id="iq-progress-title">Progress</span>
                <span aria-live="polite">{currentQuestionIndex + 1} of {totalQuestions}</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={totalQuestions}
                aria-valuenow={currentQuestionIndex + 1}
                aria-valuetext={`${currentQuestionIndex + 1} of ${totalQuestions}`}
              >
                <GlassProgress value={progress} max={100} />
              </div>
            </div>

            {!showResult ? (
              <>
                {/* Question card */}
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
                      <div className="mb-2">
                        <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full capitalize">
                          {currentQuestion.type} Reasoning
                        </span>
                      </div>
                      <h3
                        id={`q-${currentQuestion.id}-label`}
                        className="text-lg md:text-xl text-white font-medium mb-4 text-center"
                      >
                        {currentQuestion.text}
                      </h3>

                      {currentQuestion.image && !imageError && (
                        <div className="mx-auto mb-3 max-w-[11rem] sm:max-w-[13rem] w-full">
                          <motion.img
                            key={currentQuestion.image}
                            src={currentQuestion.image}
                            alt={currentQuestion.ariaLabel ?? currentQuestion.text}
                            decoding="async"
                            loading="eager"
                            className="block mx-auto max-h-32 sm:max-h-40 w-auto object-contain rounded-lg shadow-lg bg-white/5 p-2 border border-white/10"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.35 }}
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.opacity = '1';
                            }}
                            onError={(e) => {
                              console.warn('[IQ image failed]', (e.currentTarget as HTMLImageElement).src);
                              setImageError(true);
                            }}
                          />
                        </div>
                      )}

                      {/* Image-load fallback: a visual question is unfair without
                          its figure — tell the user and offer a retry. */}
                      {currentQuestion.image && imageError && (
                        <div className="mx-auto mb-4 max-w-xs w-full glass-card p-4 rounded-lg text-center">
                          <p className="text-white/70 text-xs mb-2">
                            The image for this question couldn’t load. Check your connection, then retry.
                          </p>
                          <GlassButton
                            onClick={() => setImageError(false)}
                            aria-label="Retry loading the question image"
                            className="bg-white/10 hover:bg-white/20 text-xs py-1.5 px-4"
                          >
                            Retry image
                          </GlassButton>
                        </div>
                      )}
                    </div>

                    {/* Options (radiogroup, keyboardable) */}
                    <div
                      role="radiogroup"
                      aria-labelledby={`q-${currentQuestion.id}-label`}
                      className="space-y-2 mx-auto max-w-xl"
                      onKeyDown={(e) => {
                        const idx = optionRefs.current.findIndex((el) => el === document.activeElement);
                        const last = currentQuestion.options.length - 1;

                        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
                          e.preventDefault();
                          focusOption(Math.min(idx < 0 ? 0 : idx + 1, last));
                        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
                          e.preventDefault();
                          focusOption(Math.max(idx < 0 ? 0 : idx - 1, 0));
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          focusOption(0);
                        } else if (e.key === 'End') {
                          e.preventDefault();
                          focusOption(last);
                        } else if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const i = idx < 0 ? 0 : idx;
                          const val = currentQuestion.options[i]?.value;
                          if (val && !selectedOptionValue) handleAnswer(val);
                        }
                      }}
                    >
                      {currentQuestion.options.map((option, index) => (
                        <motion.button
                          ref={(el) => { optionRefs.current[index] = el; }}
                          key={option.value}
                          role="radio"
                          aria-checked={selectedOptionValue === option.value}
                          aria-label={option.text}
                          aria-posinset={index + 1}
                          aria-setsize={currentQuestion.options.length}
                          aria-disabled={selectedOptionValue !== null}
                          tabIndex={0}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.06 }}
                          onClick={() => !selectedOptionValue && handleAnswer(option.value)}
                          disabled={selectedOptionValue !== null}
                          className={[
                            'w-full py-2.5 px-4 my-0.5 rounded-xl transition-all duration-300 select-none min-h-[44px]',
                            // glossy look + darker hover for focus hint
                            selectedOptionValue === option.value
                              ? 'glass-card-enhanced bg-gradient-to-r from-cyan-400/30 to-teal-400/30 scale-105'
                              : 'glass-card hover:scale-[1.02] hover:bg-black/20',
                            // dim non-selected after choosing
                            selectedOptionValue && selectedOptionValue !== option.value ? 'opacity-50' : '',
                            // keyboard focus ring
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                            // correctness borders unless devtools friction is on
                            !devtoolsOpen && selectedOptionValue === option.value && option.value === currentQuestion.correctAnswer
                              ? 'border-2 border-green-400'
                              : '',
                            !devtoolsOpen && selectedOptionValue === option.value && option.value !== currentQuestion.correctAnswer
                              ? 'border-2 border-red-400'
                              : '',
                            // center the text
                            'flex items-center justify-center text-center',
                          ].join(' ')}
                        >
                          {/* If you created a CSS class for larger text, this will use it; otherwise fallback utility sizes */}
                          <span className="iq-option-text text-white font-semibold text-base md:text-lg leading-snug tracking-wide">
                            {option.text}
                          </span>
                        </motion.button>
                      ))}

                      {/* SR live update of selection */}
                      <span className="sr-only" role="status" aria-live="polite">
                        {selectedOptionValue ? `You selected: ${selectedOptionValue}.` : ''}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              /* Results */
              <AnimatePresence>
                {iqResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
                    >
                      <h3 className="text-sm text-white/70 mb-2">Your Estimated IQ Score</h3>
                      <div className="text-6xl font-bold text-white mb-3 tracking-wider text-shadow-glow">
                        {iqResult.iqScore}
                      </div>
                      <p className="text-white/80 text-lg mb-2">
                        Category: <span className="font-semibold text-teal-300">{iqResult.category}</span>
                      </p>
                      <p className="text-white/70">{iqResult.description}</p>

                      {/* Self-norm: additive line, shown only once enough Mirror
                          users have completed the test (server-gated). Until then
                          the screen is unchanged. */}
                      {norms?.ready && norms.percentile != null && (
                        <p className="text-teal-200/90 text-sm mt-3 border-t border-white/10 pt-3">
                          You scored higher than{' '}
                          <span className="font-semibold">{norms.percentile}%</span>{' '}
                          of other Mirror users
                          {norms.band ? <> — <span className="font-semibold">{norms.band}</span></> : null}.
                        </p>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
                    >
                      <h3 className="text-white font-semibold mb-3">Performance Overview</h3>
                      <p className="text-white/80 text-md mb-4">
                        You answered <span className="font-bold text-lime-300">{iqResult.rawScore}</span> out of{' '}
                        <span className="font-bold text-white">{iqResult.totalQuestions}</span> questions correctly.
                      </p>
                      <h4 className="text-white/70 font-medium mb-2">Your Cognitive Strengths:</h4>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {iqResult.strengths.map((strength, index) => (
                          <motion.span
                            key={strength}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 + index * 0.08 }}
                            className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium"
                          >
                            {strength}
                          </motion.span>
                        ))}
                      </div>

                      {/* Per-category breakdown (transparency) */}
                      <div className="mt-5 space-y-2 text-left">
                        {iqResult.categoryBreakdown.map((c, i) => {
                          const pct = c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0;
                          return (
                            <motion.div
                              key={c.type}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.55 + i * 0.06 }}
                              className="flex items-center gap-3"
                            >
                              <span className="text-white/70 text-xs w-20 flex-shrink-0">{c.label}</span>
                              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-teal-400/70"
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                              <span className="text-white/60 text-xs font-mono w-14 text-right flex-shrink-0">
                                {c.correct}/{c.total}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* Honesty disclaimer */}
                    <p className="text-white/40 text-xs mx-auto max-w-xl">
                      This is a brief self-assessment for reflection — not a clinical or
                      norm-referenced IQ measurement. Scores are estimates based on this short test.
                    </p>

                    <motion.div
                      ref={resultActionsRef}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="flex gap-3 justify-center pt-4"
                    >
                      <GlassButton
                        onClick={() => {
                          // restart with a freshly randomized quiz
                          clearSavedProgress();
                          draftServer.clearServerDraft(); // erase the saved draft — true "start over"
                          touchedRef.current = true;      // this is a deliberate reset, not a resume
                          setQuestions(buildQuiz());
                          setCurrentQuestionIndex(0);
                          setUserAnswers({});
                          setShowResult(false);
                          setSelectedOptionValue(null);
                          setImageError(false);
                        }}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        Retake Test
                      </GlassButton>

                      <GlassButton
                        onClick={handleNext}
                        className="bg-gradient-to-r from-cyan-400/20 to-teal-400/20 hover:from-cyan-400/30 hover:to-teal-400/30"
                      >
                        <span className="flex items-center space-x-2">
                          <span>Complete reflection</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </GlassButton>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default IQStep;