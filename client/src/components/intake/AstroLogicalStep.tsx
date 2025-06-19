// src/components/intake/AstrologicalStep.tsx
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Enhanced Types for Multi-Cultural Astrology
interface BirthData {
  date: string;
  time: string;
  location: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface WesternAstrology {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  houses: {
    first: string;    // House of Self
    second: string;   // House of Values
    third: string;    // House of Communication
    fourth: string;   // House of Home
    fifth: string;    // House of Creativity
    sixth: string;    // House of Service
    seventh: string;  // House of Partnerships
    eighth: string;   // House of Transformation
    ninth: string;    // House of Philosophy
    tenth: string;    // House of Career
    eleventh: string; // House of Friendships
    twelfth: string;  // House of Spirituality
  };
  planetaryPlacements: {
    mercury: string;
    venus: string;
    mars: string;
    jupiter: string;
    saturn: string;
    uranus: string;
    neptune: string;
    pluto: string;
  };
  dominantElement: string;
  modality: string;
  chartRuler: string;
}

interface ChineseAstrology {
  animalSign: string;
  element: string;
  yinYang: string;
  innerAnimal: string; // Month
  secretAnimal: string; // Hour
  luckyNumbers: number[];
  luckyColors: string[];
  personality: string[];
  compatibility: string[];
  lifePhase: string;
}

interface AfricanAstrology {
  // Based on traditional African systems like Yoruba Ifa
  orishaGuardian: string;
  ancestralSpirit: string;
  elementalForce: string;
  sacredAnimal: string;
  lifeDestiny: string;
  spiritualGifts: string[];
  challenges: string[];
  ceremonies: string[];
  seasons: string;
}

interface NumerologyProfile {
  lifePathNumber: number;
  destinyNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthDayNumber: number;
  meanings: Record<string, string>;
}

interface AstrologicalResult {
  western: WesternAstrology;
  chinese: ChineseAstrology;
  african: AfricanAstrology;
  numerology: NumerologyProfile;
  synthesis: {
    coreThemes: string[];
    lifeDirection: string;
    spiritualPath: string;
    relationships: string;
    career: string;
    wellness: string;
  };
}

// Comprehensive Astrological Data
const zodiacSigns = [
  { name: 'Aries', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', dates: '3/21-4/19' },
  { name: 'Taurus', element: 'Earth', modality: 'Fixed', ruler: 'Venus', dates: '4/20-5/20' },
  { name: 'Gemini', element: 'Air', modality: 'Mutable', ruler: 'Mercury', dates: '5/21-6/20' },
  { name: 'Cancer', element: 'Water', modality: 'Cardinal', ruler: 'Moon', dates: '6/21-7/22' },
  { name: 'Leo', element: 'Fire', modality: 'Fixed', ruler: 'Sun', dates: '7/23-8/22' },
  { name: 'Virgo', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', dates: '8/23-9/22' },
  { name: 'Libra', element: 'Air', modality: 'Cardinal', ruler: 'Venus', dates: '9/23-10/22' },
  { name: 'Scorpio', element: 'Water', modality: 'Fixed', ruler: 'Pluto', dates: '10/23-11/21' },
  { name: 'Sagittarius', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', dates: '11/22-12/21' },
  { name: 'Capricorn', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', dates: '12/22-1/19' },
  { name: 'Aquarius', element: 'Air', modality: 'Fixed', ruler: 'Uranus', dates: '1/20-2/18' },
  { name: 'Pisces', element: 'Water', modality: 'Mutable', ruler: 'Neptune', dates: '2/19-3/20' }
];

const chineseZodiac = [
  { animal: 'Rat', element: 'Water', years: [1924, 1936, 1948, 1960, 1972, 1984, 1996, 2008, 2020], traits: ['Intelligent', 'Adaptable', 'Quick-witted'] },
  { animal: 'Ox', element: 'Earth', years: [1925, 1937, 1949, 1961, 1973, 1985, 1997, 2009, 2021], traits: ['Reliable', 'Patient', 'Honest'] },
  { animal: 'Tiger', element: 'Wood', years: [1926, 1938, 1950, 1962, 1974, 1986, 1998, 2010, 2022], traits: ['Brave', 'Confident', 'Competitive'] },
  { animal: 'Rabbit', element: 'Wood', years: [1927, 1939, 1951, 1963, 1975, 1987, 1999, 2011, 2023], traits: ['Gentle', 'Elegant', 'Responsible'] },
  { animal: 'Dragon', element: 'Earth', years: [1928, 1940, 1952, 1964, 1976, 1988, 2000, 2012, 2024], traits: ['Energetic', 'Ambitious', 'Charismatic'] },
  { animal: 'Snake', element: 'Fire', years: [1929, 1941, 1953, 1965, 1977, 1989, 2001, 2013, 2025], traits: ['Wise', 'Intuitive', 'Mysterious'] },
  { animal: 'Horse', element: 'Fire', years: [1930, 1942, 1954, 1966, 1978, 1990, 2002, 2014, 2026], traits: ['Energetic', 'Independent', 'Impatient'] },
  { animal: 'Goat', element: 'Earth', years: [1931, 1943, 1955, 1967, 1979, 1991, 2003, 2015, 2027], traits: ['Calm', 'Gentle', 'Sympathetic'] },
  { animal: 'Monkey', element: 'Metal', years: [1932, 1944, 1956, 1968, 1980, 1992, 2004, 2016, 2028], traits: ['Sharp', 'Smart', 'Curious'] },
  { animal: 'Rooster', element: 'Metal', years: [1933, 1945, 1957, 1969, 1981, 1993, 2005, 2017, 2029], traits: ['Observant', 'Hardworking', 'Courageous'] },
  { animal: 'Dog', element: 'Earth', years: [1934, 1946, 1958, 1970, 1982, 1994, 2006, 2018, 2030], traits: ['Loyal', 'Responsible', 'Reliable'] },
  { animal: 'Pig', element: 'Water', years: [1935, 1947, 1959, 1971, 1983, 1995, 2007, 2019, 2031], traits: ['Honest', 'Generous', 'Reliable'] }
];

const africanOrishas = [
  { name: 'Elegua', domain: 'Crossroads & Opportunities', element: 'All Elements', colors: ['Red', 'Black'], gifts: ['Communication', 'Opening Doors'] },
  { name: 'Ogun', domain: 'Iron & War', element: 'Fire', colors: ['Green', 'Black'], gifts: ['Strength', 'Technology', 'Protection'] },
  { name: 'Yemoja', domain: 'Motherhood & Ocean', element: 'Water', colors: ['Blue', 'White'], gifts: ['Nurturing', 'Healing', 'Wisdom'] },
  { name: 'Shango', domain: 'Thunder & Justice', element: 'Fire', colors: ['Red', 'White'], gifts: ['Leadership', 'Passion', 'Justice'] },
  { name: 'Oya', domain: 'Wind & Change', element: 'Air', colors: ['Purple', 'Burgundy'], gifts: ['Transformation', 'Courage', 'Intuition'] },
  { name: 'Osun', domain: 'Love & Rivers', element: 'Water', colors: ['Yellow', 'Gold'], gifts: ['Love', 'Fertility', 'Abundance'] },
  { name: 'Obatala', domain: 'Wisdom & Purity', element: 'Air', colors: ['White'], gifts: ['Wisdom', 'Peace', 'Clarity'] },
  { name: 'Orunmila', domain: 'Wisdom & Divination', element: 'Spirit', colors: ['Yellow', 'Green'], gifts: ['Prophecy', 'Healing', 'Knowledge'] }
];

// Calculation Functions
const calculateWesternAstrology = (birthDate: Date): WesternAstrology => {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  
  // Simplified sun sign calculation
  let sunSign = '';
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) sunSign = 'Aries';
  else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) sunSign = 'Taurus';
  else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) sunSign = 'Gemini';
  else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) sunSign = 'Cancer';
  else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) sunSign = 'Leo';
  else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) sunSign = 'Virgo';
  else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) sunSign = 'Libra';
  else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) sunSign = 'Scorpio';
  else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) sunSign = 'Sagittarius';
  else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) sunSign = 'Capricorn';
  else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) sunSign = 'Aquarius';
  else sunSign = 'Pisces';
  
  // Simplified calculations for demonstration
  const signIndex = zodiacSigns.findIndex(sign => sign.name === sunSign);
  const moonSignIndex = (signIndex + 4) % 12;
  const risingSignIndex = (signIndex + 8) % 12;
  
  const moonSign = zodiacSigns[moonSignIndex].name;
  const risingSign = zodiacSigns[risingSignIndex].name;
  
  return {
    sunSign,
    moonSign,
    risingSign,
    houses: {
      first: risingSign,
      second: zodiacSigns[(risingSignIndex + 1) % 12].name,
      third: zodiacSigns[(risingSignIndex + 2) % 12].name,
      fourth: zodiacSigns[(risingSignIndex + 3) % 12].name,
      fifth: zodiacSigns[(risingSignIndex + 4) % 12].name,
      sixth: zodiacSigns[(risingSignIndex + 5) % 12].name,
      seventh: zodiacSigns[(risingSignIndex + 6) % 12].name,
      eighth: zodiacSigns[(risingSignIndex + 7) % 12].name,
      ninth: zodiacSigns[(risingSignIndex + 8) % 12].name,
      tenth: zodiacSigns[(risingSignIndex + 9) % 12].name,
      eleventh: zodiacSigns[(risingSignIndex + 10) % 12].name,
      twelfth: zodiacSigns[(risingSignIndex + 11) % 12].name
    },
    planetaryPlacements: {
      mercury: zodiacSigns[(signIndex + 1) % 12].name,
      venus: zodiacSigns[(signIndex + 2) % 12].name,
      mars: zodiacSigns[(signIndex + 3) % 12].name,
      jupiter: zodiacSigns[(signIndex + 5) % 12].name,
      saturn: zodiacSigns[(signIndex + 7) % 12].name,
      uranus: zodiacSigns[(signIndex + 9) % 12].name,
      neptune: zodiacSigns[(signIndex + 10) % 12].name,
      pluto: zodiacSigns[(signIndex + 11) % 12].name
    },
    dominantElement: zodiacSigns[signIndex].element,
    modality: zodiacSigns[signIndex].modality,
    chartRuler: zodiacSigns[signIndex].ruler
  };
};

const calculateChineseAstrology = (birthDate: Date): ChineseAstrology => {
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const hour = birthDate.getHours();
  
  // Find animal sign
  const animalData = chineseZodiac.find(animal => 
    animal.years.some(y => Math.abs(y - year) % 12 === 0)
  ) || chineseZodiac[0];
  
  // Calculate element cycle (60-year cycle)
  const elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  const elementIndex = Math.floor(((year - 1924) % 60) / 12);
  const yearElement = elements[elementIndex];
  
  // Inner animal (month)
  const innerAnimals = ['Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 
                       'Monkey', 'Rooster', 'Dog', 'Pig', 'Rat', 'Ox'];
  const innerAnimal = innerAnimals[month - 1];
  
  // Secret animal (hour)
  const secretAnimals = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
                        'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const secretAnimal = secretAnimals[Math.floor(hour / 2)];
  
  return {
    animalSign: animalData.animal,
    element: yearElement,
    yinYang: year % 2 === 0 ? 'Yang' : 'Yin',
    innerAnimal,
    secretAnimal,
    luckyNumbers: [3, 4, 9],
    luckyColors: ['Blue', 'Gold', 'Green'],
    personality: animalData.traits,
    compatibility: ['Dragon', 'Monkey', 'Ox'],
    lifePhase: year < 1980 ? 'Wisdom' : year < 2000 ? 'Achievement' : 'Growth'
  };
};

const calculateAfricanAstrology = (birthDate: Date): AfricanAstrology => {
  const dayOfYear = Math.floor((birthDate.getTime() - new Date(birthDate.getFullYear(), 0, 0).getTime()) / 86400000);
  const orishaIndex = Math.floor((dayOfYear / 365) * africanOrishas.length);
  const orisha = africanOrishas[orishaIndex];
  
  return {
    orishaGuardian: orisha.name,
    ancestralSpirit: 'Wise Elder',
    elementalForce: orisha.element,
    sacredAnimal: 'Eagle',
    lifeDestiny: 'Healer and Guide',
    spiritualGifts: orisha.gifts,
    challenges: ['Patience', 'Balance'],
    ceremonies: ['Water Blessing', 'Fire Ceremony'],
    seasons: 'Dry Season'
  };
};

const calculateNumerology = (birthDate: Date, fullName: string): NumerologyProfile => {
  console.log(`Analyzing numeric traits of ${fullName}`)
  const lifePathNumber = birthDate.getDate() + birthDate.getMonth() + 1 + birthDate.getFullYear();
  const reducedLifePath = String(lifePathNumber).split('').reduce((sum, digit) => sum + parseInt(digit), 0) % 9 || 9;
  
  return {
    lifePathNumber: reducedLifePath,
    destinyNumber: 7,
    soulUrgeNumber: 3,
    personalityNumber: 4,
    birthDayNumber: birthDate.getDate(),
    meanings: {
      lifePath: `Life Path ${reducedLifePath}: Your journey toward spiritual growth and self-discovery`,
      destiny: 'Destiny 7: Seeker of truth and wisdom',
      soulUrge: 'Soul Urge 3: Creative expression and communication',
      personality: 'Personality 4: Practical, reliable, and organized'
    }
  };
};

const AstrologicalStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  
  // State Management
  const [currentStep, setCurrentStep] = useState(0);
  const [birthData, setBirthData] = useState<BirthData>({
    date: '',
    time: '',
    location: ''
  });
  const [result, setResult] = useState<AstrologicalResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [activeTab, setActiveTab] = useState('western');
  const [isCalculating, setIsCalculating] = useState(false);
  
  const steps = ['Birth Info', 'Location', 'Calculate', 'Results'];
  const progress = ((currentStep + 1) / steps.length) * 100;
  
  // Memoized calculations
  const calculateAllAstrology = useCallback(() => {
    if (!birthData.date || !birthData.time) return;
    
    setIsCalculating(true);
    
    // Simulate calculation time for dramatic effect
    setTimeout(() => {
      const birthDate = new Date(`${birthData.date}T${birthData.time}`);
      
      const western = calculateWesternAstrology(birthDate);
      const chinese = calculateChineseAstrology(birthDate);
      const african = calculateAfricanAstrology(birthDate);
      const numerology = calculateNumerology(birthDate, 'User Name');
      
      const synthesis = {
        coreThemes: ['Transformation', 'Leadership', 'Creativity'],
        lifeDirection: 'Spiritual teacher and healer',
        spiritualPath: 'Integration of ancient wisdom with modern understanding',
        relationships: 'Deep, transformative connections with kindred spirits',
        career: 'Healing arts, education, or creative expression',
        wellness: 'Balance through meditation, nature, and creative outlets'
      };
      
      const astrologicalResult: AstrologicalResult = {
        western,
        chinese,
        african,
        numerology,
        synthesis
      };
      
      setResult(astrologicalResult);
      updateIntake({ astrologicalResult });
      setIsCalculating(false);
      setShowResult(true);
    }, 3000);
  }, [birthData, updateIntake]);
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      if (currentStep === 2) {
        calculateAllAstrology();
      }
    } else {
      navigate('/intake/iq');
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return birthData.date && birthData.time;
      case 1: return birthData.location;
      case 2: return !isCalculating;
      case 3: return true;
      default: return false;
    }
  }, [currentStep, birthData, isCalculating]);
  
  // Animated tab content
  const renderTabContent = () => {
    if (!result) return null;
    
    switch (activeTab) {
      case 'western':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Sun, Moon, Rising */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Sun Sign', value: result.western.sunSign, desc: 'Core Identity', color: 'from-yellow-400 to-orange-400' },
                { title: 'Moon Sign', value: result.western.moonSign, desc: 'Emotional Nature', color: 'from-blue-400 to-indigo-400' },
                { title: 'Rising Sign', value: result.western.risingSign, desc: 'Outer Persona', color: 'from-purple-400 to-pink-400' }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.2 }}
                  className="glass-card-enhanced p-4 rounded-xl text-center"
                >
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-3 flex items-center justify-center`}>
                    <span className="text-white font-bold text-lg">♈</span>
                  </div>
                  <h4 className="text-white font-semibold">{item.title}</h4>
                  <p className="text-2xl font-bold text-white my-2">{item.value}</p>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            
            {/* Houses */}
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h3 className="text-white font-semibold mb-4">Astrological Houses</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(result.western.houses).map(([house, sign], index) => (
                  <motion.div
                    key={house}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex justify-between items-center p-2 bg-white/10 rounded-lg"
                  >
                    <span className="text-white/80 text-sm capitalize">{house}</span>
                    <span className="text-white font-medium">{sign}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        );
        
      case 'chinese':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Main Animal */}
            <div className="glass-card-enhanced p-6 rounded-xl text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-yellow-400 mx-auto mb-4 flex items-center justify-center"
              >
                <span className="text-4xl">🐉</span>
              </motion.div>
              <h3 className="text-3xl font-bold text-white mb-2">{result.chinese.animalSign}</h3>
              <p className="text-white/70">Year of the {result.chinese.animalSign}</p>
            </div>
            
            {/* Elements and Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-3">Elements & Energy</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Element</span>
                    <span className="text-white font-medium">{result.chinese.element}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Polarity</span>
                    <span className="text-white font-medium">{result.chinese.yinYang}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Inner Animal</span>
                    <span className="text-white font-medium">{result.chinese.innerAnimal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Secret Animal</span>
                    <span className="text-white font-medium">{result.chinese.secretAnimal}</span>
                  </div>
                </div>
              </div>
              
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-3">Personality Traits</h4>
                <div className="flex flex-wrap gap-2">
                  {result.chinese.personality.map((trait, index) => (
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
            </div>
          </motion.div>
        );
        
      case 'african':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Orisha Guardian */}
            <div className="glass-card-enhanced p-6 rounded-xl text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 1 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-indigo-400 mx-auto mb-4 flex items-center justify-center"
              >
                <span className="text-4xl">⚡</span>
              </motion.div>
              <h3 className="text-3xl font-bold text-white mb-2">{result.african.orishaGuardian}</h3>
              <p className="text-white/70">Your Orisha Guardian</p>
            </div>
            
            {/* Spiritual Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-3">Spiritual Gifts</h4>
                <div className="space-y-2">
                  {result.african.spiritualGifts.map((gift, index) => (
                    <motion.div
                      key={gift}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center space-x-2"
                    >
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                      <span className="text-white">{gift}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-3">Life Path</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Destiny</span>
                    <span className="text-white font-medium">{result.african.lifeDestiny}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Sacred Animal</span>
                    <span className="text-white font-medium">{result.african.sacredAnimal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Element</span>
                    <span className="text-white font-medium">{result.african.elementalForce}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
        
      case 'numerology':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Core Numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: 'Life Path', value: result.numerology.lifePathNumber, color: 'from-blue-400 to-cyan-400' },
                { title: 'Destiny', value: result.numerology.destinyNumber, color: 'from-green-400 to-emerald-400' },
                { title: 'Soul Urge', value: result.numerology.soulUrgeNumber, color: 'from-purple-400 to-violet-400' },
                { title: 'Personality', value: result.numerology.personalityNumber, color: 'from-pink-400 to-rose-400' }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card-enhanced p-4 rounded-xl text-center"
                >
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-3 flex items-center justify-center`}>
                    <span className="text-white font-bold text-2xl">{item.value}</span>
                  </div>
                  <h4 className="text-white font-medium">{item.title}</h4>
                </motion.div>
              ))}
            </div>
            
            {/* Number Meanings */}
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h4 className="text-white font-semibold mb-4">Number Meanings</h4>
              <div className="space-y-3">
                {Object.entries(result.numerology.meanings).map(([key, meaning], index) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-white/10 rounded-lg"
                  >
                    <p className="text-white">{meaning}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        );
        
      case 'synthesis':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Core Themes */}
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h4 className="text-white font-semibold mb-4">Core Life Themes</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.synthesis.coreThemes.map((theme, index) => (
                  <motion.div
                    key={theme}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.2 }}
                    className="p-4 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-lg text-center"
                  >
                    <span className="text-white font-medium">{theme}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Life Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Life Direction', content: result.synthesis.lifeDirection, icon: '🌟' },
                { title: 'Spiritual Path', content: result.synthesis.spiritualPath, icon: '🔮' },
                { title: 'Relationships', content: result.synthesis.relationships, icon: '💫' },
                { title: 'Career', content: result.synthesis.career, icon: '⚡' },
                { title: 'Wellness', content: result.synthesis.wellness, icon: '🌿' }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card-enhanced p-4 rounded-xl"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-2xl">{item.icon}</span>
                    <h5 className="text-white font-semibold">{item.title}</h5>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{item.content}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />
      
      {/* Cosmic Gradient Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-purple-900/30 to-pink-900/50 pointer-events-none"
      />
      
      {/* Floating Cosmic Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: 0
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              scale: [0, 1, 0],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-2 h-2 bg-gradient-to-r from-white to-purple-300 rounded-full"
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="w-full max-w-4xl"
        >
          <GlassCard enhanced gradient className="space-y-6 max-h-[90vh] overflow-y-auto mx-4">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 via-indigo-400 to-pink-400 flex items-center justify-center"
                >
                  <span className="text-2xl">🌟</span>
                </motion.div>
              </div>
              
              <h2 className="text-4xl font-bold text-white text-shadow-soft">
                Cosmic Blueprint
              </h2>
              <p className="text-white/80 max-w-2xl mx-auto">
                {showResult 
                  ? 'Your complete astrological profile across cultures and traditions'
                  : 'Discover your celestial signature through Western, Chinese, and African astrological traditions'
                }
              </p>
            </motion.div>

            {/* Progress */}
            {!showResult && (
              <div className="glass-card-enhanced p-4 rounded-xl">
                <div className="flex justify-between text-sm text-white/70 mb-2">
                  <span>Step {currentStep + 1} of {steps.length}</span>
                  <span>{steps[currentStep]}</span>
                </div>
                <GlassProgress value={progress} max={100} />
              </div>
            )}

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  {/* Step 0: Birth Date & Time */}
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                          <span>🗓️</span>
                          <span>Birth Information</span>
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-white/80 text-sm">Birth Date</label>
                            <input
                              type="date"
                              value={birthData.date}
                              onChange={(e) => setBirthData(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-white/80 text-sm">Birth Time</label>
                            <input
                              type="time"
                              value={birthData.time}
                              onChange={(e) => setBirthData(prev => ({ ...prev, time: e.target.value }))}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4 p-4 bg-white/5 rounded-lg">
                          <p className="text-white/60 text-sm">
                            <span className="text-white/80 font-medium">Note:</span> Precise birth time is essential for accurate 
                            rising sign, house placements, and complete astrological analysis across all traditions.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Location */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-6 rounded-xl">
                        <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                          <span>📍</span>
                          <span>Birth Location</span>
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-white/80 text-sm">City, State/Province, Country</label>
                            <input
                              type="text"
                              value={birthData.location}
                              onChange={(e) => setBirthData(prev => ({ ...prev, location: e.target.value }))}
                              placeholder="e.g., New York, NY, USA"
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4 p-4 bg-white/5 rounded-lg">
                          <p className="text-white/60 text-sm">
                            <span className="text-white/80 font-medium">Why location matters:</span> Your birth location determines 
                            your astrological houses, rising sign accuracy, and connects you to regional spiritual traditions 
                            and ancestral energies.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Calculation */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-8 rounded-xl text-center">
                        {isCalculating ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                          >
                            {/* Cosmic Calculation Animation */}
                            <div className="relative">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-32 h-32 rounded-full border-4 border-white/20 border-t-white/60 mx-auto"
                              />
                              <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-4 w-24 h-24 rounded-full border-4 border-white/10 border-r-white/40"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl">🌌</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <h3 className="text-2xl font-bold text-white">Calculating Your Cosmic Blueprint</h3>
                              <div className="space-y-2">
                                {[
                                  'Aligning with celestial positions...',
                                  'Consulting ancient wisdom traditions...',
                                  'Synthesizing multi-cultural insights...',
                                  'Revealing your cosmic signature...'
                                ].map((text, index) => (
                                  <motion.p
                                    key={text}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.8 }}
                                    className="text-white/70"
                                  >
                                    {text}
                                  </motion.p>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-4"
                          >
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 mx-auto flex items-center justify-center">
                              <span className="text-3xl">✨</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white">Ready to Calculate</h3>
                            <p className="text-white/70">
                              Click below to generate your complete astrological profile across Western, 
                              Chinese, and African traditions, plus numerological insights.
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Results Display */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6"
                >
                  {/* Culture Tabs */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { id: 'western', name: 'Western', icon: '♈', color: 'from-blue-400 to-indigo-400' },
                      { id: 'chinese', name: 'Chinese', icon: '🐉', color: 'from-red-400 to-yellow-400' },
                      { id: 'african', name: 'African', icon: '⚡', color: 'from-purple-400 to-indigo-400' },
                      { id: 'numerology', name: 'Numbers', icon: '🔢', color: 'from-green-400 to-emerald-400' },
                      { id: 'synthesis', name: 'Synthesis', icon: '🌟', color: 'from-pink-400 to-violet-400' }
                    ].map((tab) => (
                      <motion.button
                        key={tab.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          px-4 py-2 rounded-full flex items-center space-x-2 transition-all duration-300
                          ${activeTab === tab.id 
                            ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }
                        `}
                      >
                        <span>{tab.icon}</span>
                        <span className="font-medium">{tab.name}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="min-h-96">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {renderTabContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-between items-center pt-6"
            >
              {currentStep > 0 && !showResult ? (
                <GlassButton
                  onClick={handlePrevious}
                  className="bg-white/10 hover:bg-white/20"
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Previous</span>
                  </span>
                </GlassButton>
              ) : <div />}
              
              <GlassButton
                onClick={handleNext}
                disabled={!canProceed}
                className={`
                  ${canProceed 
                    ? 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30' 
                    : 'bg-white/5 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <span className="flex items-center space-x-2">
                  <span>
                    {showResult ? 'Complete Profile' : 
                     currentStep === 2 ? (isCalculating ? 'Calculating...' : 'Calculate') : 'Next'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </GlassButton>
            </motion.div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default AstrologicalStep;
