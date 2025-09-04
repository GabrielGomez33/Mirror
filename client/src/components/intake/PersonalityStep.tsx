// src/components/intake/PersonalityStep.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Import all assessment components with proper type imports
import { 
  scientificQuestions, 
  PERSONALITY_DISCLAIMER 
} from './personality/scientificQuestionBank';
import type { Question } from './personality/scientificQuestionBank';

import { 
  mbtiQuestions, 
  MBTI_DISCLAIMER
} from './personality/mbtiQuestionBank';
import type { MBTIQuestion } from './personality/mbtiQuestionBank';

import { DataQualityMonitor } from './personality/dataQualityMonitor';
//import type { DataQualityMetrics } from './personality/dataQualityMonitor';

import { 
  IntegratedPersonalityScorer
} from './personality/integratedScoring';
import type { ComprehensivePersonalityResult } from './personality/integratedScoring';

// Import the adapter to maintain compatibility with existing IntakeContext
import { PersonalityResultAdapter } from './personality/personalityResultAdapter';
//import type { PersonalityResult } from './personality/personalityResultAdapter';

// Combine all question types
type AllQuestions = Question | MBTIQuestion | {
  id: string;
  text: string;
  category: 'attention' | 'reflection';
  dimension: string;
  options: { text: string; value: string; score: number; }[];
};

const PersonalityStep = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete } = useIntake();

  // Create comprehensive question set
  const questions = useMemo((): AllQuestions[] => {
    const allQuestions: AllQuestions[] = [
      ...scientificQuestions.filter(q => q.category === 'big5'),
      ...mbtiQuestions,
      ...scientificQuestions.filter(q => q.category === 'attention'),
      ...scientificQuestions.filter(q => q.category === 'reflection')
    ];

    // Shuffle maintaining structure
    const big5Questions = allQuestions.filter(q => q.category === 'big5');
    const mbtiQs = allQuestions.filter(q => q.category === 'mbti');
    const attentionChecks = allQuestions.filter(q => q.category === 'attention');
    const reflectionQ = allQuestions.filter(q => q.category === 'reflection');

    // Interleave Big Five and MBTI questions for better engagement
    const shuffledBig5 = [...big5Questions].sort(() => Math.random() - 0.5);
    const shuffledMBTI = [...mbtiQs].sort(() => Math.random() - 0.5);
    
    const interleaved: AllQuestions[] = [];
    const maxLength = Math.max(shuffledBig5.length, shuffledMBTI.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (shuffledBig5[i]) interleaved.push(shuffledBig5[i]);
      if (shuffledMBTI[i]) interleaved.push(shuffledMBTI[i]);
    }

    // Insert attention checks at strategic points
    const quarterPoint = Math.floor(interleaved.length / 4);
    const threeQuarterPoint = Math.floor((interleaved.length * 3) / 4);
    
    interleaved.splice(quarterPoint, 0, attentionChecks[0]);
    interleaved.splice(threeQuarterPoint + 1, 0, attentionChecks[1]);
    
    // Add reflection at end
    return [...interleaved, ...reflectionQ];
  }, []);

  // State management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comprehensiveResult, setComprehensiveResult] = useState<ComprehensivePersonalityResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Data quality monitoring
  const [qualityMonitor] = useState(() => new DataQualityMonitor());

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Start timing for each question
  useEffect(() => {
    if (currentQuestion && !showDisclaimer) {
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestionIndex, currentQuestion, showDisclaimer]);

  // Calculate comprehensive results
  const calculateResults = useCallback(() => {
    const qualityMetrics = qualityMonitor.generateQualityMetrics(questions);
    
    const big5Questions = questions.filter(q => q.category === 'big5') as Question[];
    const mbtiQs = questions.filter(q => q.category === 'mbti') as MBTIQuestion[];
    
    const comprehensiveResult = IntegratedPersonalityScorer.calculateComprehensiveResult(
      answers,
      big5Questions,
      mbtiQs,
      qualityMetrics
    );
    
    // Store comprehensive results for display
    setComprehensiveResult(comprehensiveResult);
    
    // Adapt to existing PersonalityResult format for IntakeContext compatibility
    const adaptedResult = PersonalityResultAdapter.adaptToExistingFormat(comprehensiveResult);
    const detailedSummary = PersonalityResultAdapter.createDetailedSummary(comprehensiveResult);
    
    // Update intake with existing format - no changes needed to IntakeContext!
    updateIntake({
      personalityResult: adaptedResult,
      personalityAnswers: answers,
      // Store detailed summary in a separate field that won't break existing code
      personalityDetails: detailedSummary
    });
  }, [answers, questions, qualityMonitor, updateIntake]);

  // Handle answer selection
  const handleAnswer = (option: any) => {
    if (currentQuestion.category === 'reflection') {
      if (textInput.trim().length < 20) {
        return;
      }
      const answer = { text: textInput.trim(), value: 'reflection', score: 0 };
      qualityMonitor.recordResponse(currentQuestion.id, answer, questionStartTime);
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    } else {
      setSelectedOption(option.value);
      
      // Validate attention checks
      if (currentQuestion.category === 'attention') {
        const expectedValue = currentQuestion.id === 'attention-1' ? '5' : '2';
        qualityMonitor.validateAttentionCheck(currentQuestion.id, expectedValue, option.value);
      }
      
      qualityMonitor.recordResponse(currentQuestion.id, option, questionStartTime);
    }

    // Progress to next question or show results
    setTimeout(() => {
      if (currentQuestion.category !== 'reflection') {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }));
      }

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
        setTextInput('');
      } else {
        setShowResult(true);
      }
    }, currentQuestion.category === 'reflection' ? 0 : 400);
  };

  // Calculate results when assessment completes
  useEffect(() => {
    if (showResult && !comprehensiveResult) {
      calculateResults();
    }
  }, [showResult, comprehensiveResult, calculateResults]);

  // Navigation handlers
  const handleNext = () => {
    markStepComplete('PersonalityStep', { completed: true });
    try { 
      localStorage.setItem('mirror:intake:lastStep', 'personality'); 
    } catch {}
    navigate('/intake/submit');
  };

  const restartAssessment = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setComprehensiveResult(null);
    setShowResult(false);
    setSelectedOption(null);
    setTextInput('');
    setShowDisclaimer(true);
    qualityMonitor.reset();
  };

  // Get question type display info
  const getQuestionTypeInfo = (question: AllQuestions) => {
    if (question.category === 'attention') return { label: 'Quality Check', color: 'bg-yellow-500/20' };
    if (question.category === 'reflection') return { label: 'Personal Reflection', color: 'bg-purple-500/20' };
    if (question.category === 'big5') return { label: `Big Five: ${question.dimension?.charAt(0).toUpperCase()}${question.dimension?.slice(1)}`, color: 'bg-blue-500/20' };
    if (question.category === 'mbti') return { label: `MBTI: ${question.dimension}`, color: 'bg-indigo-500/20' };
    return { label: 'Assessment', color: 'bg-gray-500/20' };
  };

  // Show disclaimer first
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

        {/* Page shell (full-height, center the card) */}
        <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
          <div className="w-full max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]">
                {/* Header block (icon + title) */}
                <div className="space-y-4 items-center justify-center flex flex-col">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white text-shadow-soft">Comprehensive Personality Assessment</h2>
                  <p className="text-white/80">
                    Scientific Big Five analysis combined with MBTI type exploration
                  </p>
                </div>

                {/* Assessment Information */}
                <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                  <h3 className="text-white font-semibold mb-4">What You'll Discover</h3>
                  <div className="text-white/80 text-left space-y-3 text-sm">
                    <p><strong>Big Five Traits:</strong> Research-backed personality dimensions with statistical analysis</p>
                    <p><strong>MBTI Type:</strong> Popular personality framework for self-understanding</p>
                    <p><strong>Integrated Insights:</strong> How both approaches complement each other</p>
                    <p><strong>Quality Metrics:</strong> Reliability indicators and confidence intervals</p>
                    <p><strong>Total Time:</strong> 12-18 minutes ({questions.length} questions)</p>
                  </div>
                </div>

                {/* Scientific Context & Disclaimers */}
                <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                  <h3 className="text-white font-semibold mb-4">Scientific Context & Important Disclaimers</h3>
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

                {/* Start Button */}
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

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BasicScene />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      {/* Page shell (full-height, center the card) */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="w-full max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]">
              {!showResult ? (
                <>
                  {/* Header block (icon + title) */}
                  <div className="space-y-4 items-center justify-center flex flex-col">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white text-shadow-soft">Personality Assessment</h2>
                    <p className="text-white/80">
                      Respond thoughtfully and honestly to each statement
                    </p>
                  </div>

                  {/* Progress card */}
                  <div className="glass-card-enhanced p-4 rounded-xl mx-auto max-w-xl">
                    <div className="flex justify-between text-sm text-white/70 mb-2">
                      <span>Progress</span>
                      <span>{currentQuestionIndex + 1} of {questions.length}</span>
                    </div>
                    <GlassProgress value={progress} max={100} />
                  </div>

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
                        <div className="mb-4">
                          <span className={`text-xs text-white/50 px-3 py-1 rounded-full ${getQuestionTypeInfo(currentQuestion).color}`}>
                            {getQuestionTypeInfo(currentQuestion).label}
                          </span>
                        </div>
                        <h3 className="text-xl text-white font-medium mb-4 text-center">
                          {currentQuestion.text}
                        </h3>
                        
                        {/* Special handling for reflection question */}
                        {currentQuestion.category === 'reflection' && (
                          <div className="mt-4">
                            <textarea
                              value={textInput}
                              onChange={(e) => setTextInput(e.target.value)}
                              placeholder="Share your authentic self here... (minimum 20 characters for meaningful analysis)"
                              className="w-full p-4 rounded-xl bg-white/10 text-white placeholder-white/50 border border-white/20 focus:border-white/40 focus:outline-none resize-none"
                              rows={6}
                              maxLength={1000}
                            />
                            <div className="flex justify-between text-xs text-white/50 mt-2">
                              <span>{textInput.length >= 20 ? '✓ Ready to submit' : `Need ${20 - textInput.length} more characters`}</span>
                              <span>{textInput.length}/1000</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Options (answers) */}
                      {currentQuestion.category !== 'reflection' ? (
                        <div role="radiogroup" className="space-y-3 mx-auto max-w-xl">
                          {currentQuestion.options.map((option, index) => (
                            <motion.button
                              key={option.value}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.04 }}
                              onClick={() => handleAnswer(option)}
                              disabled={selectedOption !== null}
                              className={[
                                'w-full p-4 rounded-xl transition-all duration-300',
                                'flex items-center justify-center text-center',
                                'glass-card hover:scale-[1.02] hover:bg-black/20',
                                selectedOption === option.value
                                  ? 'glass-card-enhanced bg-gradient-to-r from-indigo-400/30 to-purple-400/30 scale-105'
                                  : '',
                                selectedOption && selectedOption !== option.value ? 'opacity-50' : ''
                              ].join(' ')}
                            >
                              <span className="text-white font-semibold text-lg md:text-xl">
                                {option.text}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      ) : (
                        /* Reflection question submit button */
                        <div className="mx-auto max-w-xl">
                          <GlassButton
                            onClick={() => handleAnswer({ text: textInput })}
                            disabled={textInput.trim().length < 20}
                            className="w-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 disabled:opacity-50"
                          >
                            Complete Assessment
                          </GlassButton>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              ) : (
                /* INLINE RESULTS DISPLAY - Uses comprehensive results for rich display */
                comprehensiveResult && (
                  <ComprehensiveResultsDisplay 
                    result={comprehensiveResult} 
                    onRestart={restartAssessment}
                    onNext={handleNext}
                  />
                )
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Comprehensive Results Display Component (unchanged from before)
const ComprehensiveResultsDisplay: React.FC<{
  result: ComprehensivePersonalityResult;
  onRestart: () => void;
  onNext: () => void;
}> = ({ result, onRestart, onNext }) => {
  
  const getTraitColor = (trait: string) => {
    const colors = {
      openness: 'from-blue-400 to-indigo-400',
      conscientiousness: 'from-green-400 to-emerald-400',
      extraversion: 'from-yellow-400 to-orange-400',
      agreeableness: 'from-pink-400 to-rose-400',
      neuroticism: 'from-purple-400 to-violet-400'
    };
    return colors[trait as keyof typeof colors] || 'from-gray-400 to-gray-500';
  };

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'excellent': return 'text-green-300';
      case 'good': return 'text-blue-300';
      case 'adequate': return 'text-yellow-300';
      default: return 'text-red-300';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="space-y-4 items-center justify-center flex flex-col">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white text-shadow-soft">Your Complete Personality Profile</h2>
          <p className="text-white/80">
            Comprehensive analysis combining scientific research and popular frameworks
          </p>
        </div>

        {/* Quality Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Assessment Quality</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getReliabilityColor(result.big5.profileReliability)}`}>
              {result.big5.profileReliability.toUpperCase()}
            </span>
          </div>
          
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex justify-between">
              <span>Data Quality:</span>
              <span className="text-white font-medium">{result.dataQuality.overallQuality}</span>
            </div>
            <div className="flex justify-between">
              <span>Big Five Reliability:</span>
              <span className="text-white font-medium">{Math.round(result.big5.overallReliability * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span>MBTI Clarity:</span>
              <span className="text-white font-medium">{result.mbti.overallClarity}%</span>
            </div>
          </div>

          {result.dataQuality.dataQualityFlags.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-200 text-xs font-medium mb-1">Quality Notes:</p>
              <ul className="text-yellow-100/80 text-xs space-y-1">
                {result.dataQuality.dataQualityFlags.slice(0, 2).map((flag, index) => (
                  <li key={index}>• {flag.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* Integrated Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
        >
          <h3 className="text-white font-semibold text-lg mb-4">Integrated Profile Summary</h3>
          <p className="text-white/90 text-base leading-relaxed mb-4">
            {result.integration.combinedSummary}
          </p>
          
          {result.integration.keyPatterns.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white/80 font-medium text-sm">Key Patterns:</h4>
              <ul className="space-y-1 text-white/70 text-sm">
                {result.integration.keyPatterns.map((pattern, index) => (
                  <li key={index}>• {pattern}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* MBTI Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
        >
          <h3 className="text-white font-semibold text-lg mb-4">MBTI Type Profile</h3>
          
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-white mb-2 tracking-wider">
              {result.mbti.type}
            </div>
            <p className="text-white/80 text-sm">{result.mbti.typeDescription}</p>
          </div>

          <div className="space-y-3 text-sm">
            {Object.entries(result.mbti.preferences).map(([dimension, pref]) => (
              <div key={dimension} className="flex justify-between items-center">
                <span className="text-white/70">{dimension}:</span>
                <div className="text-right">
                  <span className="text-white font-medium">
                    {(pref as any).preferredType} ({(pref as any).strength})
                  </span>
                  <div className="text-xs text-white/50">
                    {Math.round((pref as any).clarity)}% clarity
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/60 text-xs mt-4 italic">
            {result.mbti.reliabilityNote}
          </p>
        </motion.div>

        {/* Big Five Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
        >
          <h3 className="text-white font-semibold text-lg mb-6">Big Five Personality Traits</h3>
          
          <div className="space-y-6">
            {Object.entries(result.big5.traits).map(([trait, score], index) => (
              <div key={trait} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-white font-medium">{trait.charAt(0).toUpperCase() + trait.slice(1)}</h4>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      {score.percentileRank}
                      <span className="text-xs text-white/60 ml-1">percentile</span>
                    </div>
                    <div className="text-xs text-white/50">
                      {score.confidenceInterval.lower}-{score.confidenceInterval.upper}% CI
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative">
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score.percentileRank}%` }}
                      transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                      className={`h-full bg-gradient-to-r ${getTraitColor(trait)} rounded-full`}
                    />
                  </div>
                </div>

                <p className="text-white/80 text-sm">
                  <span className="font-medium text-white">
                    {score.interpretation.level.charAt(0).toUpperCase() + score.interpretation.level.slice(1)}:
                  </span>{' '}
                  {score.interpretation.description.substring(0, 120)}
                  {score.interpretation.description.length > 120 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Personal Reflection */}
        {result.personalReflection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
          >
            <h3 className="text-white font-semibold text-lg mb-4">Your Personal Reflection</h3>
            
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <p className="text-white/90 text-sm italic leading-relaxed">
                "{result.personalReflection.text.substring(0, 200)}{result.personalReflection.text.length > 200 ? '...' : ''}"
              </p>
            </div>

            {result.personalReflection.insights.length > 0 && (
              <div>
                <h4 className="text-white/80 font-medium text-sm mb-2">Reflection Insights:</h4>
                <ul className="space-y-1 text-white/70 text-sm">
                  {result.personalReflection.insights.map((insight, index) => (
                    <li key={index}>• {insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Unified Recommendations */}
        {result.integration.unifiedRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
          >
            <h3 className="text-white font-semibold text-lg mb-4">Personalized Recommendations</h3>
            <ul className="space-y-2 text-white/80 text-sm">
              {result.integration.unifiedRecommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-indigo-300 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Important Disclaimers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl"
        >
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
                <li>• Research-based with established scientific support</li>
                <li>• Represents general tendencies, not fixed characteristics</li>
              </ul>
            </div>
            
            <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <p className="text-purple-200 text-xs font-medium mb-1">MBTI Framework:</p>
              <ul className="space-y-1 text-purple-100/80 text-xs">
                <li>• Popular framework with limited scientific validation</li>
                <li>• Best used for self-reflection and personal development</li>
              </ul>
            </div>
            
            <ul className="space-y-1 text-white/60 text-xs">
              <li>• Both assessments are for personal insight, not clinical decisions</li>
              <li>• Results reflect current self-perception and may change over time</li>
            </ul>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3 justify-center pt-4"
        >
          <GlassButton
            onClick={onRestart}
            className="bg-white/10 hover:bg-white/20"
          >
            Retake Assessment
          </GlassButton>

          <GlassButton
            onClick={onNext}
            className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30"
          >
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
