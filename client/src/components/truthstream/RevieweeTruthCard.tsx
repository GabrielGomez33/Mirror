// src/components/truthstream/RevieweeTruthCard.tsx
// Displays the reviewee's Truth Card during the review process.
// Shows all willingly shared data: profile, personality, cognitive, facial,
// voice, and full astrological breakdown (western, chinese, african, numerology).
// Security: Only data the reviewee opted into sharing is displayed.

import { useState, useRef, useCallback } from 'react';
import type { TruthCardData, TruthCardSharedData } from '../../types/truthstream';
import { buildStorageRetrieveUrl } from '../../utils/storageUrl';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  heading: 'var(--dash-heading, #3d1428)',
  body: 'var(--dash-body, #4a1c30)',
  label: 'var(--mg-label, #2d0a16)',
  accent: '#f472b6',
  accentAlt: '#a78bfa',
};

const SECTION_ICONS: Record<string, string> = {
  western: '\u2609',    // sun symbol
  chinese: '\ud83d\udc09',  // dragon
  african: '\ud83c\udf0d',  // globe
  numerology: '\ud83d\udd22', // numbers
  synthesis: '\u2728',  // sparkles
};

// ============================================================================
// HELPERS
// ============================================================================

function buildStorageUrl(path: string, userId: number, tier?: 'tier1' | 'tier2' | 'tier3'): string | null {
  return buildStorageRetrieveUrl(path, userId, tier);
}

/**
 * Sanitize display text to prevent XSS via injected data.
 * Strips HTML tags and limits length for display.
 */
function sanitizeText(text: unknown, maxLen = 2000): string {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').slice(0, maxLen).trim();
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface RevieweeTruthCardProps {
  truthCard: TruthCardData;
  revieweeUserId: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function RevieweeTruthCard({
  truthCard,
  revieweeUserId,
  isCollapsed,
  onToggleCollapse,
}: RevieweeTruthCardProps) {
  const shared = truthCard.sharedData;
  const hasPhoto = !!truthCard.photoPath;
  const hasVoice = !!truthCard.vocalSalutationPath;

  const photoUrl = hasPhoto ? buildStorageUrl(truthCard.photoPath!, revieweeUserId, 'tier1') : null;
  const voiceUrl = hasVoice ? buildStorageUrl(truthCard.vocalSalutationPath!, revieweeUserId, 'tier2') : null;

  // Active astrological sub-tab
  const [astroTab, setAstroTab] = useState<'western' | 'chinese' | 'african' | 'numerology' | 'synthesis'>('western');

  return (
    <div
      className="enhanced-glass-card"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(244, 114, 182, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between text-left"
        style={{ cursor: 'pointer' }}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Show Truth Card' : 'Hide Truth Card'}
      >
        <div className="flex items-center gap-3">
          {/* Small avatar */}
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{
              width: 40, height: 40, minWidth: 40,
              background: photoUrl
                ? 'none'
                : 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(167,139,250,0.25))',
              border: '2px solid rgba(244,114,182,0.3)',
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                style={{ width: 40, height: 40, objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-lg">{'\ud83c\udfad'}</span>
            )}
          </div>
          <div>
            <span
              className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(244,114,182,0.2)', color: COLORS.heading }}
            >
              Reviewee Truth Card
            </span>
            <p className="text-sm font-semibold mt-0.5" style={{ color: COLORS.heading }}>
              {truthCard.displayAlias}
              {truthCard.ageRange && (
                <span className="font-normal text-xs ml-2" style={{ color: COLORS.body }}>
                  {truthCard.ageRange}
                </span>
              )}
            </p>
          </div>
        </div>
        <span
          className="text-sm transition-transform flex-shrink-0"
          style={{
            color: COLORS.label,
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          {'\u25bc'}
        </span>
      </button>

      {/* Collapsible body */}
      {!isCollapsed && (
        <div className="mt-4 space-y-4">

          {/* Identity section */}
          <div className="flex items-start gap-4">
            {/* Larger photo */}
            {photoUrl && (
              <div
                className="rounded-2xl overflow-hidden flex-shrink-0"
                style={{
                  width: 80, height: 80,
                  border: '2px solid rgba(244,114,182,0.3)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              >
                <img
                  src={photoUrl}
                  alt={`${truthCard.displayAlias}'s photo`}
                  style={{ width: 80, height: 80, objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              {truthCard.genderDisplay && (
                <DetailRow label="Gender" value={truthCard.genderDisplay} />
              )}
              {truthCard.pronouns && (
                <DetailRow label="Pronouns" value={truthCard.pronouns} />
              )}
              {truthCard.culturalContext && (
                <DetailRow label="Cultural Context" value={truthCard.culturalContext} />
              )}
              {truthCard.goal && (
                <DetailRow label="Goal" value={truthCard.goal} />
              )}
              {truthCard.goalCategory && (
                <DetailRow label="Goal Category" value={truthCard.goalCategory.replace(/_/g, ' ')} />
              )}
            </div>
          </div>

          {/* Voice Greeting */}
          {voiceUrl && <VoicePlayer url={voiceUrl} />}

          {/* Self Statement */}
          {truthCard.selfStatement && (
            <SectionPanel label="How they see themselves">
              <p className="text-sm leading-relaxed" style={{ color: COLORS.body }}>
                &ldquo;{sanitizeText(truthCard.selfStatement)}&rdquo;
              </p>
            </SectionPanel>
          )}

          {/* Feedback Areas */}
          {truthCard.feedbackAreas.length > 0 && (
            <SectionPanel label="Wants feedback on">
              <div className="flex flex-wrap gap-1.5">
                {truthCard.feedbackAreas.map((area) => (
                  <span
                    key={area}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: 'rgba(244,114,182,0.15)',
                      border: '1px solid rgba(244,114,182,0.3)',
                      color: COLORS.heading,
                    }}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </SectionPanel>
          )}

          {/* Personality */}
          {shared?.personality && (
            <SectionPanel label="Personality Profile" icon={'\ud83e\udde0'}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))',
                      border: '1px solid rgba(244,114,182,0.3)',
                      color: COLORS.heading,
                    }}
                  >
                    {shared.personality.mbtiType}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>
                  {sanitizeText(shared.personality.description)}
                </p>
                {shared.personality.dominantTraits && shared.personality.dominantTraits.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>
                      Dominant Traits
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {shared.personality.dominantTraits.map((trait) => (
                        <span
                          key={trait}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', color: COLORS.body }}
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {shared.personality.big5 && <Big5Display big5={shared.personality.big5} />}
              </div>
            </SectionPanel>
          )}

          {/* Cognitive */}
          {shared?.cognitive && (
            <SectionPanel label="Cognitive Style" icon={'\ud83d\udca1'}>
              <DetailRow label="Category" value={shared.cognitive.category} />
              {shared.cognitive.strengths && shared.cognitive.strengths.length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>
                    Strengths
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {shared.cognitive.strengths.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: COLORS.body }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SectionPanel>
          )}

          {/* Facial Expression */}
          {shared?.facial && (
            <SectionPanel label="Facial Expression" icon={'\ud83d\udcf8'}>
              <DetailRow label="Dominant Expression" value={shared.facial.dominantExpression} />
              {shared.facial.expressionProfile && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>
                    Expression Profile
                  </p>
                  <div className="space-y-1">
                    {Object.entries(shared.facial.expressionProfile)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([expression, value]) => (
                        <BarRow key={expression} label={expression} value={value as number} maxValue={1} />
                      ))}
                  </div>
                </div>
              )}
            </SectionPanel>
          )}

          {/* Voice */}
          {shared?.voice && (
            <SectionPanel label="Voice Signature" icon={'\ud83c\udf99\ufe0f'}>
              <DetailRow label="Recording Duration" value={`${shared.voice.duration}s`} />
            </SectionPanel>
          )}

          {/* Astrological — Full tabbed display */}
          {shared?.astrological && (
            <AstrologicalSection astro={shared.astrological} activeTab={astroTab} onTabChange={setAstroTab} />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function SectionPanel({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const safe = sanitizeText(value, 500);
  if (!safe) return null;
  return (
    <p className="text-xs" style={{ color: COLORS.body }}>
      <span className="font-medium" style={{ color: COLORS.label }}>{label}:</span>{' '}
      {safe}
    </p>
  );
}

function BarRow({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 capitalize truncate" style={{ color: COLORS.label }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #f472b6, #a78bfa)',
          }}
        />
      </div>
      <span className="text-[10px] w-8 text-right" style={{ color: COLORS.label }}>
        {typeof value === 'number' ? (value <= 1 ? `${Math.round(value * 100)}%` : Math.round(value)) : value}
      </span>
    </div>
  );
}

function Big5Display({ big5 }: { big5: Record<string, number> }) {
  const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
  const displayLabels: Record<string, string> = {
    openness: 'Openness',
    conscientiousness: 'Conscientiousness',
    extraversion: 'Extraversion',
    agreeableness: 'Agreeableness',
    neuroticism: 'Neuroticism',
  };

  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: COLORS.label }}>
        Big Five Personality
      </p>
      <div className="space-y-1.5">
        {traits.map((trait) => {
          const val = big5[trait];
          if (val === undefined) return null;
          return <BarRow key={trait} label={displayLabels[trait] || trait} value={val} maxValue={100} />;
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ASTROLOGICAL SECTION (tabbed)
// ============================================================================

function AstrologicalSection({ astro, activeTab, onTabChange }: {
  astro: NonNullable<TruthCardSharedData['astrological']>;
  activeTab: 'western' | 'chinese' | 'african' | 'numerology' | 'synthesis';
  onTabChange: (tab: 'western' | 'chinese' | 'african' | 'numerology' | 'synthesis') => void;
}) {
  const tabs: Array<{ id: typeof activeTab; label: string; icon: string }> = [
    { id: 'western', label: 'Western', icon: SECTION_ICONS.western },
    { id: 'chinese', label: 'Chinese', icon: SECTION_ICONS.chinese },
    { id: 'african', label: 'African', icon: SECTION_ICONS.african },
    { id: 'numerology', label: 'Numerology', icon: SECTION_ICONS.numerology },
    { id: 'synthesis', label: 'Synthesis', icon: SECTION_ICONS.synthesis },
  ];

  // Filter tabs to only show those with data
  const availableTabs = tabs.filter((t) => {
    if (t.id === 'western') return !!astro.western || !!astro.westernSign;
    if (t.id === 'chinese') return !!astro.chinese || !!astro.chineseSign;
    if (t.id === 'african') return !!astro.african;
    if (t.id === 'numerology') return !!astro.numerology;
    if (t.id === 'synthesis') return !!astro.synthesisData || !!astro.synthesis;
    return false;
  });

  if (availableTabs.length === 0) {
    // Fallback: just show basic signs
    return (
      <SectionPanel label="Astrological Profile" icon={'\u2728'}>
        {astro.westernSign && <DetailRow label="Sun Sign" value={astro.westernSign} />}
        {astro.chineseSign && <DetailRow label="Chinese Zodiac" value={astro.chineseSign} />}
        {astro.synthesis && <p className="text-xs mt-1" style={{ color: COLORS.body }}>{astro.synthesis}</p>}
      </SectionPanel>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Section label */}
      <div className="px-3 pt-3 pb-0">
        <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>
          {'\u2728'} Astrological Profile
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="px-2.5 py-1.5 text-[10px] font-medium rounded-t-lg transition-all whitespace-nowrap flex items-center gap-1"
            style={{
              background: activeTab === tab.id
                ? 'rgba(244,114,182,0.15)'
                : 'transparent',
              borderBottom: activeTab === tab.id
                ? '2px solid #f472b6'
                : '2px solid transparent',
              color: activeTab === tab.id ? COLORS.heading : COLORS.label,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-3">
        {activeTab === 'western' && <WesternTab astro={astro} />}
        {activeTab === 'chinese' && <ChineseTab astro={astro} />}
        {activeTab === 'african' && <AfricanTab astro={astro} />}
        {activeTab === 'numerology' && <NumerologyTab astro={astro} />}
        {activeTab === 'synthesis' && <SynthesisTab astro={astro} />}
      </div>
    </div>
  );
}

// ============================================================================
// ASTROLOGICAL TAB CONTENT
// ============================================================================

function WesternTab({ astro }: { astro: NonNullable<TruthCardSharedData['astrological']> }) {
  const w = astro.western;
  if (!w && !astro.westernSign) return <NoData />;
  if (!w) return <DetailRow label="Sun Sign" value={astro.westernSign} />;

  return (
    <div className="space-y-3">
      {/* Core triad */}
      <div className="grid grid-cols-3 gap-2">
        <SignBadge label="Sun" value={w.sunSign} />
        <SignBadge label="Moon" value={w.moonSign} />
        <SignBadge label="Rising" value={w.risingSign} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {w.dominantElement && <DetailRow label="Element" value={w.dominantElement} />}
        {w.modality && <DetailRow label="Modality" value={w.modality} />}
        {w.chartRuler && <DetailRow label="Chart Ruler" value={w.chartRuler} />}
      </div>

      {/* Planetary Placements */}
      {w.planetaryPlacements && Object.keys(w.planetaryPlacements).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: COLORS.label }}>
            Planetary Placements
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(w.planetaryPlacements).map(([planet, sign]) => (
              <DetailRow key={planet} label={planet} value={sign} />
            ))}
          </div>
        </div>
      )}

      {/* Houses */}
      {w.houses && Object.keys(w.houses).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: COLORS.label }}>
            House Placements
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(w.houses).map(([house, sign]) => (
              <DetailRow key={house} label={`House ${house}`} value={sign} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChineseTab({ astro }: { astro: NonNullable<TruthCardSharedData['astrological']> }) {
  const c = astro.chinese;
  if (!c && !astro.chineseSign) return <NoData />;
  if (!c) return <DetailRow label="Animal Sign" value={astro.chineseSign} />;

  return (
    <div className="space-y-3">
      {/* Primary identity */}
      <div className="text-center py-2">
        <p className="text-2xl font-bold" style={{ color: COLORS.heading }}>{c.animalSign}</p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.body }}>
          {c.element} {c.yinYang && `\u00b7 ${c.yinYang}`}
        </p>
      </div>

      {/* Animal triad */}
      {(c.innerAnimal || c.secretAnimal) && (
        <div className="grid grid-cols-2 gap-2">
          {c.innerAnimal && <SignBadge label="Inner Animal" value={c.innerAnimal} />}
          {c.secretAnimal && <SignBadge label="Secret Animal" value={c.secretAnimal} />}
        </div>
      )}

      {/* Life Phase */}
      {c.lifePhase && <DetailRow label="Life Phase" value={c.lifePhase} />}

      {/* Personality traits */}
      {c.personality && c.personality.length > 0 && (
        <TagGroup label="Personality Traits" items={c.personality} color="rgba(16,185,129,0.15)" borderColor="rgba(16,185,129,0.25)" />
      )}

      {/* Compatibility */}
      {c.compatibility && c.compatibility.length > 0 && (
        <TagGroup label="Best Compatibility" items={c.compatibility} color="rgba(244,114,182,0.15)" borderColor="rgba(244,114,182,0.25)" />
      )}

      {/* Lucky */}
      <div className="grid grid-cols-2 gap-2">
        {c.luckyNumbers && c.luckyNumbers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>Lucky Numbers</p>
            <div className="flex gap-1.5 flex-wrap">
              {c.luckyNumbers.map((n) => (
                <span
                  key={n}
                  className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))',
                    border: '1px solid rgba(244,114,182,0.3)',
                    color: COLORS.heading,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {c.luckyColors && c.luckyColors.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>Lucky Colors</p>
            <div className="flex flex-wrap gap-1">
              {c.luckyColors.map((color) => (
                <span
                  key={color}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: COLORS.body }}
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AfricanTab({ astro }: { astro: NonNullable<TruthCardSharedData['astrological']> }) {
  const a = astro.african;
  if (!a) return <NoData />;

  return (
    <div className="space-y-3">
      {/* Primary identity */}
      <div className="text-center py-2">
        <p className="text-2xl font-bold" style={{ color: COLORS.heading }}>{a.orishaGuardian}</p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.body }}>
          {a.elementalForce} {a.sacredAnimal && `\u00b7 ${a.sacredAnimal}`}
        </p>
      </div>

      {/* Core details */}
      {a.ancestralSpirit && <DetailRow label="Ancestral Spirit" value={a.ancestralSpirit} />}
      {a.lifeDestiny && <DetailRow label="Life Destiny" value={a.lifeDestiny} />}
      {a.seasons && <DetailRow label="Season" value={a.seasons} />}

      {/* Spiritual Gifts */}
      {a.spiritualGifts && a.spiritualGifts.length > 0 && (
        <TagGroup label="Spiritual Gifts" items={a.spiritualGifts} color="rgba(251,191,36,0.15)" borderColor="rgba(251,191,36,0.25)" />
      )}

      {/* Challenges */}
      {a.challenges && a.challenges.length > 0 && (
        <TagGroup label="Challenges" items={a.challenges} color="rgba(239,68,68,0.1)" borderColor="rgba(239,68,68,0.2)" />
      )}

      {/* Ceremonies */}
      {a.ceremonies && a.ceremonies.length > 0 && (
        <TagGroup label="Sacred Ceremonies" items={a.ceremonies} color="rgba(167,139,250,0.15)" borderColor="rgba(167,139,250,0.25)" />
      )}
    </div>
  );
}

function NumerologyTab({ astro }: { astro: NonNullable<TruthCardSharedData['astrological']> }) {
  const n = astro.numerology;
  if (!n) return <NoData />;

  const numbers = [
    { label: 'Life Path', value: n.lifePathNumber, color: 'from-emerald-400 to-teal-400' },
    { label: 'Destiny', value: n.destinyNumber, color: 'from-blue-400 to-indigo-400' },
    { label: 'Soul Urge', value: n.soulUrgeNumber, color: 'from-rose-400 to-pink-400' },
    { label: 'Personality', value: n.personalityNumber, color: 'from-amber-400 to-orange-400' },
    { label: 'Birthday', value: n.birthDayNumber, color: 'from-violet-400 to-purple-400' },
  ].filter((item) => item.value !== undefined && item.value !== null);

  return (
    <div className="space-y-3">
      {/* Number grid */}
      <div className="grid grid-cols-5 gap-2">
        {numbers.map((item) => (
          <div key={item.label} className="text-center">
            <div
              className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-1"
              style={{
                background: `linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))`,
                border: '2px solid rgba(244,114,182,0.3)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              }}
            >
              <span className="text-lg font-bold" style={{ color: COLORS.heading }}>{item.value}</span>
            </div>
            <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: COLORS.label }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Meanings */}
      {n.meanings && Object.keys(n.meanings).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: COLORS.label }}>
            Interpretations
          </p>
          {Object.entries(n.meanings).map(([key, meaning]) => (
            <div key={key} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] font-bold capitalize mb-0.5" style={{ color: COLORS.heading }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>{meaning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SynthesisTab({ astro }: { astro: NonNullable<TruthCardSharedData['astrological']> }) {
  const s = astro.synthesisData;
  if (!s && !astro.synthesis) return <NoData />;

  // Fallback to basic synthesis
  if (!s) {
    return <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>{astro.synthesis}</p>;
  }

  const insights = [
    { label: 'Life Direction', value: s.lifeDirection, icon: '\ud83e\udded' },
    { label: 'Spiritual Path', value: s.spiritualPath, icon: '\ud83e\uddd8' },
    { label: 'Relationships', value: s.relationships, icon: '\ud83d\udc9e' },
    { label: 'Career', value: s.career, icon: '\ud83d\udcbc' },
    { label: 'Wellness', value: s.wellness, icon: '\ud83c\udf3f' },
  ].filter((item) => !!item.value);

  return (
    <div className="space-y-3">
      {/* Core Themes */}
      {s.coreThemes && s.coreThemes.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: COLORS.label }}>
            Core Themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {s.coreThemes.map((theme) => (
              <span
                key={theme}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))',
                  border: '1px solid rgba(244,114,182,0.25)',
                  color: COLORS.heading,
                }}
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insight cards */}
      {insights.map((insight) => (
        <div key={insight.label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] font-bold mb-0.5" style={{ color: COLORS.heading }}>
            {insight.icon} {insight.label}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>{insight.value}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SHARED UI ATOMS
// ============================================================================

function SignBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="text-center rounded-xl p-2"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <p className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: COLORS.label }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: COLORS.heading }}>{value}</p>
    </div>
  );
}

function TagGroup({ label, items, color, borderColor }: { label: string; items: string[]; color: string; borderColor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: color, border: `1px solid ${borderColor}`, color: COLORS.body }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function NoData() {
  return <p className="text-[10px] italic" style={{ color: COLORS.label }}>Data not available</p>;
}

// ============================================================================
// VOICE PLAYER (compact version for review context)
// ============================================================================

function VoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioError) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => setAudioError(true));
    }
  }, [playing, audioError]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (audioError) {
    return (
      <div className="rounded-xl p-2 text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: COLORS.label }}>
        Voice greeting unavailable
      </div>
    );
  }

  return (
    <div className="rounded-xl p-2.5 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          if (isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onError={() => setAudioError(true)}
      />
      <button onClick={toggle}
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))',
          border: '1px solid rgba(244,114,182,0.3)',
        }}
        aria-label={playing ? 'Pause voice greeting' : 'Play voice greeting'}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: COLORS.heading }}>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: COLORS.heading }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: COLORS.label }}>
          Voice Greeting
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #f472b6, #a78bfa)',
              }} />
          </div>
          <span className="text-[10px] flex-shrink-0" style={{ color: COLORS.label }}>
            {formatTime(currentTime)}/{formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}