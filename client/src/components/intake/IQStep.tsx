// src/components/intake/IQTestStep.tsx
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Types
interface IQQuestion {
  id: string;
  type: 'numerical' | 'spatial' | 'logical' | 'verbal';
  text: string;
  options: {
    text: string;
    value: string;
  }[];
  correctAnswer: string; // The value of the correct option
  image?: string; // Optional image URL for spatial/logical questions
}

interface IQResult {
  rawScore: number;
  totalQuestions: number;
  iqScore: number; // Placeholder for calculated IQ score
  category: string; // E.g., "Above Average", "Average", "High"
  strengths: string[];
  description: string;
}

// ---
// IQ Question Bank
// ---
const iqQuestions: IQQuestion[] = [
  // Numerical Reasoning (5 questions)
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
    correctAnswer: '20', // All others are perfect squares
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
    correctAnswer: '3:30 PM', // 6 hours * 5 min/hour = 30 minutes gained
  },
  {
    id: 'iq-num-5',
    type: 'numerical',
    text: 'What number comes next in the sequence: 3, 5, 8, 13, ?', // Fibonacci-like sequence: 3+5=8, 5+8=13, 8+13=21
    options: [
      { text: '18', value: '18' },
      { text: '21', value: '21' },
      { text: '24', value: '24' },
      { text: '26', value: '26' },
    ],
    correctAnswer: '21',
  },

  // Spatial Reasoning (5 questions)
  {
    id: 'iq-spat-1',
    type: 'spatial',
    text: 'Which of the following cubes can be formed from the net shown?',
    image: '/images/iq/spatial_net_example.png', // Placeholder, needs actual image
    options: [
      { text: 'A', value: 'A' },
      { text: 'B', value: 'B' },
      { text: 'C', value: 'C' },
      { text: 'D', value: 'D' },
    ],
    correctAnswer: 'A', // Assuming 'A' corresponds to the correct formation
  },
  {
    id: 'iq-spat-2',
    type: 'spatial',
    text: 'Which shape completes the sequence?',
    image: '/images/iq/spatial_sequence_example.png', // Placeholder, needs actual image
    options: [
      { text: 'Shape 1', value: 'Shape 1' },
      { text: 'Shape 2', value: 'Shape 2' },
      { text: 'Shape 3', value: 'Shape 3' },
      { text: 'Shape 4', value: 'Shape 4' },
    ],
    correctAnswer: 'Shape 3',
  },
  {
    id: 'iq-spat-3',
    type: 'spatial',
    text: 'Imagine folding this paper (A) along the dotted lines. Which object (1, 2, 3, or 4) could be formed?',
    image: '/images/iq/spatial_paper_folding.png', // Placeholder, needs actual image
    options: [
      { text: '1', value: '1' },
      { text: '2', value: '2' },
      { text: '3', value: '3' },
      { text: '4', value: '4' },
    ],
    correctAnswer: '2',
  },
  {
    id: 'iq-spat-4',
    type: 'spatial',
    text: 'Which segment completes the puzzle?',
    image: '/images/iq/spatial_puzzle_segment.png', // Placeholder, needs actual image
    options: [
      { text: 'Option 1', value: 'Option 1' },
      { text: 'Option 2', value: 'Option 2' },
      { text: 'Option 3', value: 'Option 3' },
      { text: 'Option 4', value: 'Option 4' },
    ],
    correctAnswer: 'Option 4',
  },
  {
    id: 'iq-spat-5',
    type: 'spatial',
    text: 'Which image is the odd one out?',
    image: '/images/iq/spatial_odd_one_out.png', // Placeholder, needs actual image
    options: [
      { text: 'Image A', value: 'Image A' },
      { text: 'Image B', value: 'Image B' },
      { text: 'Image C', value: 'Image C' },
      { text: 'Image D', value: 'Image D' },
    ],
    correctAnswer: 'Image B',
  },

  // Logical Reasoning (5 questions)
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
    correctAnswer: 'Z32', // Letters go backwards by 2, then 1. Numbers double. F(-2)=D, D(-2)=B, B(-1)=A. Next should be A(-1)=Z. Numbers: 2,4,8,16. Next 32.
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
    correctAnswer: 'It is impossible to tell if any cats like blue fish.', // "Some fish are blue" doesn't mean those are the fish cats like. It's an invalid conclusion.
  },

  // Verbal Reasoning (5 questions)
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
    correctAnswer: 'Carrot', // Vegetable, others are fruits
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
    text: 'Rearrange the letters "PLETY" to form a common English word.',
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
    correctAnswer: 'Trumpet', // Wind instrument, others are string instruments
  },
];

const IQTestStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({});
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOptionValue, setSelectedOptionValue] = useState<string | null>(null);

  const currentQuestion = iqQuestions[currentQuestionIndex];
  const totalQuestions = iqQuestions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Simulate IQ Score Calculation (Simplified for demonstration)
  const calculateIQScore = useCallback((score: number, total: number): IQResult => {
    const percentageCorrect = (score / total) * 100;
    let iqScore = 100; // Average IQ
    let category = "Average";
    const strengths: string[] = [];

    // Simple mapping for demonstration. Real IQ tests use more complex normalization.
    if (percentageCorrect >= 90) {
      iqScore = Math.floor(130 + (percentageCorrect - 90) * 1.5); // 130+ for >90%
      category = "Very High";
    } else if (percentageCorrect >= 75) {
      iqScore = Math.floor(115 + (percentageCorrect - 75) * 1); // 115-129 for 75-89%
      category = "High";
    } else if (percentageCorrect >= 50) {
      iqScore = Math.floor(90 + (percentageCorrect - 50) * 0.5); // 90-114 for 50-74%
      category = "Average";
    } else {
      iqScore = Math.floor(70 + percentageCorrect * 0.4); // <90 for <50%
      category = "Below Average";
    }

    // Determine strengths based on category performance
    const questionTypes = ['numerical', 'spatial', 'logical', 'verbal'];
    const typeScores: Record<string, { correct: number; total: number }> = {};
    questionTypes.forEach(type => (typeScores[type] = { correct: 0, total: 0 }));

    iqQuestions.forEach(q => {
      typeScores[q.type].total++;
      // Ensure userAnswers[q.id] is not null when checking
      if (userAnswers[q.id] !== null && userAnswers[q.id] === q.correctAnswer) {
        typeScores[q.type].correct++;
      }
    });

    questionTypes.forEach(type => {
      if (typeScores[type].total > 0 && (typeScores[type].correct / typeScores[type].total) > 0.7) { // Over 70% correct in a category
        strengths.push(type.charAt(0).toUpperCase() + type.slice(1) + ' Reasoning');
      }
    });

    if (strengths.length === 0) {
      strengths.push('Diverse cognitive abilities');
    }

    let description = '';
    switch(category) {
      case 'Very High': description = 'Outstanding cognitive abilities and exceptional problem-solving skills.'; break;
      case 'High': description = 'Strong cognitive skills, demonstrating high capacity for learning and reasoning.'; break;
      case 'Average': description = 'Solid and practical thinking skills, capable of handling most cognitive tasks.'; break;
      case 'Below Average': description = 'May benefit from focused development in specific cognitive areas.'; break;
      default: description = 'Your cognitive profile is unique.';
    }


    return {
      rawScore: score,
      totalQuestions: total,
      iqScore,
      category,
      strengths,
      description
    };
  }, [userAnswers]); // Depend on userAnswers to update strengths dynamically


  // Handle answer selection
  const handleAnswer = (optionValue: string) => {
    setSelectedOptionValue(optionValue); // Visual feedback

    const isCorrect = optionValue === currentQuestion.correctAnswer;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;

    // Animate selection, then process
    setTimeout(() => {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: optionValue }));
      setCorrectCount(newCorrectCount);

      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOptionValue(null); // Reset for next question
      } else {
        setShowResult(true);
      }
    }, 600); // Animation duration
  };

  // Process results when showResult becomes true
  const iqResult = useMemo(() => {
    if (showResult) {
      return calculateIQScore(correctCount, totalQuestions);
    }
    return null;
  }, [showResult, correctCount, totalQuestions, calculateIQScore]);


  const handleNext = () => {
    updateIntake({
      iqResults: iqResult, // Corrected property name from iqResult to iqResults
      iqAnswers: userAnswers
    });
    navigate('/intake/astrology'); // Navigate to the next step
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCorrectCount(0);
    setShowResult(false);
    setSelectedOptionValue(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />

      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-cyan-100/50 via-teal-50/30 to-blue-100/50 pointer-events-none"
      />

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl"
        >
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden mx-4">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h18M3 6h18M3 20h18" />
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">IQ & Cognitive Assessment</h2>
              <p className="text-white/80">
                {showResult ? 'Your cognitive profile is ready!' : 'Test your numerical, spatial, logical, and verbal reasoning.'}
              </p>
            </motion.div>

            {!showResult ? (
              <>
                {/* Progress */}
                <div className="glass-card-enhanced p-4 rounded-xl">
                  <div className="flex justify-between text-sm text-white/70 mb-2">
                    <span>Progress</span>
                    <span>{currentQuestionIndex + 1} of {totalQuestions}</span>
                  </div>
                  <GlassProgress value={progress} max={100} />
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <div className="mb-2">
                        <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full capitalize">
                          {currentQuestion.type} Reasoning
                        </span>
                      </div>
                      <h3 className="text-xl text-white font-medium mb-4">
                        {currentQuestion.text}
                      </h3>
                      {currentQuestion.image && (
                        <motion.img
                          src={currentQuestion.image}
                          alt="Question Visual"
                          className="w-full max-w-xs mx-auto rounded-lg shadow-lg mb-4"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                        />
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => (
                        <motion.button
                          key={option.value}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => handleAnswer(option.value)}
                          disabled={selectedOptionValue !== null}
                          className={`
                            w-full text-left p-4 rounded-xl transition-all duration-300
                            ${selectedOptionValue === option.value
                              ? 'glass-card-enhanced bg-gradient-to-r from-cyan-400/30 to-teal-400/30 scale-105'
                              : 'glass-card hover:scale-102 hover:bg-white/15'
                            }
                            ${selectedOptionValue && selectedOptionValue !== option.value ? 'opacity-50' : ''}
                            ${selectedOptionValue && selectedOptionValue === option.value && option.value === currentQuestion.correctAnswer
                                ? 'border-2 border-green-400' // Correct answer feedback
                                : selectedOptionValue && selectedOptionValue === option.value && option.value !== currentQuestion.correctAnswer
                                ? 'border-2 border-red-400' // Incorrect answer feedback
                                : ''
                            }
                          `}
                        >
                          <p className="text-white font-medium">{option.text}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              /* Results */
              <AnimatePresence>
                {iqResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* IQ Score & Category */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="glass-card-enhanced p-6 rounded-xl"
                    >
                      <h3 className="text-sm text-white/70 mb-2">Your Estimated IQ Score</h3>
                      <div className="text-6xl font-bold text-white mb-3 tracking-wider text-shadow-glow">
                        {iqResult.iqScore}
                      </div>
                      <p className="text-white/80 text-lg mb-2">Category: <span className="font-semibold text-teal-300">{iqResult.category}</span></p>
                      <p className="text-white/70">{iqResult.description}</p>
                    </motion.div>

                    {/* Raw Score & Strengths */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="glass-card-enhanced p-6 rounded-xl"
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
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 + index * 0.1 }}
                            className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium"
                          >
                            {strength}
                          </motion.span>
                        ))}
                      </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.0 }}
                      className="flex gap-3 justify-center pt-4"
                    >
                      <GlassButton
                        onClick={restartQuiz}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        Retake Test
                      </GlassButton>

                      <GlassButton
                        onClick={handleNext}
                        className="bg-gradient-to-r from-cyan-400/20 to-teal-400/20 hover:from-cyan-400/30 hover:to-teal-400/30"
                      >
                        <span className="flex items-center space-x-2">
                          <span>Continue</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default IQTestStep;
