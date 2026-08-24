// components/intake/shared/astrology/computeAstrology.ts
// ----------------------------------------------------------------------------
// Pure astrology computation shared by the Core AstroLogicalStep and the new
// Entry intake. Zero React/DOM/network dependency — given birth date/time (+
// optional lat/lon) it returns the exact AstrologicalResult shape the dashboard
// and Dina consume.
//
// PROVENANCE: the functions below are lifted VERBATIM from
// components/intake/AstroLogicalStep.tsx (the production Core step). This module
// is the reuse target for Entry. AstroLogicalStep still carries its own inline
// copies today; consolidating it to import from here is a mechanical Phase-6
// follow-up (verify against the Astrology dashboard tab after). Keeping them
// identical is required until then — do not diverge the math.
// ----------------------------------------------------------------------------

export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
export type SignName = typeof SIGN_NAMES[number];

export type HouseMap = {
  first: SignName; second: SignName; third: SignName; fourth: SignName;
  fifth: SignName; sixth: SignName; seventh: SignName; eighth: SignName;
  ninth: SignName; tenth: SignName; eleventh: SignName; twelfth: SignName;
};

export interface WesternAstrology {
  sunSign: SignName;
  moonSign: SignName;
  risingSign: SignName;
  houses: HouseMap;
  planetaryPlacements: {
    mercury: SignName; venus: SignName; mars: SignName; jupiter: SignName;
    saturn: SignName; uranus: SignName; neptune: SignName; pluto: SignName;
  };
  dominantElement: string;
  modality: string;
  chartRuler: string;
}

export interface ChineseAstrology {
  animalSign: string;
  element: string;
  yinYang: 'Yang' | 'Yin';
  innerAnimal: string;
  luckyNumbers: number[];
}

export interface AfricanAstrology {
  orishaGuardian: string;
  elementalForce: string;
  sacredAnimal: string;
  lifeDestiny: string;
  spiritualGifts: string[];
  challenges: string[];
}

export interface NumerologyProfile {
  lifePathNumber: number;
  destinyNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthDayNumber: number;
  meanings: Record<string, string>;
}

export interface AstrologicalResult {
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

// --------------------------- Constants ---------------------------

const SIGN_META: Record<SignName, { element: string; modality: string; ruler: string }> = {
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

const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'] as const;

// --------------------------- Pure functions ---------------------------

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export function signNameByIndex(index: number): SignName {
  const i = ((index % 12) + 12) % 12;
  return SIGN_NAMES[i] as SignName;
}

export function wholeSignHousesFromAsc(ascSign: SignName): HouseMap {
  const idx = SIGN_NAMES.indexOf(ascSign);
  const obj = {
    first: signNameByIndex(idx),
    second: signNameByIndex(idx + 1),
    third: signNameByIndex(idx + 2),
    fourth: signNameByIndex(idx + 3),
    fifth: signNameByIndex(idx + 4),
    sixth: signNameByIndex(idx + 5),
    seventh: signNameByIndex(idx + 6),
    eighth: signNameByIndex(idx + 7),
    ninth: signNameByIndex(idx + 8),
    tenth: signNameByIndex(idx + 9),
    eleventh: signNameByIndex(idx + 10),
    twelfth: signNameByIndex(idx + 11),
  } as HouseMap;
  return obj;
}

export function isValidLatLon(lat?: number, lon?: number): boolean {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    isFinite(lat) && isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

/** Compute Sun sign from date (simplified tropical boundaries). */
export function sunSignFromDate(d: Date): SignName {
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
 * Compute Ascendant degrees (tropical) from a local-time Date + lat/lon.
 * (Same minimal approximation as the Core step — interprets the Date as-is.)
 */
export function computeAscendantDeg(d: Date, latDeg: number, lonDeg: number): number {
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate() + (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24;

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;

  const T = (JD - 2451545.0) / 36525.0;
  let GST = 6.697374558 + 2400.051336 * T + 0.000025862 * T * T;
  const UT = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  GST += 1.0027379093 * UT;
  GST = ((GST % 24) + 24) % 24;

  const LST_hours = (GST + lonDeg / 15);
  const LST = ((LST_hours % 24) + 24) % 24 * (Math.PI / 12);

  const eps = 23.43929111 * Math.PI / 180;
  const phi = latDeg * Math.PI / 180;

  const sinL = Math.sin(LST), cosL = Math.cos(LST);
  const tanPhi = Math.tan(phi);

  const num = -cosL;
  const den = sinL * Math.cos(eps) + tanPhi * Math.sin(eps);
  let asc = Math.atan2(num, den);
  if (asc < 0) asc += 2 * Math.PI;
  return asc * 180 / Math.PI;
}

export function risingFromDeg(deg: number): SignName {
  return signNameByIndex(Math.floor(((deg % 360) + 360) % 360 / 30));
}

export function calculateWesternAstrology(
  baseDate: Date,
  ascOverride?: { risingSign?: SignName; houses?: HouseMap }
): WesternAstrology {
  const sunSign = sunSignFromDate(baseDate);
  const signMeta = SIGN_META[sunSign];

  const signIdx = SIGN_NAMES.indexOf(sunSign);
  const moonSign = signNameByIndex(signIdx + 4);

  let risingSign: SignName = signNameByIndex(signIdx + 8);
  let houses: HouseMap = wholeSignHousesFromAsc(risingSign);

  if (ascOverride?.risingSign) {
    risingSign = ascOverride.risingSign;
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

export function calculateChineseAstrology(d: Date): ChineseAstrology {
  const year = d.getFullYear();
  const animalIdx = ((year - 4) % 12 + 12) % 12;
  const animal = CHINESE_ANIMALS[animalIdx] as unknown as string;
  const elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const;
  const element = elements[Math.floor(((year - 4) % 10 + 10) % 10 / 2)];
  const yinYang = (((year - 4) % 2 + 2) % 2) === 0 ? 'Yang' : 'Yin';
  const innerAnimal = CHINESE_ANIMALS[Math.floor(clamp(Math.floor(d.getHours() / 2), 0, 11))] as unknown as string;
  const luckyNumbers = [((animalIdx + 1) % 9) + 1, ((animalIdx + 4) % 9) + 1];
  return { animalSign: animal, element, yinYang, innerAnimal, luckyNumbers };
}

export function calculateAfricanAstrology(d: Date): AfricanAstrology {
  const day = d.getDay();
  const orishas = ['Elegua', 'Ogun', 'Yemoja', 'Shango', 'Oya', 'Osun', 'Obatala'];
  const orisha = orishas[day % orishas.length];
  const elementalForce = ['Air', 'Fire', 'Water', 'Fire', 'Air', 'Water', 'Air'][day % 7];
  const sacredAnimal = ['Hummingbird', 'Panther', 'Dolphin', 'Lion', 'Falcon', 'Gazelle', 'Elephant'][day % 7];
  const lifeDestiny = ['Pathfinder', 'Builder', 'Healer', 'Leader', 'Changer', 'Lover', 'Sage'][day % 7];
  const spiritualGifts = ['Communication', 'Strength', 'Nurturing', 'Justice', 'Courage', 'Abundance', 'Wisdom'];
  const challenges = ['Patience', 'Boundaries', 'Balance', 'Humility', 'Consistency', 'Focus', 'Trust'];
  return { orishaGuardian: orisha, elementalForce, sacredAnimal, lifeDestiny, spiritualGifts, challenges };
}

export function calculateNumerology(d: Date, fullName: string): NumerologyProfile {
  void fullName; // not used in minimal version
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
      personality: 'Personality: How others first experience you.',
    },
  };
}

export function buildSynthesis(
  w: WesternAstrology, c: ChineseAstrology, a: AfricanAstrology, n: NumerologyProfile
): AstrologicalResult['synthesis'] {
  return {
    coreThemes: [w.modality, w.dominantElement, c.element, a.lifeDestiny].filter(Boolean),
    lifeDirection: `Blend of ${w.sunSign} vitality with ${c.animalSign} ${String(c.element).toLowerCase()} energy.`,
    spiritualPath: `Guided by ${a.orishaGuardian} with gifts of ${a.spiritualGifts[0].toLowerCase()}.`,
    relationships: `${w.risingSign} rising favors authentic connections; ${c.yinYang} tone this cycle.`,
    career: `Leverage ${w.chartRuler} focus; numerology ${n.lifePathNumber} highlights signature strengths.`,
    wellness: `Balance ${w.dominantElement.toLowerCase()} tendencies with grounding rituals.`,
  };
}

// --------------------------- Orchestrator ---------------------------

export interface BirthInput {
  date: string;        // 'YYYY-MM-DD' (required)
  time?: string;       // 'HH:mm' (optional; defaults to noon for a stable sun sign)
  latitude?: number;   // optional; enables a real Rising sign + houses
  longitude?: number;
  fullName?: string;   // reserved (numerology ignores it in the minimal version)
}

/**
 * Full chart from birth inputs — the exact recipe the Core step uses
 * (AstroLogicalStep.calculateAllAstrology). Time defaults to noon so the sun
 * sign is stable when a user hasn't provided a birth time in the fast Entry.
 */
export function computeAstrology(birth: BirthInput): AstrologicalResult {
  const time = birth.time && /^\d{2}:\d{2}/.test(birth.time) ? birth.time : '12:00';
  const localDate = new Date(`${birth.date}T${time}:00`);

  let ascOverride: { risingSign?: SignName; houses?: HouseMap } | undefined;
  if (isValidLatLon(birth.latitude, birth.longitude)) {
    const ascDeg = computeAscendantDeg(localDate, birth.latitude as number, birth.longitude as number);
    const rising = risingFromDeg(ascDeg);
    ascOverride = { risingSign: rising, houses: wholeSignHousesFromAsc(rising) };
  }

  const western = calculateWesternAstrology(localDate, ascOverride);
  const chinese = calculateChineseAstrology(localDate);
  const african = calculateAfricanAstrology(localDate);
  const numerology = calculateNumerology(localDate, birth.fullName ?? 'User');
  const synthesis = buildSynthesis(western, chinese, african, numerology);

  return { western, chinese, african, numerology, synthesis };
}
