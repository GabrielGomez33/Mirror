// src/components/intake/AstroLogicalStep.tsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

/**
 * PRODUCTION-READY AstroLogicalStep
 * - Client-only location resolution (Nominatim) → {label, lat, lon}
 * - Validates location; handles ambiguous results; formats for storage
 * - Computes REAL location-dependent Rising Sign + Whole Sign Houses
 * - Accessibility polish: labels, aria roles, live regions, keyboard tabs
 * - Layout consistency with Visual/Vocal/IQ steps
 */

// ----------------------------- Types -----------------------------


const SIGN_NAMES = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
] as const;
type SignName = typeof SIGN_NAMES[number];

type HouseMap = {
  first: SignName;
  second: SignName;
  third: SignName;
  fourth: SignName;
  fifth: SignName;
  sixth: SignName;
  seventh: SignName;
  eighth: SignName;
  ninth: SignName;
  tenth: SignName;
  eleventh: SignName;
  twelfth: SignName;
};

interface BirthData {
  date: string;          // 'YYYY-MM-DD'
  time: string;          // 'HH:mm'
  location: string;      // free text
  latitude?: number;
  longitude?: number;
  timezone?: string;     // reserved for later (IANA), not required for this minimal version
  resolvedLabel?: string;
}

interface WesternAstrology {
  sunSign: SignName;
  moonSign: SignName;
  risingSign: SignName;
  houses: HouseMap;
  planetaryPlacements: {
    mercury: SignName;
    venus: SignName;
    mars: SignName;
    jupiter: SignName;
    saturn: SignName;
    uranus: SignName;
    neptune: SignName;
    pluto: SignName;
  };
  dominantElement: string;
  modality: string;
  chartRuler: string;
}

interface ChineseAstrology {
  animalSign: string;
  element: string;
  yinYang: 'Yang' | 'Yin';
  innerAnimal: string;
  luckyNumbers: number[];
}

interface AfricanAstrology {
  orishaGuardian: string;
  elementalForce: string;
  sacredAnimal: string;
  lifeDestiny: string;
  spiritualGifts: string[];
  challenges: string[];
}

interface NumerologyProfile {
  lifePathNumber: number;
  destinyNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthDayNumber: number;
  meanings: Record<string,string>;
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
  }
}

type LocationResolveState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'ambiguous'; suggestions: ResolvedLocation[] }
  | { status: 'resolved' }
  | { status: 'error'; message: string };

interface ResolvedLocation {
  label: string;
  lat: number;
  lon: number;
}

type LocationFormat = 'label' | 'latlon' | 'pipe' | 'json';

// --------------------------- Constants ---------------------------

const SIGN_META: Record<SignName, { element: string; modality: string; ruler: string; }> = {
  Aries: { element: 'Fire', modality: 'Cardinal', ruler: 'Mars' },
  Taurus: { element: 'Earth', modality: 'Fixed', ruler: 'Venus' },
  Gemini: { element: 'Air', modality: 'Mutable', ruler: 'Mercury' },
  Cancer: { element: 'Water', modality: 'Cardinal', ruler: 'Moon' },
  Leo: { element: 'Fire', modality: 'Fixed', ruler: 'Sun' },
  Virgo: { element: 'Earth', modality: 'Mutable', ruler: 'Mercury' },
  Libra: { element: 'Air', modality: 'Cardinal', ruler: 'Venus' },
  Scorpio: { element: 'Water', modality: 'Fixed', ruler: 'Pluto' },
  Sagittarius: { element: 'Fire', modality: 'Mutable', ruler: 'Jupiter' },
  Capricorn: { element: 'Earth', modality: 'Cardinal', ruler: 'Saturn' },
  Aquarius: { element: 'Air', modality: 'Fixed', ruler: 'Uranus' },
  Pisces: { element: 'Water', modality: 'Mutable', ruler: 'Neptune' },
};

const CHINESE_ANIMALS = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'] as const;

// --- Chinese lookups (compact and safe defaults) ---
const CHINESE_META: Record<string, { traits: string[]; strengths: string[]; compat: string[] }> = {
  Rat:       { traits: ['Clever','Adaptive','Observant'], strengths: ['Strategy','Networking'], compat: ['Ox','Dragon','Monkey'] },
  Ox:        { traits: ['Steady','Dutiful','Grounded'], strengths: ['Perseverance','Reliability'], compat: ['Rat','Snake','Rooster'] },
  Tiger:     { traits: ['Bold','Independent','Magnetic'], strengths: ['Courage','Leadership'], compat: ['Horse','Dog','Pig'] },
  Rabbit:    { traits: ['Gentle','Diplomatic','Refined'], strengths: ['Harmony','Design'], compat: ['Sheep','Dog','Pig'] },
  Dragon:    { traits: ['Visionary','Charismatic','Ambitious'], strengths: ['Inspiration','Drive'], compat: ['Rat','Monkey','Rooster'] },
  Snake:     { traits: ['Insightful','Calm','Strategic'], strengths: ['Analysis','Focus'], compat: ['Ox','Rooster'] },
  Horse:     { traits: ['Energetic','Free-spirited','Optimistic'], strengths: ['Momentum','Inspiration'], compat: ['Tiger','Dog','Goat'] },
  Goat:      { traits: ['Artful','Empathic','Supportive'], strengths: ['Care','Craft'], compat: ['Rabbit','Horse','Pig'] },
  Monkey:    { traits: ['Witty','Inventive','Curious'], strengths: ['Problem-solving','Versatility'], compat: ['Rat','Dragon'] },
  Rooster:   { traits: ['Organized','Frank','Vigilant'], strengths: ['Precision','Accountability'], compat: ['Ox','Snake','Dragon'] },
  Dog:       { traits: ['Loyal','Just','Protective'], strengths: ['Guardianship','Teamwork'], compat: ['Tiger','Rabbit','Horse'] },
  Pig:       { traits: ['Warm','Sincere','Abundant'], strengths: ['Generosity','Steadiness'], compat: ['Tiger','Rabbit','Goat'] },
};

const CHINESE_ELEMENT_META: Record<'Wood'|'Fire'|'Earth'|'Metal'|'Water', { focus: string; balance: string }> = {
  Wood:  { focus: 'Growth, planning, creativity',           balance: 'Avoid overextending; prune and prioritize' },
  Fire:  { focus: 'Visibility, courage, initiative',        balance: 'Temper impulsivity; sustain effort' },
  Earth: { focus: 'Stability, care, pragmatism',            balance: 'Prevent stagnation; stay adaptable' },
  Metal: { focus: 'Structure, standards, refinement',       balance: 'Loosen perfectionism; invite feedback' },
  Water: { focus: 'Insight, intuition, flow',               balance: 'Create containers; define boundaries' },
};

// --- African (Orisha) lookups (respectful + non-prescriptive) ---
const ORISHA_META: Record<string, { virtues: string[]; guidance: string[] }> = {
  Elegua:  { virtues: ['Beginnings','Paths','Opportunity'], guidance: ['Open with intention','Keep choices flexible','Ask clear questions'] },
  Ogun:    { virtues: ['Action','Craft','Courage'],         guidance: ['Build steadily','Channel force constructively','Value tools & process'] },
  Yemoja:  { virtues: ['Nurture','Healing','Depth'],        guidance: ['Lead with care','Honor emotions','Create safe waters'] },
  Shango:  { virtues: ['Justice','Charisma','Will'],        guidance: ['Stand for fairness','Own your voice','Use power ethically'] },
  Oya:     { virtues: ['Change','Truth','Winds'],           guidance: ['Declutter boldly','Name the truth','Move with the storm'] },
  Osun:    { virtues: ['Beauty','Joy','Magnetism'],         guidance: ['Celebrate art','Choose sweetness wisely','Receive graciously'] },
  Obatala: { virtues: ['Wisdom','Clarity','Peace'],         guidance: ['Slow down','Seek higher view','Act with grace'] },
};


const LOCATION_STORAGE_FORMAT: LocationFormat = 'pipe';

// --------------------------- Utilities ---------------------------

function clamp(v:number, lo:number, hi:number){ return Math.min(hi, Math.max(lo, v)); }

function signNameByIndex(index:number): SignName {
  const i = ((index % 12) + 12) % 12;
  return SIGN_NAMES[i] as SignName; // <- ensure literal type, not widened 'string'
}

function wholeSignHousesFromAsc(ascSign: SignName): HouseMap {
  const idx = SIGN_NAMES.indexOf(ascSign);
  const obj = {
    first: signNameByIndex(idx),
    second: signNameByIndex(idx+1),
    third: signNameByIndex(idx+2),
    fourth: signNameByIndex(idx+3),
    fifth: signNameByIndex(idx+4),
    sixth: signNameByIndex(idx+5),
    seventh: signNameByIndex(idx+6),
    eighth: signNameByIndex(idx+7),
    ninth: signNameByIndex(idx+8),
    tenth: signNameByIndex(idx+9),
    eleventh: signNameByIndex(idx+10),
    twelfth: signNameByIndex(idx+11),
  } as HouseMap; // <- lock type to HouseMap
  return obj;
}

function formatLocation(loc: ResolvedLocation, fmt: LocationFormat): string {
  const lat = loc.lat.toFixed(6);
  const lon = loc.lon.toFixed(6);
  switch (fmt) {
    case 'label': return loc.label;
    case 'latlon': return `${lat},${lon}`;
    case 'pipe': return `${loc.label}|${lat}|${lon}`;
    case 'json':
    default: return JSON.stringify(loc);
  }
}

function isValidLatLon(lat?: number, lon?: number) {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    isFinite(lat) && isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

// -------------------- Client-only Location Resolve --------------------

async function resolveLocationPublic(query: string): Promise<ResolvedLocation[] | null> {
  const q = (query || '').trim();
  if (q.length < 3) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const raw = await res.json();

    const picks: ResolvedLocation[] = (raw || []).map((r: any) => {
      const a = r.address || {};
      const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || '';
      const region = a.state || a.region || a.province || a.county || '';
      const country = a.country || '';
      const label = [city, region, country].filter(Boolean).join(', ') || r.display_name || q;
      return {
        label,
        lat: Number(r.lat),
        lon: Number(r.lon),
      };
    }).filter((p: ResolvedLocation) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    return picks.length ? picks : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ----------------------- Astrology Calculations -----------------------

/** Compute Sun sign from date (simplified tropical boundaries). */
function sunSignFromDate(d: Date): SignName {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Aries';
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Taurus';
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Gemini';
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Cancer';
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Leo';
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Virgo';
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Libra';
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Scorpio';
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Sagittarius';
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'Capricorn';
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

/**
 * Compute Ascendant degrees (tropical) from UTC-like Date + lat/lon.
 * NOTE: For this minimal client version, we interpret d as a local time Date.
 * You can upgrade later to true UTC by normalizing with an IANA timezone.
 */
function computeAscendantDeg(d: Date, latDeg: number, lonDeg: number) {
  // Convert calendar date to Julian Day (approx for modern dates)
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate() + (d.getHours() + d.getMinutes()/60 + d.getSeconds()/3600)/24;

  let A = Math.floor(Y/100);
  let B = 2 - A + Math.floor(A/4);
  const JD = Math.floor(365.25*(Y + 4716)) + Math.floor(30.6001*(M + 1)) + D + B - 1524.5;

  // Greenwich Sidereal Time (approx, in hours)
  const T = (JD - 2451545.0)/36525.0;
  let GST = 6.697374558 + 2400.051336*T + 0.000025862*T*T; // in hours at 0h UT
  const UT = d.getUTCHours() + d.getUTCMinutes()/60 + d.getUTCSeconds()/3600;
  GST += 1.0027379093 * UT;
  GST = ((GST % 24) + 24) % 24;

  // Local Sidereal Time
  const LST_hours = (GST + lonDeg/15);
  const LST = ((LST_hours % 24) + 24) % 24 * (Math.PI/12); // radians

  // Obliquity (approx J2000)
  const eps = 23.43929111 * Math.PI/180;
  const phi = latDeg * Math.PI/180;

  const sinL = Math.sin(LST), cosL = Math.cos(LST);
  const tanPhi = Math.tan(phi);

  const num = -cosL;
  const den = sinL * Math.cos(eps) + tanPhi * Math.sin(eps);
  let asc = Math.atan2(num, den); // radians
  if (asc < 0) asc += 2*Math.PI;
  return asc * 180/Math.PI; // 0..360°
}

function risingFromDeg(deg:number): SignName {
  return signNameByIndex(Math.floor(((deg % 360) + 360) % 360 / 30));
}

function calculateWesternAstrology(
  baseDate: Date,
  ascOverride?: { risingSign?: SignName; houses?: HouseMap }
): WesternAstrology {
  const sunSign = sunSignFromDate(baseDate);
  const signMeta = SIGN_META[sunSign];

  // Simple placeholders for demo; real Moon/planets need ephemerides
  const signIdx = SIGN_NAMES.indexOf(sunSign);
  const moonSign = signNameByIndex(signIdx + 4);

  let risingSign: SignName = signNameByIndex(signIdx + 8);
  let houses: HouseMap = wholeSignHousesFromAsc(risingSign);

  if (ascOverride?.risingSign) {
    risingSign = ascOverride.risingSign;
    // Avoid widening: compute typed fallback and use nullish coalescing
    const fallback: HouseMap = wholeSignHousesFromAsc(risingSign);
    houses = (ascOverride.houses ?? fallback) as HouseMap;
  }

  return {
    sunSign,
    moonSign,
    risingSign,
    houses,
    planetaryPlacements: {
      mercury: signNameByIndex(signIdx + 1),
      venus: signNameByIndex(signIdx + 2),
      mars: signNameByIndex(signIdx + 3),
      jupiter: signNameByIndex(signIdx + 5),
      saturn: signNameByIndex(signIdx + 7),
      uranus: signNameByIndex(signIdx + 9),
      neptune: signNameByIndex(signIdx + 10),
      pluto: signNameByIndex(signIdx + 11),
    },
    dominantElement: signMeta.element,
    modality: signMeta.modality,
    chartRuler: signMeta.ruler,
  };
}

function calculateChineseAstrology(d: Date): ChineseAstrology {
  const year = d.getFullYear();
  const animalIdx = ((year - 4) % 12 + 12) % 12;
  const animal = CHINESE_ANIMALS[animalIdx] as unknown as string;
  const elements = ['Wood','Fire','Earth','Metal','Water'] as const;
  const element = elements[Math.floor(((year - 4) % 10 + 10) % 10 / 2)];
  const yinYang = (((year - 4) % 2 + 2) % 2) === 0 ? 'Yang' : 'Yin';
  const innerAnimal = CHINESE_ANIMALS[Math.floor(clamp(Math.floor(d.getHours()/2), 0, 11))] as unknown as string;
  const luckyNumbers = [((animalIdx+1)%9)+1, ((animalIdx+4)%9)+1];
  return { animalSign: animal, element, yinYang, innerAnimal, luckyNumbers };
}

function calculateAfricanAstrology(d: Date): AfricanAstrology {
  const day = d.getDay();
  const orishas = ['Elegua','Ogun','Yemoja','Shango','Oya','Osun','Obatala'];
  const orisha = orishas[day % orishas.length];
  const elementalForce = ['Air','Fire','Water','Fire','Air','Water','Air'][day % 7];
  const sacredAnimal = ['Hummingbird','Panther','Dolphin','Lion','Falcon','Gazelle','Elephant'][day % 7];
  const lifeDestiny = ['Pathfinder','Builder','Healer','Leader','Changer','Lover','Sage'][day % 7];
  const spiritualGifts = ['Communication','Strength','Nurturing','Justice','Courage','Abundance','Wisdom'];
  const challenges = ['Patience','Boundaries','Balance','Humility','Consistency','Focus','Trust'];
  return { orishaGuardian: orisha, elementalForce, sacredAnimal, lifeDestiny, spiritualGifts, challenges };
}

function calculateNumerology(d: Date, fullName: string): NumerologyProfile {
  void fullName; // not used in minimal version
  // FIXED: month grouping must be (getMonth() + 1)
  const lifePathRaw = d.getDate() + (d.getMonth() + 1) + d.getFullYear();
  const reduced = String(lifePathRaw).split('').reduce((sum, ch) => sum + (parseInt(ch, 10) || 0), 0);
  const lifePathNumber = reduced % 9 || 9;

  return {
    lifePathNumber,
    destinyNumber: ((lifePathNumber + 3) % 9) || 9,
    soulUrgeNumber: ((lifePathNumber + 6) % 9) || 9,
    personalityNumber: ((lifePathNumber + 4) % 9) || 9,
    birthDayNumber: d.getDate(),
    meanings: {
      lifePath: `Life Path ${lifePathNumber}: Your trajectory of growth and contribution.`,
      destiny: 'Destiny: Direction of accomplishment and purpose.',
      soulUrge: 'Soul Urge: Inner motivations and heartfelt needs.',
      personality: 'Personality: How others first experience you.'
    }
  };
}

function buildSynthesis(w: WesternAstrology, c: ChineseAstrology, a: AfricanAstrology, n: NumerologyProfile) {
  return {
    coreThemes: [w.modality, w.dominantElement, c.element, a.lifeDestiny].filter(Boolean),
    lifeDirection: `Blend of ${w.sunSign} vitality with ${c.animalSign} ${String(c.element).toLowerCase()} energy.`,
    spiritualPath: `Guided by ${a.orishaGuardian} with gifts of ${a.spiritualGifts[0].toLowerCase()}.`,
    relationships: `${w.risingSign} rising favors authentic connections; ${c.yinYang} tone this cycle.`,
    career: `Leverage ${w.chartRuler} focus; numerology ${n.lifePathNumber} highlights signature strengths.`,
    wellness: `Balance ${w.dominantElement.toLowerCase()} tendencies with grounding rituals.`,
  };
}

// ------------------------------ Component ------------------------------

const AstroLogicalStep = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete } = useIntake();


  const [birthData, setBirthData] = useState<BirthData>({ date: '', time: '', location: '' });
  const [resolveState, setResolveState] = useState<LocationResolveState>({ status: 'idle' });
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const steps = ['Birth', 'Location', 'Calculate'] as const;

  const [isCalculating, setIsCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AstrologicalResult | null>(null);

  const [activeTab, setActiveTab] = useState<'western'|'chinese'|'african'|'numerology'|'synthesis'>('western');

  // cancel timer safety
  const calcTimeoutRef = useRef<number | null>(null);
  useEffect(() => () => { if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current); }, []);

  const progress = useMemo(() => {
    const base = showResult ? 100 : (currentStep / (steps.length - 1)) * 100;
    return Math.round(base);
  }, [currentStep, steps.length, showResult]);

  // -------- Location handlers --------

  const handleResolveLocation = useCallback(async () => {
    const q = birthData.location?.trim() || '';
    if (q.length < 3) {
      setResolveState({ status: 'error', message: 'Please enter 3+ characters.' });
      return;
    }
    setResolveState({ status: 'resolving' });
    const results = await resolveLocationPublic(q);
    if (!results || results.length === 0) {
      setResolveState({ status: 'error', message: 'No results. Try a more specific query.' });
      return;
    }
    if (results.length > 1) {
      setResolveState({ status: 'ambiguous', suggestions: results.slice(0,5) });
      return;
    }
    const pick = results[0];
    if (!isValidLatLon(pick.lat, pick.lon)) {
      setResolveState({ status: 'error', message: 'Invalid coordinates from provider.' });
      return;
    }
    setResolvedLocation(pick);
    setResolveState({ status: 'resolved' });
    setBirthData(p => ({ ...p, latitude: pick.lat, longitude: pick.lon, resolvedLabel: pick.label }));
    updateIntake?.({
      birthLocation: pick,
      birthLocationFormatted: formatLocation(pick, LOCATION_STORAGE_FORMAT),
    });
  }, [birthData.location, updateIntake]);

  const selectSuggestion = useCallback((pick: ResolvedLocation) => {
    if (!isValidLatLon(pick.lat, pick.lon)) {
      setResolveState({ status: 'error', message: 'Invalid coordinates from provider.' });
      return;
    }
    setResolvedLocation(pick);
    setResolveState({ status: 'resolved' });
    setBirthData(p => ({ ...p, latitude: pick.lat, longitude: pick.lon, resolvedLabel: pick.label }));
    updateIntake?.({
      birthLocation: pick,
      birthLocationFormatted: formatLocation(pick, LOCATION_STORAGE_FORMAT),
    });
  }, [updateIntake]);

  // -------- Calculation --------

  const calculateAllAstrology = useCallback(() => {
    if (!birthData.date || !birthData.time) return;
    setIsCalculating(true);

    calcTimeoutRef.current = window.setTimeout(() => {
      // Interpret as local time Date (upgrade to true timezone normalization later)
      const localDate = new Date(`${birthData.date}T${birthData.time}:00`);

      // Rising/houses override if location present
      let ascOverride: { risingSign?: SignName; houses?: HouseMap } | undefined = undefined;

      if (resolvedLocation && isValidLatLon(resolvedLocation.lat, resolvedLocation.lon)) {
        const ascDeg = computeAscendantDeg(localDate, resolvedLocation.lat, resolvedLocation.lon);
        const rising = risingFromDeg(ascDeg);
        ascOverride = { risingSign: rising, houses: wholeSignHousesFromAsc(rising) };
      }

      const western = calculateWesternAstrology(localDate, ascOverride);
      const chinese = calculateChineseAstrology(localDate);
      const african = calculateAfricanAstrology(localDate);
      const numerology = calculateNumerology(localDate, 'User Name');

      const synthesis = buildSynthesis(western, chinese, african, numerology);

      const astro: AstrologicalResult = { western, chinese, african, numerology, synthesis };

      setResult(astro);
      updateIntake?.({ astrologicalResult: astro });
      setIsCalculating(false);
      setShowResult(true);

	    // Mark step ready
  	  markStepComplete?.('AstroLogicalStep', {
  	    ready: true,
  	    computedAt: new Date().toISOString(),
  	    completed: true,
  	  });
      
    }, 1200); // fast and responsive
  }, [birthData.date, birthData.time, resolvedLocation, updateIntake, markStepComplete]);

  // -------- Navigation & guards --------

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return Boolean(birthData.date) && Boolean(birthData.time);
      case 1: return (birthData.location?.trim().length ?? 0) >= 3; // optionally require resolved location
      case 2: return !isCalculating;
      default: return true;
    }
  }, [currentStep, birthData, isCalculating]);

  const goNext = () => {
    if (showResult) {
      navigate('/intake/personality');
      return;
    }
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
  };

  const goPrev = () => {
    if (currentStep > 0 && !showResult) setCurrentStep(s => s - 1);
  };

  // -------- Tabs keyboard arrows --------

  const onTabsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const order: typeof activeTab[] = ['western','chinese','african','numerology','synthesis'];
    const i = order.indexOf(activeTab);
    if (e.key === 'ArrowRight') setActiveTab(order[(i + 1) % order.length]);
    if (e.key === 'ArrowLeft') setActiveTab(order[(i - 1 + order.length) % order.length]);
  };

  // ------------------------------ Render ------------------------------

  const renderTabContent = () => {
    if (!result) return null;
    switch (activeTab) {
      case 'western':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Sun, Moon, Rising */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Sun Sign', value: result.western.sunSign, desc: 'Core Identity', color: 'from-yellow-400 to-orange-400' },
                { title: 'Moon Sign', value: result.western.moonSign, desc: 'Emotional Nature', color: 'from-blue-400 to-indigo-400' },
                { title: 'Rising Sign', value: result.western.risingSign, desc: 'Outer Persona', color: 'from-purple-400 to-pink-400' }
              ].map((item, index) => (
                <motion.div key={item.title} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.15 }} className="glass-card-enhanced p-4 rounded-xl text-center">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-3 flex items-center justify-center`}>
                    <span className="text-white font-bold text-lg">✦</span>
                  </div>
                  <h4 className="text-white font-semibold">{item.title}</h4>
                  <p className="text-2xl font-bold text-white my-2">{item.value}</p>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Houses */}
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h3 className="text-white font-semibold mb-4">Astrological Houses (Whole Sign)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(result.western.houses).map(([house, sign], index) => (
                  <motion.div key={house} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="p-3 bg-white/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 capitalize">{house}</span>
                      <span className="text-white font-medium">{sign}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      case 'chinese':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card-enhanced p-6 rounded-xl text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-yellow-400 mx-auto mb-4 flex items-center justify-center">
                <span className="text-4xl">🐉</span>
              </div>
      
              <h3 className="text-3xl font-bold text-white mb-1">{result.chinese.animalSign}</h3>
              <p className="text-white/80">{result.chinese.element} · {result.chinese.yinYang}</p>
              <p className="text-white/70 text-sm mt-1">Inner Animal (hour): {result.chinese.innerAnimal}</p>
            </div>
      
            {/* Quick facts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Lucky Numbers</h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {result.chinese.luckyNumbers.map((n) => (
                    <span key={n} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm">{n}</span>
                  ))}
                </div>
              </div>
      
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Traits</h4>
                <div className="flex flex-col items-center justify-center content-center">
                  {(CHINESE_META[result.chinese.animalSign]?.traits ?? ['Balanced','Adaptable']).map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm">{t}</span>
                  ))}
                </div>
              </div>
      
              <div className="glass-card-enhanced p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Strengths</h4>
                <div className="flex flex-col items-center justify-center content-center">
                  {(CHINESE_META[result.chinese.animalSign]?.strengths ?? ['Resilience']).map((s) => (
                    <span key={s} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm">{s}</span>
                  ))}
                </div>
              </div>
            </div>
      
            {/* Element focus & compatibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-enhanced p-5 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Element Focus</h4>
                <p className="text-white/80 text-sm">
                  {CHINESE_ELEMENT_META[result.chinese.element as keyof typeof CHINESE_ELEMENT_META]?.focus ?? 'Balance of initiative and reflection.'}
                </p>
                <p className="text-white/60 text-xs mt-2">
                  Balance tip: {CHINESE_ELEMENT_META[result.chinese.element as keyof typeof CHINESE_ELEMENT_META]?.balance ?? 'Alternate expansion with consolidation.'}
                </p>
              </div>
      
              <div className="glass-card-enhanced p-5 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Natural Compatibilities</h4>
                <p className="text-white/80 text-sm">
                  {(CHINESE_META[result.chinese.animalSign]?.compat ?? ['Complementary signs vary by context']).join(' • ')}
                </p>
              </div>
            </div>
          </motion.div>
        );

	  case 'african':
	    return (
	      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
	        <div className="glass-card-enhanced p-6 rounded-xl text-center">
	          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-indigo-400 mx-auto mb-4 flex items-center justify-center">
	            <span className="text-4xl">⚡</span>
	          </div>
	          <h3 className="text-3xl font-bold text-white mb-1">{result.african.orishaGuardian}</h3>
	          <p className="text-white/80">{result.african.elementalForce} · {result.african.sacredAnimal}</p>
	          <p className="text-white/70 text-sm mt-1">Life Destiny: {result.african.lifeDestiny}</p>
	        </div>
	  
	        {/* Themes & gifts */}
	        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
	          <div className="glass-card-enhanced p-4 rounded-xl">
	            <h4 className="text-white font-semibold mb-2">Core Virtues</h4>
	            <div className="flex flex-col items-center justify-center content-center">
	              {(ORISHA_META[result.african.orishaGuardian]?.virtues ?? ['Clarity','Balance']).map((v) => (
	                <span key={v} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm">
	                  {v}
	                </span>

	              ))}
	            </div>
	          </div>
	  
	          <div className="glass-card-enhanced p-4 rounded-xl">
	            <h4 className="text-white font-semibold mb-2">Gifts</h4>
	            <div className="flex flex-col items-center justify-center content-center">
	              {result.african.spiritualGifts.map((g) => (
	                <span key={g} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm [word-spacing:.06em] tracking-wide mr-2 last:mr-0">
	                  {g}
	                </span>

	              ))}
	            </div>
	          </div>
	  
	          <div className="glass-card-enhanced p-4 rounded-xl">
	            <h4 className="text-white font-semibold mb-2">Growth Edges</h4>
	            <div className="flex flex-col items-center justify-center content-center">
	              {result.african.challenges.map((c) => (
	                <span key={c} className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm">
	                  {c} 
	                </span>
	                
	              ))}
	            </div>
	          </div>
	        </div>
	  
	        {/* Guidance */}
	        <div className="glass-card-enhanced p-5 rounded-xl">
	          <h4 className="text-white font-semibold mb-2">Guidance</h4>
	          <ul className="list-disc list-inside text-left text-white/80 text-sm space-y-1">
	            {(ORISHA_META[result.african.orishaGuardian]?.guidance ?? [
	              'Lead with integrity',
	              'Choose aligned commitments',
	              'Practice steady self-care',
	            ]).map((g, i) => (
	              <li key={i}>{g}</li>
	            ))}
	          </ul>
	        </div>
	      </motion.div>
	    );
	  
      
      case 'numerology':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { title: 'Life Path', value: result.numerology.lifePathNumber, color: 'from-emerald-400 to-teal-400' },
                { title: 'Destiny', value: result.numerology.destinyNumber, color: 'from-blue-400 to-cyan-400' },
                { title: 'Soul Urge', value: result.numerology.soulUrgeNumber, color: 'from-pink-400 to-rose-400' },
                { title: 'Personality', value: result.numerology.personalityNumber, color: 'from-amber-400 to-orange-400' },
              ].map((item, idx) => (
                <motion.div key={item.title} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }} className="glass-card-enhanced p-4 rounded-xl text-center">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.color} mx-auto mb-2 flex items-center justify-center`}>
                    <span className="text-white font-bold">{item.value}</span>
                  </div>
                  <h4 className="text-white font-medium">{item.title}</h4>
                </motion.div>
              ))}
            </div>
            <div className="glass-card-enhanced p-6 rounded-xl">
              <h4 className="text-white font-semibold mb-3">Number Meanings</h4>
              <div className="space-y-2">
                {Object.values(result.numerology.meanings).map((meaning, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="p-3 bg-white/10 rounded-lg">
                    <p className="text-white">{meaning}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      case 'synthesis':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Core Themes', content: result.synthesis.coreThemes.join(' · '), icon: '✨' },
                { title: 'Life Direction', content: result.synthesis.lifeDirection, icon: '🧭' },
                { title: 'Spiritual Path', content: result.synthesis.spiritualPath, icon: '🔮' },
                { title: 'Relationships', content: result.synthesis.relationships, icon: '💞' },
                { title: 'Career', content: result.synthesis.career, icon: '📈' },
                { title: 'Wellness', content: result.synthesis.wellness, icon: '🌿' },
              ].map((item, idx) => (
                <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }} className="glass-card-enhanced p-4 rounded-xl">
                  <div className="flex items-center space-x-3 mb-2">
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
      {/* Background Three.js scene */}
      <BasicScene />

      {/* Page Shell */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="w-full max-w-4xl mx-auto">
          {/* Main Card */}
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]">
            {/* Header */}
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ duration: 0.6 }} className="space-y-4 items-center justify-center flex flex-col">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 flex items-center justify-center">
                <span className="text-2xl">🌟</span>
              </div>
              <h2 className="text-3xl font-bold text-white text-shadow-soft">Cosmic Blueprint</h2>
              <p className="text-white/80 max-w-2xl">
                {showResult ? 'Your complete astrological profile across traditions' : 'Discover your celestial signature'}
              </p>
            </motion.div>

            {/* Progress */}
            <div className="glass-card-enhanced p-4 rounded-xl mx-auto max-w-xl" aria-live="polite">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>Step {showResult ? steps.length : currentStep + 1} of {steps.length}</span>
                <span>{showResult ? 'Results' : steps[currentStep]}</span>
              </div>
              <span className="sr-only">Progress: {progress}%</span>
              <GlassProgress value={progress} max={100} />
            </div>

            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                  {/* Step 0: Birth Date & Time */}
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                        <h3 className="text-white font-semibold mb-4 flex items-center justify-center gap-2">
                          <span>🗓️</span><span>Birth Information</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="birth-date" className="text-white/80 text-sm">Birth Date</label>
                            <input
                              id="birth-date"
                              type="date"
                              required aria-required="true"
                              aria-describedby="birth-date-help"
                              value={birthData.date}
                              onChange={(e) => setBirthData(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                            <p id="birth-date-help" className="sr-only">Enter your date of birth in YYYY-MM-DD format</p>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="birth-time" className="text-white/80 text-sm">Birth Time</label>
                            <input
                              id="birth-time"
                              type="time"
                              step={60}
                              required aria-required="true"
                              aria-describedby="birth-time-help"
                              value={birthData.time}
                              onChange={(e) => setBirthData(prev => ({ ...prev, time: e.target.value }))}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                            <p id="birth-time-help" className="sr-only">Enter your birth time to the nearest minute</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Location */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                        <h3 className="text-white font-semibold mb-4 flex items-center justify-center gap-2">
                          <span>📍</span><span>Birth Location</span>
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label htmlFor="birth-location" className="text-white/80 text-sm">City, State/Province, Country</label>
                            <input
                              id="birth-location"
                              type="text"
                              placeholder="e.g., New York, NY, USA"
                              value={birthData.location}
                              onChange={(e) => setBirthData(prev => ({ ...prev, location: e.target.value }))}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <GlassButton onClick={handleResolveLocation} disabled={resolveState.status === 'resolving'}>
                              {resolveState.status === 'resolving' ? 'Resolving…' : 'Resolve location'}
                            </GlassButton>
                            {resolvedLocation && (
                              <span className="text-xs text-white/80 glass-card-enhanced px-3 py-1 rounded-full">
                                📍 {resolvedLocation.label} · {resolvedLocation.lat.toFixed(4)},{resolvedLocation.lon.toFixed(4)}
                              </span>
                            )}
                          </div>

                          {resolveState.status === 'ambiguous' && (
                            <div className="glass-card-enhanced p-3 rounded-xl">
                              <p className="text-sm text-white/80 mb-2">Select a match:</p>
                              <div className="flex flex-wrap justify-center gap-2">
                                {resolveState.suggestions.map((s, i) => (
                                  <button key={i} onClick={() => selectSuggestion(s)} className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-sm">
                                    {s.label} · {s.lat.toFixed(2)},{s.lon.toFixed(2)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {resolveState.status === 'error' && (
                            <p className="text-xs text-rose-300">{resolveState.message || 'Location failed to resolve.'}</p>
                          )}

                          <div className="mt-2 p-3 bg-white/5 rounded-lg text-white/70 text-sm">
                            Why location matters: it enables a precise Rising sign and houses. You can skip this now and still calculate Sun-based insights.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Calculate */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="glass-card-enhanced p-6 rounded-xl mx-auto max-w-xl">
                        {!isCalculating ? (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto flex items-center justify-center">
                              <span className="text-3xl">✨</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white">Ready to Calculate</h3>
                            <p className="text-white/70">Click below to generate your multi-tradition profile.</p>
                          </motion.div>
                        ) : (
                          <motion.div role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="relative">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="w-32 h-32 rounded-full border-4 border-white/20 border-t-white/60 mx-auto" />
                              <motion.div animate={{ rotate: -360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-4 w-24 h-24 rounded-full border-4 border-white/10 border-r-white/40" />
                              <div className="absolute inset-0 flex items-center justify-center"><span className="text-4xl">🌌</span></div>
                            </div>
                            <div className="space-y-2 text-white/80">
                              <div>Aligning with celestial positions…</div>
                              <div>Consulting ancient wisdom traditions…</div>
                              <div>Revealing your cosmic signature…</div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
                  {/* Tabs */}
                  <div role="tablist" aria-label="Astrology result categories" onKeyDown={onTabsKeyDown} className="flex flex-wrap justify-center gap-2">
                    {[
                      { id: 'western', name: 'Western', icon: '♈', color: 'from-blue-400 to-indigo-400' },
                      { id: 'chinese', name: 'Chinese', icon: '🐉', color: 'from-red-400 to-yellow-400' },
                      { id: 'african', name: 'African', icon: '⚡', color: 'from-purple-400 to-indigo-400' },
                      { id: 'numerology', name: 'Numbers', icon: '🔢', color: 'from-green-400 to-emerald-400' },
                      { id: 'synthesis', name: 'Synthesis', icon: '🌟', color: 'from-pink-400 to-violet-400' },
                    ].map((tab) => {
                      const selected = activeTab === (tab.id as any);
                      return (
                        <motion.button
                          key={tab.id}
                          id={`tab-${tab.id}`}
                          role="tab"
                          aria-selected={selected}
                          aria-controls={`panel-${tab.id}`}
                          tabIndex={selected ? 0 : -1}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`px-4 py-2 rounded-full flex items-center space-x-2 transition-all duration-300 ${selected ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                        >
                          <span>{tab.icon}</span><span className="font-medium">{tab.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Tab Content */}
                  <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="min-h-96">
                    <AnimatePresence mode="wait">
                      <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}>
                        {renderTabContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex justify-between items-center">
              <GlassButton onClick={goPrev} disabled={currentStep === 0 || showResult}>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Previous
                </span>
              </GlassButton>

              {!showResult ? (
                <GlassButton onClick={() => (currentStep === 2 ? calculateAllAstrology() : goNext())} disabled={!canProceed}>
                  <span className="flex items-center gap-2">
                    <span>{currentStep === 2 ? (isCalculating ? 'Calculating…' : 'Calculate') : 'Next'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </span>
                </GlassButton>
              ) : (
                <GlassButton onClick={() => navigate('/intake/personality')}>
                  <span className="flex items-center gap-2">
                    <span>Continue to Personality</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </span>
                </GlassButton>
              )}
            </motion.div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default AstroLogicalStep;
