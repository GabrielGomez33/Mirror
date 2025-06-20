// src/components/intake/ResultsStep.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Simple interfaces for the component
interface ProfileSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  data: any;
}

interface InsightCard {
  category: string;
  insight: string;
  confidence: number;
  sources: string[];
  actionable?: string;
}

const ResultsStep = () => {
  const navigate = useNavigate();
  const { getIntake: intakeData } = useIntake(); // Simple alias fix
  
  // State Management
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [selectedInsight, setSelectedInsight] = useState<InsightCard | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'loading' | 'synthesis' | 'complete'>('loading');
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Error Handling for Missing Data
  useEffect(() => {
    const requiredData = ['personalityResult', 'astrologicalResult'];
    const missingData = requiredData.filter(key => !intakeData?.[key]);
    
    if (missingData.length > 0) {
      setErrorState(`Missing required data: ${missingData.join(', ')}`);
    } else {
      // Simulate loading and data synthesis
      setTimeout(() => setAnimationPhase('synthesis'), 1000);
      setTimeout(() => setAnimationPhase('complete'), 3000);
    }
  }, [intakeData]);
  
  // Synthesized Insights Generation
  const synthesizedInsights = useMemo(() => {
    if (!intakeData?.personalityResult || !intakeData?.astrologicalResult) return [];
    
    const insights: InsightCard[] = [
      {
        category: 'Core Identity',
        insight: `Your ${intakeData.personalityResult.mbtiType} personality combined with ${intakeData.astrologicalResult.western.sunSign} energy creates a unique leadership style focused on transformation and growth.`,
        confidence: 92,
        sources: ['MBTI Analysis', 'Western Astrology', 'Big Five Profile'],
        actionable: 'Leverage your natural charisma in teaching or mentoring roles'
      },
      {
        category: 'Spiritual Path',
        insight: `The alignment between your ${intakeData.astrologicalResult.african.orishaGuardian} guardian and ${intakeData.astrologicalResult.chinese.animalSign} energy suggests a calling toward healing and wisdom sharing.`,
        confidence: 88,
        sources: ['African Astrology', 'Chinese Zodiac', 'Numerology'],
        actionable: 'Explore meditation, energy healing, or traditional wisdom practices'
      },
      {
        category: 'Relationships',
        insight: `Your high agreeableness (${Math.round(intakeData.personalityResult.big5Profile.agreeableness)}%) and ${intakeData.astrologicalResult.western.moonSign} moon create deep emotional connections with others.`,
        confidence: 85,
        sources: ['Big Five', 'Moon Sign', 'Personality Assessment'],
        actionable: 'Focus on relationships that honor your empathetic nature'
      },
      {
        category: 'Career Direction',
        insight: `The combination of ${intakeData.personalityResult.dominantTraits.join(', ')} traits with your ${intakeData.astrologicalResult.numerology.lifePathNumber} life path suggests success in creative or healing professions.`,
        confidence: 90,
        sources: ['Personality Traits', 'Life Path Number', 'Western Houses'],
        actionable: 'Consider roles in counseling, arts, education, or holistic wellness'
      },
      {
        category: 'Growth Areas',
        insight: `Your ${intakeData.astrologicalResult.chinese.element} element and current life phase indicate a time for developing patience and strategic thinking.`,
        confidence: 82,
        sources: ['Chinese Elements', 'Life Phase Analysis'],
        actionable: 'Practice mindfulness and long-term planning techniques'
      }
    ];
    
    return insights;
  }, [intakeData]);
  
  // Profile Sections Configuration
  const profileSections: ProfileSection[] = [
    {
      id: 'overview',
      title: 'Cosmic Overview',
      icon: '🌟',
      color: 'from-purple-400 to-pink-400',
      description: 'Your complete profile synthesis',
      data: synthesizedInsights
    },
    {
      id: 'personality',
      title: 'Personality Core',
      icon: '🧠',
      color: 'from-blue-400 to-indigo-400',
      description: 'MBTI & Big Five analysis',
      data: intakeData?.personalityResult
    },
    {
      id: 'western',
      title: 'Western Astrology',
      icon: '♈',
      color: 'from-yellow-400 to-orange-400',
      description: 'Sun, Moon, Rising & Houses',
      data: intakeData?.astrologicalResult?.western
    },
    {
      id: 'eastern',
      title: 'Eastern Wisdom',
      icon: '🐉',
      color: 'from-red-400 to-yellow-400',
      description: 'Chinese Zodiac & Elements',
      data: intakeData?.astrologicalResult?.chinese
    },
    {
      id: 'african',
      title: 'African Traditions',
      icon: '⚡',
      color: 'from-purple-400 to-indigo-400',
      description: 'Orisha & Ancestral Wisdom',
      data: intakeData?.astrologicalResult?.african
    },
    {
      id: 'numerology',
      title: 'Sacred Numbers',
      icon: '🔢',
      color: 'from-green-400 to-emerald-400',
      description: 'Life Path & Destiny Numbers',
      data: intakeData?.astrologicalResult?.numerology
    },
    {
      id: 'guidance',
      title: 'Life Guidance',
      icon: '🧭',
      color: 'from-teal-400 to-cyan-400',
      description: 'Integrated recommendations',
      data: intakeData?.astrologicalResult?.synthesis
    }
  ];
  
  // Loading State
  if (errorState) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <GlassCard enhanced className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-pink-400 mx-auto flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Profile Incomplete</h2>
            <p className="text-white/70">{errorState}</p>
            <GlassButton
              onClick={() => navigate('/intake/personality')}
              className="bg-gradient-to-r from-blue-400/20 to-purple-400/20"
            >
              Complete Your Profile
            </GlassButton>
          </GlassCard>
        </div>
      </div>
    );
  }
  
  if (animationPhase === 'loading') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            {/* Cosmic Loading Animation */}
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-40 h-40 rounded-full border-4 border-white/10 border-t-purple-400 mx-auto"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-6 w-28 h-28 rounded-full border-4 border-white/10 border-r-blue-400"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-12 w-16 h-16 rounded-full border-4 border-white/10 border-l-pink-400"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl"
                >
                  ✨
                </motion.span>
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">Synthesizing Your Cosmic Profile</h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                {[
                  'Analyzing personality patterns...',
                  'Aligning celestial influences...',
                  'Integrating cultural wisdom...',
                  'Generating personalized insights...'
                ].map((text, index) => (
                  <motion.p
                    key={text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.3 }}
                    className="text-white/70"
                  >
                    {text}
                  </motion.p>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }
  
  if (animationPhase === 'synthesis') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        {/* Synthesis Animation with Data Flowing */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
                opacity: 0
              }}
              animate={{
                y: -50,
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 3,
                delay: i * 0.1,
                ease: "easeOut"
              }}
              className="absolute w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
            />
          ))}
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <motion.div
              animate={{ rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 mx-auto"
            >
              <div className="w-full h-full bg-gradient-to-br from-purple-400 via-blue-400 to-pink-400 rounded-full flex items-center justify-center">
                <span className="text-3xl">🌌</span>
              </div>
            </motion.div>
            
            <h2 className="text-4xl font-bold text-white">Creating Your Universe</h2>
            <p className="text-white/70 max-w-md">
              Weaving together the threads of personality, celestial wisdom, and ancient knowledge 
              into your unique cosmic blueprint...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }
  
  // Main Results Interface
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Enhanced Three.js Background */}
      <BasicScene />
      
      {/* Dynamic Gradient Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/30 to-pink-900/40 pointer-events-none"
      />
      
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: 0
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              x: [null, Math.random() * window.innerWidth],
              scale: [0, 1, 0],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: Math.random() * 15 + 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-2 h-2 bg-gradient-to-r from-white to-purple-300 rounded-full blur-sm"
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen p-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center py-8"
        >
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-white text-shadow-soft mb-4"
          >
            Your Cosmic Blueprint
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-white/80 max-w-3xl mx-auto"
          >
            A comprehensive synthesis of your personality, astrological influences, and spiritual wisdom 
            across multiple traditions and cultures
          </motion.p>
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {profileSections.map((section, index) => (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSection(section.id)}
              className={`
                px-4 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300
                ${activeSection === section.id 
                  ? `bg-gradient-to-r ${section.color} text-white shadow-lg transform scale-105` 
                  : 'bg-white/10 text-white/70 hover:bg-white/20 backdrop-blur-sm'
                }
              `}
            >
              <span className="text-xl">{section.icon}</span>
              <span className="font-medium hidden sm:inline">{section.title}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="max-w-7xl mx-auto"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
            >
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* Core Insights */}
                  <GlassCard enhanced gradient className="p-6">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                      <span>✨</span>
                      <span>Core Insights</span>
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {synthesizedInsights.map((insight, index) => (
                        <motion.div
                          key={insight.category}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedInsight(insight)}
                          className="glass-card-enhanced p-6 rounded-xl cursor-pointer hover:bg-white/20 transition-all duration-300"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold">{insight.category}</h3>
                            <div className="flex items-center space-x-2">
                              <div className="w-12 h-2 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${insight.confidence}%` }}
                                  transition={{ delay: index * 0.1 + 0.5, duration: 1 }}
                                  className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full"
                                />
                              </div>
                              <span className="text-white/70 text-sm">{insight.confidence}%</span>
                            </div>
                          </div>
                          
                          <p className="text-white/80 text-sm leading-relaxed mb-4">
                            {insight.insight}
                          </p>
                          
                          {insight.actionable && (
                            <div className="p-3 bg-white/10 rounded-lg">
                              <p className="text-white/70 text-xs">
                                <span className="text-white font-medium">Action:</span> {insight.actionable}
                              </p>
                            </div>
                          )}
                          
                          <div className="mt-3 flex flex-wrap gap-1">
                            {insight.sources.map((source) => (
                              <span
                                key={source}
                                className="text-xs bg-white/10 text-white/60 px-2 py-1 rounded-full"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </GlassCard>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Personality Type', value: intakeData?.personalityResult?.mbtiType || 'N/A', icon: '🧠' },
                      { label: 'Sun Sign', value: intakeData?.astrologicalResult?.western?.sunSign || 'N/A', icon: '☀️' },
                      { label: 'Chinese Animal', value: intakeData?.astrologicalResult?.chinese?.animalSign || 'N/A', icon: '🐉' },
                      { label: 'Life Path', value: intakeData?.astrologicalResult?.numerology?.lifePathNumber || 'N/A', icon: '🔢' }
                    ].map((stat, index) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className="glass-card-enhanced p-4 rounded-xl text-center"
                      >
                        <div className="text-2xl mb-2">{stat.icon}</div>
                        <div className="text-white font-bold text-lg">{stat.value}</div>
                        <div className="text-white/60 text-sm">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              {activeSection === 'personality' && intakeData?.personalityResult && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>🧠</span>
                    <span>Personality Analysis</span>
                  </h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* MBTI */}
                    <div className="space-y-4">
                      <div className="glass-card-enhanced p-6 rounded-xl text-center">
                        <h3 className="text-white font-semibold mb-3">MBTI Type</h3>
                        <div className="text-4xl font-bold text-white mb-2">
                          {intakeData.personalityResult.mbtiType}
                        </div>
                        <p className="text-white/70">{intakeData.personalityResult.description}</p>
                      </div>
                      
                      {intakeData.personalityResult.dominantTraits.length > 0 && (
                        <div className="glass-card-enhanced p-4 rounded-xl">
                          <h4 className="text-white font-semibold mb-3">Key Strengths</h4>
                          <div className="flex flex-wrap gap-2">
                            {intakeData.personalityResult.dominantTraits.map((trait: string, index: number) => (
                              <motion.span
                                key={trait}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white/20 text-white px-3 py-1 rounded-full text-sm"
                              >
                                {trait}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Big Five */}
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <h3 className="text-white font-semibold mb-4">Big Five Profile</h3>
                      <div className="space-y-4">
                        {Object.entries(intakeData.personalityResult.big5Profile).map(([trait, score], index) => (
                          <motion.div
                            key={trait}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="space-y-2"
                          >
                            <div className="flex justify-between text-sm">
                              <span className="text-white/80 capitalize">{trait}</span>
                              <span className="text-white font-medium">{Math.round(score as number)}%</span>
                            </div>
                            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${score}%` }}
                                transition={{ duration: 1, delay: 0.3 + index * 0.1 }}
                                className={`h-full rounded-full bg-gradient-to-r ${
                                  trait === 'openness' ? 'from-blue-400 to-indigo-400' :
                                  trait === 'conscientiousness' ? 'from-green-400 to-emerald-400' :
                                  trait === 'extraversion' ? 'from-yellow-400 to-orange-400' :
                                  trait === 'agreeableness' ? 'from-pink-400 to-rose-400' :
                                  'from-purple-400 to-violet-400'
                                }`}
                                style={{ width: `${score as number}%` }}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
              
              {activeSection === 'western' && intakeData?.astrologicalResult?.western && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>♈</span>
                    <span>Western Astrology</span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Big Three */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { title: 'Sun Sign', value: intakeData.astrologicalResult.western.sunSign, desc: 'Core Identity', color: 'from-yellow-400 to-orange-400' },
                        { title: 'Moon Sign', value: intakeData.astrologicalResult.western.moonSign, desc: 'Emotional Nature', color: 'from-blue-400 to-indigo-400' },
                        { title: 'Rising Sign', value: intakeData.astrologicalResult.western.risingSign, desc: 'Outer Persona', color: 'from-purple-400 to-pink-400' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.2 }}
                          className="glass-card-enhanced p-6 rounded-xl text-center"
                        >
                          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-4 flex items-center justify-center`}>
                            <span className="text-white font-bold text-2xl">♈</span>
                          </div>
                          <h4 className="text-white font-semibold">{item.title}</h4>
                          <p className="text-2xl font-bold text-white my-2">{item.value}</p>
                          <p className="text-white/70 text-sm">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Houses & Planets */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h3 className="text-white font-semibold mb-4">Astrological Houses</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(intakeData.astrologicalResult.western.houses).map(([house, sign], index) => (
                            <motion.div
                              key={house}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex justify-between items-center p-2 bg-white/10 rounded-lg"
                            >
                              <span className="text-white/70 capitalize">{house}</span>
                              <span className="text-white font-medium">{sign as string}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h3 className="text-white font-semibold mb-4">Planetary Placements</h3>
                        <div className="space-y-2 text-sm">
                          {Object.entries(intakeData.astrologicalResult.western.planetaryPlacements).map(([planet, sign], index) => (
                            <motion.div
                              key={planet}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex justify-between items-center p-2 bg-white/10 rounded-lg"
                            >
                              <span className="text-white/70 capitalize">{planet}</span>
                              <span className="text-white font-medium">{sign as string}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
              
              {activeSection === 'eastern' && intakeData?.astrologicalResult?.chinese && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>🐉</span>
                    <span>Chinese Astrology</span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Main Animal */}
                    <div className="glass-card-enhanced p-8 rounded-xl text-center">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", duration: 1 }}
                        className="w-32 h-32 rounded-full bg-gradient-to-br from-red-400 to-yellow-400 mx-auto mb-6 flex items-center justify-center"
                      >
                        <span className="text-6xl">🐉</span>
                      </motion.div>
                      <h3 className="text-4xl font-bold text-white mb-2">
                        {intakeData.astrologicalResult.chinese.animalSign}
                      </h3>
                      <p className="text-white/70 text-lg">
                        Year of the {intakeData.astrologicalResult.chinese.animalSign}
                      </p>
                    </div>
                    
                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="glass-card-enhanced p-4 rounded-xl">
                        <h4 className="text-white font-semibold mb-3">Elements & Energy</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/70">Element</span>
                            <span className="text-white font-medium">{intakeData.astrologicalResult.chinese.element}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Polarity</span>
                            <span className="text-white font-medium">{intakeData.astrologicalResult.chinese.yinYang}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Life Phase</span>
                            <span className="text-white font-medium">{intakeData.astrologicalResult.chinese.lifePhase}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="glass-card-enhanced p-4 rounded-xl">
                        <h4 className="text-white font-semibold mb-3">Hidden Animals</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/70">Inner Animal</span>
                            <span className="text-white font-medium">{intakeData.astrologicalResult.chinese.innerAnimal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Secret Animal</span>
                            <span className="text-white font-medium">{intakeData.astrologicalResult.chinese.secretAnimal}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="glass-card-enhanced p-4 rounded-xl">
                        <h4 className="text-white font-semibold mb-3">Lucky Elements</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-white/70 text-sm">Numbers: </span>
                            <span className="text-white font-medium">
                              {intakeData.astrologicalResult.chinese.luckyNumbers.join(', ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/70 text-sm">Colors: </span>
                            <div className="flex gap-1 mt-1">
                              {intakeData.astrologicalResult.chinese.luckyColors.map((color: string) => (
                                <span
                                  key={color}
                                  className="text-xs bg-white/20 text-white px-2 py-1 rounded-full"
                                >
                                  {color}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Personality Traits */}
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <h4 className="text-white font-semibold mb-4">Personality Traits</h4>
                      <div className="flex flex-wrap gap-3">
                        {intakeData.astrologicalResult.chinese.personality.map((trait: string, index: number) => (
                          <motion.span
                            key={trait}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-gradient-to-r from-red-400/20 to-yellow-400/20 text-white px-4 py-2 rounded-full border border-white/20"
                          >
                            {trait}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
              
              {activeSection === 'african' && intakeData?.astrologicalResult?.african && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>⚡</span>
                    <span>African Wisdom Traditions</span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Orisha Guardian */}
                    <div className="glass-card-enhanced p-8 rounded-xl text-center">
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", duration: 1.2 }}
                        className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-indigo-400 mx-auto mb-6 flex items-center justify-center"
                      >
                        <span className="text-6xl">⚡</span>
                      </motion.div>
                      <h3 className="text-4xl font-bold text-white mb-2">
                        {intakeData.astrologicalResult.african.orishaGuardian}
                      </h3>
                      <p className="text-white/70 text-lg">Your Orisha Guardian</p>
                    </div>
                    
                    {/* Spiritual Profile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h4 className="text-white font-semibold mb-4">Spiritual Gifts</h4>
                        <div className="space-y-3">
                          {intakeData.astrologicalResult.african.spiritualGifts.map((gift: string, index: number) => (
                            <motion.div
                              key={gift}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg"
                            >
                              <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                              <span className="text-white">{gift}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h4 className="text-white font-semibold mb-4">Sacred Path</h4>
                        <div className="space-y-3">
                          <div className="p-3 bg-white/10 rounded-lg">
                            <div className="text-white/70 text-sm">Life Destiny</div>
                            <div className="text-white font-medium">{intakeData.astrologicalResult.african.lifeDestiny}</div>
                          </div>
                          <div className="p-3 bg-white/10 rounded-lg">
                            <div className="text-white/70 text-sm">Sacred Animal</div>
                            <div className="text-white font-medium">{intakeData.astrologicalResult.african.sacredAnimal}</div>
                          </div>
                          <div className="p-3 bg-white/10 rounded-lg">
                            <div className="text-white/70 text-sm">Elemental Force</div>
                            <div className="text-white font-medium">{intakeData.astrologicalResult.african.elementalForce}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Ceremonies & Challenges */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h4 className="text-white font-semibold mb-4">Sacred Ceremonies</h4>
                        <div className="space-y-2">
                          {intakeData.astrologicalResult.african.ceremonies.map((ceremony: string, index: number) => (
                            <motion.div
                              key={ceremony}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white/10 text-white px-3 py-2 rounded-lg text-center"
                            >
                              {ceremony}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h4 className="text-white font-semibold mb-4">Growth Challenges</h4>
                        <div className="space-y-2">
                          {intakeData.astrologicalResult.african.challenges.map((challenge: string, index: number) => (
                            <motion.div
                              key={challenge}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white/10 text-white px-3 py-2 rounded-lg text-center"
                            >
                              {challenge}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
              
              {activeSection === 'numerology' && intakeData?.astrologicalResult?.numerology && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>🔢</span>
                    <span>Sacred Numerology</span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Core Numbers */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { title: 'Life Path', value: intakeData.astrologicalResult.numerology.lifePathNumber, color: 'from-blue-400 to-cyan-400', desc: 'Your spiritual journey' },
                        { title: 'Destiny', value: intakeData.astrologicalResult.numerology.destinyNumber, color: 'from-green-400 to-emerald-400', desc: 'Your life purpose' },
                        { title: 'Soul Urge', value: intakeData.astrologicalResult.numerology.soulUrgeNumber, color: 'from-purple-400 to-violet-400', desc: 'Inner desires' },
                        { title: 'Personality', value: intakeData.astrologicalResult.numerology.personalityNumber, color: 'from-pink-400 to-rose-400', desc: 'How others see you' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-card-enhanced p-6 rounded-xl text-center"
                        >
                          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-4 flex items-center justify-center`}>
                            <span className="text-white font-bold text-3xl">{item.value}</span>
                          </div>
                          <h4 className="text-white font-semibold">{item.title}</h4>
                          <p className="text-white/60 text-sm mt-1">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Number Meanings */}
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <h3 className="text-white font-semibold mb-4">Number Interpretations</h3>
                      <div className="space-y-4">
                        {Object.entries(intakeData.astrologicalResult.numerology.meanings).map(([key, meaning], index) => (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 bg-white/10 rounded-lg"
                          >
                            <h4 className="text-white font-medium mb-2 capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                            <p className="text-white/80 text-sm leading-relaxed">{meaning as string}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
              
              {activeSection === 'guidance' && intakeData?.astrologicalResult?.synthesis && (
                <GlassCard enhanced gradient className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                    <span>🧭</span>
                    <span>Integrated Life Guidance</span>
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Core Themes */}
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <h3 className="text-white font-semibold mb-4">Core Life Themes</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {intakeData.astrologicalResult.synthesis.coreThemes.map((theme: string, index: number) => (
                          <motion.div
                            key={theme}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.2 }}
                            className="p-6 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-xl text-center border border-white/10"
                          >
                            <div className="text-3xl mb-2">✨</div>
                            <span className="text-white font-medium text-lg">{theme}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Life Guidance Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { title: 'Life Direction', content: intakeData.astrologicalResult.synthesis.lifeDirection, icon: '🌟', color: 'from-yellow-400 to-orange-400' },
                        { title: 'Spiritual Path', content: intakeData.astrologicalResult.synthesis.spiritualPath, icon: '🔮', color: 'from-purple-400 to-indigo-400' },
                        { title: 'Relationships', content: intakeData.astrologicalResult.synthesis.relationships, icon: '💫', color: 'from-pink-400 to-rose-400' },
                        { title: 'Career Path', content: intakeData.astrologicalResult.synthesis.career, icon: '⚡', color: 'from-blue-400 to-cyan-400' },
                        { title: 'Wellness', content: intakeData.astrologicalResult.synthesis.wellness, icon: '🌿', color: 'from-green-400 to-emerald-400' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-card-enhanced p-6 rounded-xl"
                        >
                          <div className="flex items-center space-x-3 mb-4">
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                              <span className="text-xl">{item.icon}</span>
                            </div>
                            <h4 className="text-white font-semibold text-lg">{item.title}</h4>
                          </div>
                          <p className="text-white/80 leading-relaxed">{item.content}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex justify-center space-x-4 mt-8 pb-8"
        >
          <GlassButton
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20"
          >
            <span className="flex items-center space-x-2">
              <span>📄</span>
              <span>Save PDF</span>
            </span>
          </GlassButton>
          
          <GlassButton
            onClick={() => {
              const shareData = {
                title: 'My Cosmic Blueprint',
                text: 'Check out my comprehensive personality and astrological profile!',
                url: window.location.href
              };
              if (navigator.share) {
                navigator.share(shareData);
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30"
          >
            <span className="flex items-center space-x-2">
              <span>🔗</span>
              <span>Share</span>
            </span>
          </GlassButton>
          
          <GlassButton
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-green-400/20 to-emerald-400/20 hover:from-green-400/30 hover:to-emerald-400/30"
          >
            <span className="flex items-center space-x-2">
              <span>🏠</span>
              <span>Dashboard</span>
            </span>
          </GlassButton>
        </motion.div>
      </div>

      {/* Insight Detail Modal */}
      <AnimatePresence>
        {selectedInsight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedInsight(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-2xl w-full"
            >
              <GlassCard enhanced gradient className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold text-white">{selectedInsight.category}</h3>
                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="p-6 bg-white/10 rounded-xl">
                    <p className="text-white leading-relaxed text-lg">{selectedInsight.insight}</p>
                  </div>
                  
                  {selectedInsight.actionable && (
                    <div className="p-6 bg-gradient-to-r from-green-400/20 to-emerald-400/20 rounded-xl border border-green-400/30">
                      <h4 className="text-white font-semibold mb-2">Actionable Guidance</h4>
                      <p className="text-white/90">{selectedInsight.actionable}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <span className="text-white/70">Confidence Level:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-3 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full"
                            style={{ width: `${selectedInsight.confidence}%` }}
                          />
                        </div>
                        <span className="text-white font-medium">{selectedInsight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-white font-semibold mb-2">Based on:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedInsight.sources.map((source) => (
                        <span
                          key={source}
                          className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-sm"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResultsStep;
