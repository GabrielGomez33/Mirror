// src/components/intake/IQStep.tsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Use Vite base so assets work in dev and under a sub-path (e.g., /mirror/) in prod
const IQ_ASSET = (file: string) => `${import.meta.env.BASE_URL}/images/iq/${file}`;

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

interface IQResult {
  rawScore: number;
  totalQuestions: number;
  iqScore: number;
  category: string;
  strengths: string[];
  description: string;
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
    text: 'All birds have wings. Some birds can fly. Therefore:',
    options: [
      { text: 'All birds can fly.', value: 'All birds can fly.' },
      { text: 'Some birds cannot fly.', value: 'Some birds cannot fly.' },
      { text: 'No birds can fly.', value: 'No birds can fly.' },
      { text: 'Birds with wings can always fly.', value: 'Birds with wings can always fly.' },
    ],
    correctAnswer: 'Some birds cannot fly.',
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
    text: 'Look at the series: F2, D4, B8, A16, ? What letter and number should come next?',
    options: [
      { text: 'Z32', value: 'Z32' },
      { text: 'Y32', value: 'Y32' },
      { text: 'Z64', value: 'Z64' },
      { text: 'A32', value: 'A32' },
    ],
    correctAnswer: 'Z32',
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

/** ---------- Component ---------- */
const IQStep = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete } = useIntake();

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({});
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOptionValue, setSelectedOptionValue] = useState<string | null>(null);

  // Save guard
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    } catch {}
  }, []);

  const currentQuestion = iqQuestions[currentQuestionIndex];
  const totalQuestions = iqQuestions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // IQ Score Calculation (kept, with strengths by type)
  const calculateIQScore = useCallback((score: number, total: number): IQResult => {
    const percentageCorrect = (score / total) * 100;
    let iqScore = 100;
    let category = 'Average';
    if (percentageCorrect >= 90)      { iqScore = Math.floor(130 + (percentageCorrect - 90) * 1.5); category = 'Very High'; }
    else if (percentageCorrect >= 75) { iqScore = Math.floor(115 + (percentageCorrect - 75) * 1.0); category = 'High'; }
    else if (percentageCorrect >= 50) { iqScore = Math.floor( 90 + (percentageCorrect - 50) * 0.5); category = 'Average'; }
    else                              { iqScore = Math.floor( 70 +  percentageCorrect       * 0.4); category = 'Below Average'; }

    const types = ['numerical','spatial','logical','verbal'] as const;
    const byType: Record<string, {correct: number; total: number}> = {};
    types.forEach(t => byType[t] = { correct: 0, total: 0 });
    iqQuestions.forEach(q => {
      byType[q.type].total++;
      if (userAnswers[q.id] != null && userAnswers[q.id] === q.correctAnswer) byType[q.type].correct++;
    });
    const strengths: string[] = [];
    types.forEach(t => {
      const s = byType[t];
      if (s.total > 0 && s.correct / s.total > 0.7) {
        strengths.push(`${t[0].toUpperCase()}${t.slice(1)} Reasoning`);
      }
    });
    if (!strengths.length) strengths.push('Diverse cognitive abilities');

    const description =
      category === 'Very High' ? 'Outstanding cognitive abilities and exceptional problem-solving skills.' :
      category === 'High'      ? 'Strong cognitive skills, demonstrating high capacity for learning and reasoning.' :
      category === 'Average'   ? 'Solid and practical thinking skills, capable of handling most cognitive tasks.' :
                                 'May benefit from focused development in specific cognitive areas.';

    return { rawScore: score, totalQuestions: total, iqScore, category, strengths, description };
  }, [userAnswers]);

  // Answer handling with slight randomization to reduce timing side-channels
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOption = (i: number) => optionRefs.current[i]?.focus();

  const handleAnswer = (optionValue: string) => {
    setSelectedOptionValue(optionValue);
    const isCorrect = optionValue === currentQuestion.correctAnswer;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;

    const delay = 600 + Math.floor(Math.random() * 90); // 600–689ms
    setTimeout(() => {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: optionValue }));
      setCorrectCount(newCorrectCount);

      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOptionValue(null);
      } else {
        setShowResult(true);
      }
    }, delay);
  };

  // Compute result
  const iqResult = useMemo(() => {
    return showResult ? calculateIQScore(correctCount, totalQuestions) : null;
  }, [showResult, correctCount, totalQuestions, calculateIQScore]);

  // Guarded proceed: block navigation on save failure
  const handleNext = async () => {
    if (!iqResult) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateIntake({ iqResults: iqResult, iqAnswers: userAnswers });
      await markStepComplete('IQStep', { iqScore: iqResult.iqScore });
      navigate('/intake/astrology');
    } catch {
      setSaveError('We couldn’t save your results. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Focus first option on question change (keyboard UX)
  useEffect(() => {
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

  return (
    <div className="min-h-screen relative overflow-hidden">
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
            className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]"
          >
            {/* Header */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4 items-center justify-center flex flex-col"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h18M3 6h18M3 20h18" />
                </svg>
              </div>
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
                    <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                      <div className="mb-2">
                        <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full capitalize">
                          {currentQuestion.type} Reasoning
                        </span>
                      </div>
                      <h3
                        id={`q-${currentQuestion.id}-label`}
                        className="text-xl text-white font-medium mb-4 text-center"
                      >
                        {currentQuestion.text}
                      </h3>

                      {currentQuestion.image && (
                        <div className="mx-auto mb-4 max-w-[16rem] sm:max-w-xs w-full">
                          <motion.img
                            key={currentQuestion.image}
                            src={currentQuestion.image}
                            alt={currentQuestion.ariaLabel ?? currentQuestion.text}
                            decoding="async"
                            loading="eager"
                            className="block mx-auto max-h-48 sm:max-h-56 w-auto object-contain rounded-lg shadow-lg bg-white/5 p-3 border border-white/10"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.35 }}
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.opacity = '1';
                            }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              console.warn('[IQ image failed]', img.src);
                              img.style.opacity = '0';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Options (radiogroup, keyboardable) */}
                    <div
                      role="radiogroup"
                      aria-labelledby={`q-${currentQuestion.id}-label`}
                      className="space-y-3 mx-auto max-w-xl"
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
                            'w-full p-4 my-1 rounded-xl transition-all duration-300 select-none min-h-[52px]',
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
                          <span className="iq-option-text text-white font-semibold text-lg md:text-xl leading-relaxed tracking-wide">
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
                    </motion.div>

                    {saveError && <div className="text-red-300 text-sm text-center">{saveError}</div>}

                    <motion.div
                      ref={resultActionsRef}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="flex gap-3 justify-center pt-4"
                    >
                      <GlassButton
                        onClick={() => {
                          // restart
                          setCurrentQuestionIndex(0);
                          setUserAnswers({});
                          setCorrectCount(0);
                          setShowResult(false);
                          setSelectedOptionValue(null);
                        }}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        Retake Test
                      </GlassButton>

                      <GlassButton
                        onClick={handleNext}
                        disabled={saving}
                        aria-busy={saving ? true : undefined}
                        className="bg-gradient-to-r from-cyan-400/20 to-teal-400/20 hover:from-cyan-400/30 hover:to-teal-400/30"
                      >
                        {saving ? 'Saving…' : (
                          <span className="flex items-center space-x-2">
                            <span>Continue</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        )}
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
