// src/components/truthstream/ProfileSetup.tsx
// Create or edit a TruthStream Truth Card profile
// Includes embedded VisualStep camera/upload UI and VocalStep recording UI as collapsible panels
// Professional astrological data display with tabs

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTruthStream } from '../../context/TruthStreamContext';
import { getTruthCard } from '../../services/truthStreamApi';
import { getToken } from '../../utils/token';
import { useFaceApi } from '../../hooks/useFaceApi';
import { motion, AnimatePresence } from 'framer-motion';
import GlassySakuraOrb from '../visualizers/GlassySakuraOrb';
import {
  AGE_RANGES,
  FEEDBACK_AREAS,
  MINIMUM_SHARE_COUNT,
  type AgeRange,
  type FeedbackArea,
  type TruthStreamShareableType,
  type TruthCardData,
} from '../../types/truthstream';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { buildStorageRetrieveUrl } from '../../utils/storageUrl';

const SHAREABLE_OPTIONS: { value: TruthStreamShareableType; label: string; icon: string }[] = [
  { value: 'personality', label: 'Personality Profile', icon: '🧠' },
  { value: 'cognitive', label: 'Cognitive Style', icon: '💡' },
  { value: 'facial', label: 'Photo / Facial', icon: '📸' },
  { value: 'voice', label: 'Voice Signature', icon: '🎙' },
  { value: 'astrological', label: 'Astrological', icon: '✨' },
];

const COLORS = {
  heading: 'var(--dash-heading, #3d1428)',
  body: 'var(--dash-body, #4a1c30)',
  label: 'var(--mg-label, #2d0a16)',
};

// ============================================================================
// STORAGE UPLOAD
// ============================================================================
const STORAGE_ENDPOINT = '/mirror/api/storage/store';
const MAX_PHOTO_MB = 10;
const MAX_VOICE_MB = 25;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_VOICE_DURATION_SEC = 30;
const MIN_VOICE_DURATION_SEC = 3;
const PHOTO_MAX_DIMENSION = 800; // Max width or height in pixels
const PHOTO_JPEG_QUALITY = 0.82;
const ANALYSIS_WATCHDOG_MS = 20000; // clear stuck “Analyzing…” state

/**
 * Compress and resize an image to a max dimension and JPEG quality.
 * Returns a Blob that's always JPEG (smaller, consistent).
 */
async function compressImage(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Scale down if either dimension exceeds max
      if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
        const scale = PHOTO_MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Image compression failed'));
        },
        'image/jpeg',
        PHOTO_JPEG_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image for compression')); };
    img.src = url;
  });
}

async function uploadToStorage(
  fileOrBlob: File | Blob,
  type: 'photo' | 'voice',
  userId: number,
  retryCount = 0
): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  if (!fileOrBlob || fileOrBlob.size === 0) {
    throw new Error(`Invalid ${type} file: file is empty`);
  }

  const form = new FormData();

  if (type === 'photo') {
    if (fileOrBlob.size > MAX_PHOTO_MB * 1024 * 1024) {
      throw new Error(`Photo exceeds ${MAX_PHOTO_MB}MB limit`);
    }
    if (fileOrBlob instanceof File && !ALLOWED_IMAGE_TYPES.has(fileOrBlob.type)) {
      throw new Error('Photo must be JPEG, PNG, or WebP format');
    }
    // Compress and resize before upload
    const compressed = await compressImage(fileOrBlob);
    const safeName = fileOrBlob instanceof File
      ? fileOrBlob.name.replace(/[^\w.\-]/g, '_').replace(/\.+/g, '.').replace(/\.\w+$/, '.jpg').slice(0, 120) || 'photo.jpg'
      : 'profile_photo.jpg';
    form.append('data', compressed, safeName);
    form.append('filename', safeName);
    form.append('tier', 'tier1');
  } else {
    if (fileOrBlob.size > MAX_VOICE_MB * 1024 * 1024) {
      throw new Error(`Voice recording exceeds ${MAX_VOICE_MB}MB limit`);
    }
    const mimeToExt: Record<string, string> = {
      'audio/webm': '.webm', 'audio/webm;codecs=opus': '.webm',
      'audio/mp4': '.m4a', 'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
    };
    const ext = mimeToExt[fileOrBlob.type] || '.webm';
    const safeName = `vocal_salutation${ext}`;
    form.append('data', fileOrBlob, safeName);
    form.append('filename', safeName);
    form.append('tier', 'tier2');
  }

  form.append('userId', String(userId));
  form.append('mode', 'file');

  const baseUrl = import.meta.env.VITE_API_URL || '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const token = getToken('mirror_jwt');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${STORAGE_ENDPOINT}`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON response */ }

    if (!res.ok || !json?.success) {
      throw new Error(json?.error || `Upload failed (${res.status})`);
    }

    const files: any[] = Array.isArray(json.files) ? json.files : [];
    if (files.length === 0) throw new Error('Upload returned no files');

    return files[files.length - 1]?.filename || files[0]?.filename;
  } catch (err: any) {
    if (retryCount < MAX_RETRIES && (err.name === 'AbortError' || err.message?.includes('fetch'))) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, retryCount)));
      return uploadToStorage(fileOrBlob, type, userId, retryCount + 1);
    }
    throw err;
  }
}

// ============================================================================
// SAFE STORAGE URL BUILDER — delegates to shared utility
// Uses /mirror/api/storage/retrieve/:userId/:tier/:filename (the real server endpoint)
// ============================================================================
function safeStorageUrl(path: string | null | undefined, userId: number, tier?: 'tier1' | 'tier2' | 'tier3'): string | null {
  return buildStorageRetrieveUrl(path, userId, tier);
}

// ============================================================================
// DEVICE DETECTION (from VisualStep / VocalStep)
// ============================================================================
function detectDeviceInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
  const isFirefox = /Firefox/.test(ua) || /FxiOS/.test(ua);
  const supportsGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
  const isSecureContext = window.isSecureContext === true;
  return { isIOS, isAndroid, isMobile, isSafari, isFirefox, supportsGetUserMedia, isSecureContext };
}

// ============================================================================
// EXPRESSION METADATA (from VisualStep)
// ============================================================================
const EXPRESSION_META: Record<string, { label: string; color: string; glow: string }> = {
  neutral:   { label: 'Neutral',   color: '#94a3b8', glow: 'rgba(148,163,184,0.35)' },
  happy:     { label: 'Happy',     color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  sad:       { label: 'Sad',       color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  angry:     { label: 'Angry',     color: '#f87171', glow: 'rgba(248,113,113,0.35)' },
  fearful:   { label: 'Fearful',   color: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  disgusted: { label: 'Disgusted', color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  surprised: { label: 'Surprised', color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
};

// ============================================================================
// SVG ICONS
// ============================================================================
const UploadIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <div className="flex-shrink-0" style={{ width: 20, height: 20 }}>
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  </div>
);


// ============================================================================
// EXPRESSION ANALYSIS METRICS (from VisualStep)
// ============================================================================
const AnalysisMetrics: React.FC<{ results: any; qualityScore: number }> = ({ results, qualityScore }) => {
  const expressions: Record<string, number> = results?.expressions || {};
  const qualityLabel = qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : qualityScore >= 40 ? 'Fair' : 'Poor';
  const ringColor = qualityScore >= 80 ? '#4ade80' : qualityScore >= 60 ? '#facc15' : qualityScore >= 40 ? '#fb923c' : '#f87171';
  const ringGlow = qualityScore >= 80 ? 'rgba(74,222,128,0.4)' : qualityScore >= 60 ? 'rgba(250,204,21,0.4)' : qualityScore >= 40 ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)';
  const sorted = Object.entries(expressions).filter(([key]) => key in EXPRESSION_META).sort(([, a], [, b]) => b - a);
  const dominant = sorted[0];
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (qualityScore / 100) * circumference;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div style={{ width: 46, height: 46, position: 'relative', flexShrink: 0 }}>
          <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
            <circle cx="23" cy="23" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle cx="23" cy="23" r={radius} fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 4px ${ringGlow})` }} />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: ringColor }}>{qualityScore}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p className="text-xs font-semibold" style={{ color: ringColor }}>{qualityLabel}</p>
          <p className="text-[10px]" style={{ color: COLORS.label }}>Detection confidence</p>
        </div>
        {dominant && (
          <div className="rounded-lg px-3 py-1.5 text-center" style={{ borderLeft: `3px solid ${EXPRESSION_META[dominant[0]].color}`, background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.heading }}>{EXPRESSION_META[dominant[0]].label}</p>
            <p className="text-[10px]" style={{ color: COLORS.label }}>Dominant</p>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {sorted.map(([key, value], i) => {
          const meta = EXPRESSION_META[key];
          const pct = Math.round(value * 100);
          return (
            <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }}
              className="flex items-center gap-2">
              <span className="text-[10px] w-14 text-right" style={{ color: COLORS.label }}>{meta.label}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 1)}%` }} transition={{ delay: 0.05 + i * 0.03, duration: 0.4 }}
                  className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})` }} />
              </div>
              <span className="text-[10px] font-semibold w-8 text-right font-mono" style={{ color: COLORS.body }}>{pct}%</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ============================================================================
// ASTROLOGICAL DISPLAY COMPONENT (tabbed professional layout)
// ============================================================================
// Accepts either the full dashboard astro data or the simpler truthstream card astro data
interface AstroDisplayData {
  // Full format from dashboard/personal-intelligence
  western?: { sunSign?: string; moonSign?: string; risingSign?: string; dominantElement?: string; modality?: string; chartRuler?: string };
  chinese?: { animalSign?: string; element?: string; yinYang?: string; personality?: string[] };
  african?: { orishaGuardian?: string; elementalForce?: string; sacredAnimal?: string; lifeDestiny?: string; spiritualGifts?: string[] };
  numerology?: { lifePathNumber?: number; destinyNumber?: number; soulUrgeNumber?: number; meanings?: Record<string, string> };
  synthesis?: { coreThemes?: string[]; lifeDirection?: string; spiritualPath?: string; relationships?: string; career?: string; wellness?: string };
  // Simple format from truthstream card
  westernSign?: string;
  chineseSign?: string;
}

const AstrologicalDisplay: React.FC<{ data: AstroDisplayData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'western' | 'chinese' | 'african' | 'numerology' | 'synthesis'>('western');

  // Normalize: accept both full and simple format
  const sunSign = data.western?.sunSign || data.westernSign;
  const moonSign = data.western?.moonSign;
  const risingSign = data.western?.risingSign;
  const animalSign = data.chinese?.animalSign || data.chineseSign;
  const chineseElement = data.chinese?.element;
  const african = data.african;
  const numerology = data.numerology;
  const synthesis = data.synthesis;

  if (!sunSign && !animalSign && !african && !numerology && !synthesis) {
    return <p className="text-xs italic" style={{ color: COLORS.label }}>Astrological data not available</p>;
  }

  const tabs = [
    { key: 'western' as const, label: 'Western', icon: '☀', available: !!sunSign },
    { key: 'chinese' as const, label: 'Chinese', icon: '🐉', available: !!animalSign },
    { key: 'african' as const, label: 'African', icon: '🌍', available: !!african?.orishaGuardian },
    { key: 'numerology' as const, label: 'Numbers', icon: '🔢', available: !!numerology?.lifePathNumber },
    { key: 'synthesis' as const, label: 'Synthesis', icon: '🔮', available: !!synthesis?.lifeDirection },
  ].filter(t => t.available);

  if (tabs.length === 0) return <p className="text-xs italic" style={{ color: COLORS.label }}>Astrological data not available</p>;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-all"
            style={{
              color: activeTab === tab.key ? COLORS.heading : COLORS.label,
              background: activeTab === tab.key ? 'rgba(244,114,182,0.1)' : 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid rgba(244,114,182,0.6)' : '2px solid transparent',
            }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="p-3">
        <AnimatePresence mode="wait">
          {activeTab === 'western' && sunSign && (
            <motion.div key="western" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(250,204,21,0.2), rgba(251,146,60,0.2))', border: '1px solid rgba(250,204,21,0.3)' }}>
                    <span>☀</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>Sun Sign</p>
                    <p className="text-sm font-bold" style={{ color: COLORS.body }}>{sunSign}</p>
                  </div>
                </div>
                {(moonSign || risingSign) && (
                  <div className="grid grid-cols-2 gap-2">
                    {moonSign && (
                      <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-[10px]" style={{ color: COLORS.label }}>Moon</p>
                        <p className="text-xs font-semibold" style={{ color: COLORS.body }}>{moonSign}</p>
                      </div>
                    )}
                    {risingSign && (
                      <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-[10px]" style={{ color: COLORS.label }}>Rising</p>
                        <p className="text-xs font-semibold" style={{ color: COLORS.body }}>{risingSign}</p>
                      </div>
                    )}
                  </div>
                )}
                {data.western?.dominantElement && (
                  <p className="text-[10px]" style={{ color: COLORS.label }}>Element: <span style={{ color: COLORS.body }}>{data.western.dominantElement}</span> · Modality: <span style={{ color: COLORS.body }}>{data.western?.modality}</span></p>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'chinese' && animalSign && (
            <motion.div key="chinese" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(251,146,60,0.2))', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span>🐉</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>Chinese Zodiac</p>
                    <p className="text-sm font-bold" style={{ color: COLORS.body }}>{animalSign}</p>
                  </div>
                </div>
                {chineseElement && (
                  <p className="text-[10px]" style={{ color: COLORS.label }}>Element: <span style={{ color: COLORS.body }}>{chineseElement}</span>{data.chinese?.yinYang && ` · ${data.chinese.yinYang}`}</p>
                )}
                {data.chinese?.personality && data.chinese.personality.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {data.chinese.personality.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: COLORS.body }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'african' && african?.orishaGuardian && (
            <motion.div key="african" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.2))', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <span>🌍</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>Orisha Guardian</p>
                    <p className="text-sm font-bold" style={{ color: COLORS.body }}>{african.orishaGuardian}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {african.elementalForce && (
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-[10px]" style={{ color: COLORS.label }}>Elemental Force</p>
                      <p className="text-xs font-semibold" style={{ color: COLORS.body }}>{african.elementalForce}</p>
                    </div>
                  )}
                  {african.sacredAnimal && (
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-[10px]" style={{ color: COLORS.label }}>Sacred Animal</p>
                      <p className="text-xs font-semibold" style={{ color: COLORS.body }}>{african.sacredAnimal}</p>
                    </div>
                  )}
                </div>
                {african.lifeDestiny && <p className="text-[10px]" style={{ color: COLORS.label }}>Destiny: <span style={{ color: COLORS.body }}>{african.lifeDestiny}</span></p>}
                {african.spiritualGifts && african.spiritualGifts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {african.spiritualGifts.map((g, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: COLORS.body }}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'numerology' && numerology?.lifePathNumber && (
            <motion.div key="numerology" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(96,165,250,0.3)', color: COLORS.body }}>
                    {numerology.lifePathNumber}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>Life Path Number</p>
                    <p className="text-xs" style={{ color: COLORS.body }}>{numerology.meanings?.lifePathNumber || ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {numerology.destinyNumber && (
                    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-sm font-bold" style={{ color: COLORS.body }}>{numerology.destinyNumber}</p>
                      <p className="text-[9px]" style={{ color: COLORS.label }}>Destiny</p>
                    </div>
                  )}
                  {numerology.soulUrgeNumber && (
                    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-sm font-bold" style={{ color: COLORS.body }}>{numerology.soulUrgeNumber}</p>
                      <p className="text-[9px]" style={{ color: COLORS.label }}>Soul Urge</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'synthesis' && synthesis?.lifeDirection && (
            <motion.div key="synthesis" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(244,114,182,0.2))', border: '1px solid rgba(167,139,250,0.3)' }}>
                    <span>🔮</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>Life Direction</p>
                    <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>{synthesis.lifeDirection}</p>
                  </div>
                </div>
                {synthesis.coreThemes && synthesis.coreThemes.length > 0 && (
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: COLORS.label }}>Core Themes</p>
                    <div className="flex flex-wrap gap-1">
                      {synthesis.coreThemes.map((t, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: COLORS.body }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {synthesis.career && (
                  <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px]" style={{ color: COLORS.label }}>Career Path</p>
                    <p className="text-[11px]" style={{ color: COLORS.body }}>{synthesis.career}</p>
                  </div>
                )}
                {synthesis.relationships && (
                  <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px]" style={{ color: COLORS.label }}>Relationships</p>
                    <p className="text-[11px]" style={{ color: COLORS.body }}>{synthesis.relationships}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


// ============================================================================
// EMBEDDED PHOTO CAPTURE PANEL
// Native-capture mechanics (matches intake VisualStep): mobile uses the OS
// camera via <input capture>, desktop uploads. Face analysis here is OPTIONAL,
// display-only quality feedback — it is never persisted and never blocks. The
// photo uploads to storage immediately; only its path is saved by the parent.
// The same panel serves both create and edit (avatar replacement) modes.
// ============================================================================
function PhotoCapturePanel({
  onPhotoUploaded,
  onPhotoRemoved,
  existingPhotoPath,
  userId,
}: {
  onPhotoUploaded: (path: string, preview: string) => void;
  onPhotoRemoved: () => void;
  existingPhotoPath: string | null;
  userId: number;
}) {
  const { isModelLoaded, loadingProgress, analyzeImage } = useFaceApi();
  const device = detectDeviceInfo();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);   // library / file chooser
  const imgRef = useRef<HTMLImageElement>(null);
  const mountedRef = useRef(true);
  const isAnalyzingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Change Photo" reveals the picker even when an existing photo is present.
  const [changing, setChanging] = useState(false);

  // Analysis state (OPTIONAL — quality feedback only; never persisted)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [qualityScore, setQualityScore] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [imgMounted, setImgMounted] = useState(false);
  const imgCallbackRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    setImgMounted(!!node);
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearWatchdog();
      if (photoPreview && photoPreview.startsWith('blob:')) { try { URL.revokeObjectURL(photoPreview); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Optional face analysis (non-blocking quality feedback) ──
  const analyzePhoto = useCallback(async () => {
    if (isAnalyzingRef.current || !imgRef.current || !isModelLoaded) return;
    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setAnalysisError(null);

    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (mountedRef.current && isAnalyzingRef.current) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        setAnalysisError('Analysis timed out — you can retry. Your photo is already saved.');
      }
    }, ANALYSIS_WATCHDOG_MS);

    try {
      const result = await analyzeImage(imgRef.current);
      if (!result?.expressions) throw new Error('No face detected. Your photo is still saved.');
      const rawScore = (result as any)?.detection?.score ?? (result as any)?.detection?._score ?? 0;
      const qs = Math.round(Math.max(0, Math.min(1, Number(rawScore) || 0)) * 100);
      clearWatchdog();
      if (mountedRef.current) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        setAnalysisResults(result);
        setQualityScore(qs);
      }
    } catch (err: any) {
      clearWatchdog();
      if (mountedRef.current) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        setAnalysisError(err?.message || 'Analysis failed. Your photo is still saved.');
      }
    }
  }, [analyzeImage, isModelLoaded, clearWatchdog]);

  // Auto-run analysis once the <img> has decoded (cached / fast blob URL).
  useEffect(() => {
    if (!hasPhoto || !photoPreview || isAnalyzingRef.current || analysisResults || !isModelLoaded) return;
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      const t = setTimeout(() => { if (mountedRef.current && !isAnalyzingRef.current) analyzePhoto(); }, 250);
      return () => clearTimeout(t);
    }
  }, [hasPhoto, photoPreview, analysisResults, isModelLoaded, analyzePhoto, imgMounted]);

  const onImgLoad = useCallback(() => {
    if (!mountedRef.current || analysisResults || isAnalyzingRef.current || !isModelLoaded) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setTimeout(() => { if (mountedRef.current && !isAnalyzingRef.current) analyzePhoto(); }, 250);
    }
  }, [analysisResults, isModelLoaded, analyzePhoto]);

  const onImgError = useCallback(() => {
    // The <img> couldn't decode (HEIC, corrupt). compressImage() in
    // uploadToStorage uses the same decode path and will also have failed —
    // surface a clear message rather than leaving a broken preview.
    if (!mountedRef.current) return;
    clearWatchdog();
    isAnalyzingRef.current = false;
    setIsAnalyzing(false);
    setAnalysisResults(null);
    setError('We couldn’t read that image. Please choose a JPEG, PNG, or WebP photo.');
  }, [clearWatchdog]);

  // ── File intake (photo upload); uploads immediately ──
  const acceptFile = useCallback((file: File) => {
    const nameLower = (file.name || '').toLowerCase();
    if (/\.(heic|heif)$/i.test(nameLower) || file.type === 'image/heic' || file.type === 'image/heif') {
      setError('HEIC/HEIF photos aren’t supported directly. On iPhone, choosing the photo from your library usually converts it to JPEG automatically — otherwise set Camera → Formats → “Most Compatible”, or pick a JPEG/PNG.');
      return;
    }
    const typeOk = ALLOWED_IMAGE_TYPES.has(file.type);
    const extOk = /\.(jpe?g|png|webp)$/i.test(nameLower);
    if (!typeOk && !(file.type === '' && extOk)) { setError('Please choose a JPEG, PNG, or WebP image.'); return; }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) { setError(`Image too large. Max ${MAX_PHOTO_MB}MB.`); return; }
    if (file.size < 1024) { setError('That file looks empty or corrupted.'); return; }

    if (photoPreview && photoPreview.startsWith('blob:')) { try { URL.revokeObjectURL(photoPreview); } catch { /* noop */ } }
    clearWatchdog();
    isAnalyzingRef.current = false;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setHasPhoto(true);
    setChanging(false);
    setAnalysisResults(null);
    setQualityScore(0);
    setAnalysisError(null);
    setError(null);

    // Upload immediately (storage path is what gets persisted by the parent).
    setUploading(true);
    uploadToStorage(file, 'photo', userId)
      .then(filename => { if (mountedRef.current) onPhotoUploaded(filename, preview); })
      .catch(err => { if (mountedRef.current) setError(`Upload failed: ${err.message}`); })
      .finally(() => { if (mountedRef.current) setUploading(false); });
  }, [photoPreview, clearWatchdog, userId, onPhotoUploaded]);

  const onUploadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (file) acceptFile(file);
  }, [acceptFile]);

  const startOver = useCallback(() => {
    clearWatchdog();
    if (photoPreview && photoPreview.startsWith('blob:')) { try { URL.revokeObjectURL(photoPreview); } catch { /* noop */ } }
    setPhotoPreview(null);
    setHasPhoto(false);
    setChanging(false);
    isAnalyzingRef.current = false;
    setAnalysisResults(null);
    setQualityScore(0);
    setAnalysisError(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onPhotoRemoved();
  }, [clearWatchdog, photoPreview, onPhotoRemoved]);

  const showMethodPicker = !hasPhoto && (!existingPhotoPath || changing);
  const showExistingOnly = !hasPhoto && !!existingPhotoPath && !changing;

  return (
    <div className="space-y-3">
      {/* Existing photo thumbnail (edit / avatar-replace mode) */}
      {showExistingOnly && (
        <div className="flex items-center gap-4">
          <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: 80, height: 80, minWidth: 80, minHeight: 80, border: '2px solid rgba(244,114,182,0.3)' }}>
            <img src={safeStorageUrl(existingPhotoPath, userId, 'tier1') || ''} alt="Current" style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
          </div>
          <div className="space-y-2">
            <p className="text-xs" style={{ color: COLORS.label }}>Current photo uploaded</p>
            <div className="flex gap-2">
              <button onClick={() => { setChanging(true); setError(null); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(244,114,182,0.4)', color: COLORS.heading }}>
                Change Photo
              </button>
              <button onClick={() => { onPhotoRemoved(); }} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: COLORS.label, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Method picker — upload only. The native-camera "Take Photo" tile was
          removed: it was gated on flaky UA-based device detection and offered
          nothing over picking a library photo, which on iOS also transcodes
          HEIC → JPEG automatically. */}
      {showMethodPicker && (
        <>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => fileInputRef.current?.click()} aria-label="Upload a photo from your device"
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              <div style={{ color: COLORS.body }}><UploadIcon /></div>
              <div className="text-center">
                <p className="text-xs font-semibold" style={{ color: COLORS.heading }}>Upload a photo</p>
                <p className="text-[10px]" style={{ color: COLORS.label }}>{device.isMobile ? 'From your photo library' : 'JPEG, PNG, or WebP'}</p>
              </div>
            </button>
          </div>
          {changing && !!existingPhotoPath && (
            <button onClick={() => { setChanging(false); setError(null); }} className="text-[10px] underline" style={{ color: COLORS.label }}>
              Keep current photo
            </button>
          )}
        </>
      )}

      {/* Photo preview + optional analysis */}
      {hasPhoto && photoPreview && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden mx-auto" style={{ maxWidth: 280 }}>
            <img ref={imgCallbackRef} src={photoPreview} alt="Your photo" onLoad={onImgLoad} onError={onImgError} className="w-full block rounded-xl" style={{ objectFit: 'cover', maxHeight: 280 }} />
            {isAnalyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-lg">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white" />
                  <span className="text-white text-[10px]">Analyzing…</span>
                </div>
              </div>
            )}
            {analysisResults && (
              <div className="absolute top-2 right-2">
                <div className="flex items-center gap-1 bg-green-500/90 text-white text-[10px] font-medium px-2 py-0.5 rounded-full shadow">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Analyzed
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute bottom-2 left-2 right-2">
                <div className="flex items-center gap-2 bg-black/60 px-2 py-1 rounded-lg">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white" />
                  <span className="text-white text-[10px]">Uploading…</span>
                </div>
              </div>
            )}
          </div>

          {analysisResults && <AnalysisMetrics results={analysisResults} qualityScore={qualityScore} />}
          {analysisError && (
            <p className="text-[10px]" style={{ color: COLORS.label }}>
              {analysisError} <span className="opacity-60">Analysis is optional for your Truth Card.</span>
            </p>
          )}

          <div className="flex gap-2 justify-center">
            <button onClick={startOver} disabled={isAnalyzing || uploading}
              className="px-4 py-1.5 rounded-lg text-xs font-medium" style={{ color: COLORS.heading, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              New Photo
            </button>
            {!analysisResults && !isAnalyzing && isModelLoaded && (
              <button onClick={analyzePhoto} className="px-4 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(96,165,250,0.2))', border: '1px solid rgba(167,139,250,0.4)', color: COLORS.heading }}>
                {analysisError ? 'Try Again' : 'Analyze Face'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Face API loading indicator (only meaningful once a photo is present) */}
      {!isModelLoaded && hasPhoto && !analysisResults && (
        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-pink-400" />
          <span className="text-[10px]" style={{ color: COLORS.label }}>Loading face analysis engine… {typeof loadingProgress === 'string' ? loadingProgress : ''}</span>
        </div>
      )}

      {error && <p className="text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>{error}</p>}

      {/* Hidden input: upload chooser (on iOS, selecting a HEIC photo here
          transcodes it to JPEG because the accept list omits HEIC). */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadChange} className="hidden" />

      <p className="text-[10px]" style={{ color: COLORS.label }}>
        For best results: good lighting, face the camera directly.
        {device.isIOS && ' iPhone HEIC photos are converted to JPEG automatically when you upload from your library.'}
      </p>
    </div>
  );
}


// ============================================================================
// EMBEDDED VOCAL RECORDING PANEL (core VocalStep mechanics)
// ============================================================================
function VocalRecordingPanel({
  onVoiceUploaded,
  onVoiceRemoved,
  existingVoicePath,
  userId,
}: {
  onVoiceUploaded: (path: string) => void;
  onVoiceRemoved: () => void;
  existingVoicePath: string | null;
  userId: number;
}) {
  const device = detectDeviceInfo();
  const mountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const vizRunningRef = useRef(false);
  const startingRef = useRef(false);
  const recordingStartRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceBlobUrl, setVoiceBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(48).fill(0));

  const prompt = 'Say hello and introduce yourself naturally. Share your name and a little about who you are.';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  // Tab visibility: stop recording on hide
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && mediaRecorderRef.current?.state === 'recording') stopRecording();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const cleanup = useCallback(() => {
    vizRunningRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    try { sourceNodeRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close().catch(() => {});
    }
  }, []);

  // Visualization loop
  const updateVisualization = useCallback(() => {
    if (!analyserRef.current || !vizRunningRef.current) return;
    const buf = analyserRef.current.frequencyBinCount;
    const data = new Uint8Array(buf);
    analyserRef.current.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < buf; i++) sum += data[i] / 255;
    setAudioLevel(sum / buf);
    const barCount = 48;
    const blockSize = Math.max(1, Math.floor(buf / barCount));
    const bins: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let bs = 0;
      for (let j = 0; j < blockSize; j++) { const idx = i * blockSize + j; if (idx < buf) bs += data[idx]; }
      bins.push((bs / blockSize) / 255);
    }
    setAudioWaveform(bins);
    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  }, []);

  const stopRecording = useCallback(() => {
    vizRunningRef.current = false;
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    setCountdown(null);
    setAudioLevel(0);
    setAudioWaveform(new Array(48).fill(0));
  }, []);

  const startRecording = useCallback(async () => {
    if (startingRef.current || isRecording || countdown !== null) return;
    startingRef.current = true;
    setVoiceError(null);

    let stream: MediaStream | null = null;
    try {
      // Three-tier constraint fallback
      const tiers = [
        { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: device.isMobile ? 16000 : 44100 } },
        { audio: { echoCancellation: true, noiseSuppression: true } },
        { audio: true as const },
      ];
      for (const c of tiers) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch {}
      }
      if (!stream) { setVoiceError('Microphone access denied.'); return; }

      streamRef.current = stream;

      // AudioContext for visualization
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AC();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume().catch(() => {});
      }
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.82;
      sourceNodeRef.current.connect(analyserRef.current);
      vizRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updateVisualization);

      // Codec negotiation
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const mimeType = isSafari ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (voiceBlobUrl) URL.revokeObjectURL(voiceBlobUrl);
        const url = URL.createObjectURL(blob);
        if (mountedRef.current) {
          setVoiceBlob(blob);
          setVoiceBlobUrl(url);
          // Auto-upload
          setUploading(true);
          uploadToStorage(blob, 'voice', userId)
            .then(filename => { if (mountedRef.current) onVoiceUploaded(filename); })
            .catch(err => { if (mountedRef.current) setVoiceError(`Upload failed: ${err.message}`); })
            .finally(() => { if (mountedRef.current) setUploading(false); });
        }
      };

      // Countdown then start
      setRecordingDuration(0);
      setCountdown(3);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
            try {
              const timeslice = device.isIOS ? 1000 : (device.isMobile ? 500 : 100);
              recorder.start(timeslice);
              setIsRecording(true);
              recordingStartRef.current = Date.now();
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => {
                if (!recordingStartRef.current) return;
                const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
                setRecordingDuration(elapsed);
                if (elapsed >= MAX_VOICE_DURATION_SEC) stopRecording();
              }, 250);
            } catch { setVoiceError('Failed to start recording.'); }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (err.name === 'NotAllowedError') setVoiceError('Microphone permission denied. Allow access in browser settings.');
      else if (err.name === 'NotFoundError') setVoiceError('No microphone found.');
      else setVoiceError(`Recording failed: ${err.message || 'Unknown error'}`);
    } finally {
      startingRef.current = false;
    }
  }, [isRecording, countdown, device, updateVisualization, stopRecording, voiceBlobUrl, userId, onVoiceUploaded]);

  const resetRecording = useCallback(() => {
    if (voiceBlobUrl) URL.revokeObjectURL(voiceBlobUrl);
    setVoiceBlob(null);
    setVoiceBlobUrl(null);
    setRecordingDuration(0);
    setVoiceError(null);
    onVoiceRemoved();
  }, [voiceBlobUrl, onVoiceRemoved]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const remaining = Math.max(0, MAX_VOICE_DURATION_SEC - recordingDuration);
  const progressPct = Math.min(100, (recordingDuration / MAX_VOICE_DURATION_SEC) * 100);
  const canStart = !isRecording && !voiceBlob && !uploading && countdown === null;

  return (
    <div className="space-y-3">
      {/* Reading prompt */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>Your Voice Greeting ({MIN_VOICE_DURATION_SEC}-{MAX_VOICE_DURATION_SEC}s):</p>
        <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>{prompt}</p>
      </div>

      {/* Existing voice playback */}
      {existingVoicePath && !voiceBlobUrl && !isRecording && countdown === null && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] mb-1" style={{ color: COLORS.label }}>Current voice greeting:</p>
          <audio src={safeStorageUrl(existingVoicePath, userId, 'tier2') || ''} controls className="w-full" style={{ height: 36 }} />
        </div>
      )}

      {/* Countdown */}
      <AnimatePresence mode="wait">
        {countdown !== null && (
          <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }}
            className="text-center py-4">
            <div className="text-4xl font-bold" style={{ color: COLORS.heading }}>{countdown}</div>
            <p className="text-xs mt-1" style={{ color: COLORS.label }}>Get ready...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle orb */}
      {canStart && !existingVoicePath && (
        <div className="flex justify-center py-2">
          <GlassySakuraOrb level={0.06} active={false} size={120} className="opacity-80" />
        </div>
      )}

      {/* Recording status + live orb */}
      {isRecording && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
          <p className="text-xs" style={{ color: COLORS.body }}>
            {recordingDuration < MIN_VOICE_DURATION_SEC ? `Keep recording (min ${MIN_VOICE_DURATION_SEC}s)` : `Recording... (max ${MAX_VOICE_DURATION_SEC}s)`}
          </p>
          {/* Progress bar */}
          <div className="w-full max-w-sm mx-auto">
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${progressPct}%`,
                  background: recordingDuration < MIN_VOICE_DURATION_SEC
                    ? 'linear-gradient(90deg, #eab308, #f97316)' : 'linear-gradient(90deg, #a855f7, #3b82f6)',
                }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px]" style={{ color: COLORS.label }}>
              <span>{formatTime(recordingDuration)}</span>
              <span>{formatTime(remaining)}</span>
            </div>
          </div>
          {/* Live visualization orb */}
          <div className="flex justify-center">
            <GlassySakuraOrb level={Math.min(1, audioLevel)} spectrum={audioWaveform} active={true} size={180} className="opacity-100" />
          </div>
          <button onClick={stopRecording} className="px-5 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--mirror-error, #991b1b)' }}>
            Stop Recording
          </button>
        </motion.div>
      )}

      {/* Playback of new recording */}
      {voiceBlobUrl && !isRecording && countdown === null && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] mb-1" style={{ color: COLORS.label }}>Recording complete!</p>
            <audio controls src={voiceBlobUrl} className="w-full" style={{ height: 36 }} />
            <div className="flex items-center gap-3 text-[10px] mt-1" style={{ color: COLORS.label }}>
              <span>Duration: {formatTime(recordingDuration)}</span>
              {voiceBlob && <span>Size: {(voiceBlob.size / 1024).toFixed(1)}KB</span>}
            </div>
            {recordingDuration < MIN_VOICE_DURATION_SEC && (
              <p className="text-[10px] mt-1" style={{ color: '#fbbf24' }}>Too short (min {MIN_VOICE_DURATION_SEC}s). Please re-record.</p>
            )}
            {uploading && (
              <div className="flex items-center gap-2 mt-1">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-pink-400/20 border-t-pink-400" />
                <span className="text-[10px]" style={{ color: COLORS.label }}>Uploading...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={resetRecording} disabled={uploading} className="px-4 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: COLORS.heading }}>
              Record Again
            </button>
          </div>
        </motion.div>
      )}

      {/* Start button */}
      {canStart && (
        <div className="text-center">
          <button onClick={startRecording} className="px-6 py-2.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(244,114,182,0.2))', border: '1px solid rgba(239,68,68,0.4)', color: COLORS.heading }}>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />
              {existingVoicePath ? 'Re-record' : 'Start Recording'}
            </span>
          </button>
        </div>
      )}

      {voiceError && <p className="text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>{voiceError}</p>}

      <p className="text-[10px]" style={{ color: COLORS.label }}>
        Tips: Quiet environment, speak naturally, device 6-12 inches away.
        {device.isIOS && ' Ensure Safari has microphone permission in Settings.'}
      </p>
    </div>
  );
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function ProfileSetup() {
  const { user } = useAuth();
  const { profile, isSubmitting, error, createProfile, updateProfile, setView } = useTruthStream();
  const isEditing = !!profile;

  const [displayAlias, setDisplayAlias] = useState(profile?.displayAlias || '');
  const [ageRange, setAgeRange] = useState<AgeRange | ''>((profile?.ageRange as AgeRange) || '');
  const [selfStatement, setSelfStatement] = useState(profile?.selfStatement || '');
  const [selectedAreas, setSelectedAreas] = useState<FeedbackArea[]>(profile?.feedbackAreas || []);
  const [sharedTypes, setSharedTypes] = useState<TruthStreamShareableType[]>(profile?.sharedDataTypes || []);
  const [localError, setLocalError] = useState<string | null>(null);

  // Photo/voice paths
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(profile?.photoPath || null);
  const [uploadedVoicePath, setUploadedVoicePath] = useState<string | null>(profile?.vocalSalutationPath || null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Collapsible panels
  const [photoOpen, setPhotoOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Reviewer preview + card data (also used for astro display)
  const [showPreview, setShowPreview] = useState(false);
  const [cardData, setCardData] = useState<TruthCardData | null>(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Astro tab
  const [astroOpen, setAstroOpen] = useState(false);
  const [astroData, setAstroData] = useState<any>(null);
  const [astroLoading, setAstroLoading] = useState(false);

  const fetchCardData = useCallback(async () => {
    if (!user?.id) return;
    setCardLoading(true);
    try {
      const res = await getTruthCard(user.id);
      if (res.data) setCardData(res.data);
    } catch {}
    setCardLoading(false);
  }, [user?.id]);

  // Fetch complete astro data from dashboard endpoint (not gated by sharedDataTypes)
  // Falls back to card shared data if dashboard reports unavailable (key name mismatch)
  const fetchAstroData = useCallback(async () => {
    setAstroLoading(true);
    try {
      const dashData = await getPersonalIntelligenceApi();
      if (dashData?.completeAstrologicalData?.available) {
        setAstroData(dashData.completeAstrologicalData);
      } else if (dashData?.completeAstrologicalData) {
        // Dashboard may report unavailable due to astrologicalResult/astrologicalData key mismatch;
        // check if the data fields are actually populated despite available=false
        const astro = dashData.completeAstrologicalData;
        if (astro.western?.sunSign || astro.chinese?.animalSign || astro.numerology || astro.synthesis) {
          setAstroData(astro);
        }
      }
    } catch {}
    setAstroLoading(false);
  }, []);

  // Fetch card data + astro data on mount
  useEffect(() => {
    if (!cardData && !cardLoading && user?.id) fetchCardData();
    if (!astroData && !astroLoading) fetchAstroData();
  }, [user?.id]);

  // Populate form fields from profile on first load only.
  // Using a ref to avoid overwriting user edits when profile re-fetches (e.g. after auto-save).
  const initializedFromProfile = useRef(false);
  useEffect(() => {
    if (profile && !initializedFromProfile.current) {
      initializedFromProfile.current = true;
      setDisplayAlias(profile.displayAlias || '');
      setAgeRange((profile.ageRange as AgeRange) || '');
      setSelfStatement(profile.selfStatement || '');
      setSelectedAreas(profile.feedbackAreas || []);
      setSharedTypes(profile.sharedDataTypes || []);
      if (profile.photoPath) setUploadedPhotoPath(profile.photoPath);
      if (profile.vocalSalutationPath) setUploadedVoicePath(profile.vocalSalutationPath);
    }
  }, [profile]);

  // Live update: when photo/voice uploaded, auto-save if editing
  const handlePhotoUploaded = useCallback(async (path: string, preview: string) => {
    setUploadedPhotoPath(path);
    setPhotoPreviewUrl(preview);
    if (isEditing && profile) {
      await updateProfile({ displayAlias: profile.displayAlias, photoPath: path });
      fetchCardData(); // refresh card data for preview
    }
  }, [isEditing, profile, updateProfile, fetchCardData]);

  const handlePhotoRemoved = useCallback(async () => {
    setUploadedPhotoPath(null);
    setPhotoPreviewUrl(null);
  }, []);

  const handleVoiceUploaded = useCallback(async (path: string) => {
    setUploadedVoicePath(path);
    if (isEditing && profile) {
      await updateProfile({ displayAlias: profile.displayAlias, vocalSalutationPath: path });
      fetchCardData();
    }
  }, [isEditing, profile, updateProfile, fetchCardData]);

  const handleVoiceRemoved = useCallback(() => {
    setUploadedVoicePath(null);
  }, []);

  const toggleArea = (area: FeedbackArea) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : prev.length < 5 ? [...prev, area] : prev
    );
  };

  const toggleShareType = (type: TruthStreamShareableType) => {
    setSharedTypes((prev) => {
      const removing = prev.includes(type);
      const next = removing ? prev.filter((t) => t !== type) : [...prev, type];

      // Auto-expand the relevant upload panel when enabling a type that requires data
      if (!removing) {
        if (type === 'facial' && !uploadedPhotoPath) setPhotoOpen(true);
        if (type === 'voice' && !uploadedVoicePath) setVoiceOpen(true);
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    setLocalError(null);
    const trimmedAlias = displayAlias.trim();
    if (!trimmedAlias || trimmedAlias.length < 3 || trimmedAlias.length > 50) {
      setLocalError('Display name must be 3-50 characters.');
      return;
    }
    if (!ageRange) { setLocalError('Please select your age range.'); return; }
    if (!selfStatement.trim() || selfStatement.trim().length < 20) {
      setLocalError('Self-statement should be at least 20 characters.');
      return;
    }
    if (selectedAreas.length < 1) { setLocalError('Select at least 1 feedback area.'); return; }
    if (sharedTypes.length < MINIMUM_SHARE_COUNT) {
      setLocalError(`Share at least ${MINIMUM_SHARE_COUNT} data types.`);
      return;
    }

    // If user chose to share facial data, a photo must be uploaded
    if (sharedTypes.includes('facial') && !uploadedPhotoPath) {
      setLocalError('You selected Photo / Facial sharing but no photo is uploaded. Please upload a photo or deselect that data type.');
      return;
    }

    // If user chose to share voice data, a voice recording must be uploaded
    if (sharedTypes.includes('voice') && !uploadedVoicePath) {
      setLocalError('You selected Voice Signature sharing but no voice greeting is recorded. Please record a greeting or deselect that data type.');
      return;
    }

    const payload = {
      displayAlias: trimmedAlias,
      ageRange: ageRange as AgeRange,
      selfStatement: selfStatement.trim(),
      feedbackAreas: selectedAreas,
      sharedDataTypes: sharedTypes,
      ...(uploadedPhotoPath ? { photoPath: uploadedPhotoPath } : {}),
      ...(uploadedVoicePath ? { vocalSalutationPath: uploadedVoicePath } : {}),
    };

    const success = isEditing
      ? await updateProfile(payload)
      : await createProfile(payload);

    if (success && isEditing) {
      setView('overview');
    }
    if (!success && !error) setLocalError('Something went wrong. Please try again.');
  };

  const displayError = localError || error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold" style={{ color: COLORS.heading }}>
            {isEditing ? 'Edit Your Truth Card' : 'Create Your Truth Card'}
          </h2>
          {isEditing && (
            <button onClick={() => setView('overview')} className="text-sm px-3 py-1 rounded-lg"
              style={{ color: COLORS.label, background: 'rgba(255,255,255,0.08)' }}>Cancel</button>
          )}
        </div>
        <p className="text-sm" style={{ color: COLORS.body }}>
          {isEditing ? 'Update how others see and review you.' : 'Set up your profile for honest, anonymous feedback.'}
        </p>
      </div>

      {/* Reviewer Preview Toggle */}
      {isEditing && (
        <button onClick={() => setShowPreview((p) => !p)}
          className="w-full enhanced-glass-card flex items-center gap-3 text-left transition-all hover:scale-[1.01]" style={{ cursor: 'pointer' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))' }}>
            <span className="text-lg">👁</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: COLORS.heading }}>{showPreview ? 'Hide Reviewer Preview' : 'Preview as Reviewer'}</p>
            <p className="text-xs" style={{ color: COLORS.body }}>See your Truth Card the way reviewers see it</p>
          </div>
          <ChevronIcon open={showPreview} />
        </button>
      )}

      {showPreview && isEditing && (
        <ReviewerPreview displayAlias={displayAlias} ageRange={ageRange} selfStatement={selfStatement}
          feedbackAreas={selectedAreas} sharedTypes={sharedTypes} profile={profile} cardData={cardData} cardLoading={cardLoading}
          astroData={astroData} photoPreviewUrl={photoPreviewUrl} userId={user?.id || 0}
          voiceUrl={uploadedVoicePath ? (safeStorageUrl(uploadedVoicePath, user?.id || 0, 'tier2') || null) : null} />
      )}

      {/* Display Alias */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Anonymous Display Name <span style={{ color: '#f472b6' }}>*</span>
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>Choose a name reviewers will see (3-50 characters).</p>
        <input type="text" value={displayAlias} onChange={(e) => setDisplayAlias(e.target.value)} maxLength={50}
          placeholder="e.g. ThoughtfulOwl, Mirror_42..." className="w-full rounded-lg p-3 text-sm"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: COLORS.body, outline: 'none' }} />
        <div className="text-right text-xs mt-1" style={{ color: COLORS.label }}>{displayAlias.length}/50</div>
      </div>

      {/* ================================================================ */}
      {/* PROFILE PHOTO — Collapsible panel with full VisualStep mechanics */}
      {/* ================================================================ */}
      <div className="enhanced-glass-card">
        <button onClick={() => setPhotoOpen(p => !p)} className="w-full flex items-center gap-3 text-left">
          <div className="rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{
              width: 40, height: 40, minWidth: 40, minHeight: 40,
              background: (!photoOpen && (photoPreviewUrl || uploadedPhotoPath))
                ? 'none' : 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))',
              border: '2px solid rgba(244,114,182,0.3)',
            }}>
            {!photoOpen && photoPreviewUrl ? (
              <img src={photoPreviewUrl} alt="Preview" style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }} />
            ) : !photoOpen && uploadedPhotoPath ? (
              <img src={safeStorageUrl(uploadedPhotoPath, user?.id || 0, 'tier1') || ''} alt="Photo" style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }} />
            ) : (
              <span className="text-lg">📸</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: COLORS.heading }}>Profile Photo</p>
            <p className="text-xs" style={{ color: COLORS.body }}>
              {uploadedPhotoPath ? 'Photo uploaded — tap to change' : 'Capture or upload a photo for facial analysis'}
            </p>
          </div>
          <ChevronIcon open={photoOpen} />
        </button>
        <AnimatePresence>
          {photoOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }} className="overflow-hidden">
              <div className="pt-4 border-t mt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <PhotoCapturePanel
                  onPhotoUploaded={handlePhotoUploaded}
                  onPhotoRemoved={handlePhotoRemoved}
                  existingPhotoPath={uploadedPhotoPath}
                  userId={user?.id || 0}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================ */}
      {/* VOCAL GREETING — Collapsible panel with full VocalStep mechanics */}
      {/* ================================================================ */}
      <div className="enhanced-glass-card">
        <button onClick={() => setVoiceOpen(p => !p)} className="w-full flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))' }}>
            <span className="text-lg">🎙</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: COLORS.heading }}>Vocal Greeting</p>
            <p className="text-xs" style={{ color: COLORS.body }}>
              {uploadedVoicePath ? 'Voice greeting uploaded — tap to re-record' : 'Record a short voice greeting for reviewers'}
            </p>
          </div>
          <ChevronIcon open={voiceOpen} />
        </button>
        <AnimatePresence>
          {voiceOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }} className="overflow-hidden">
              <div className="pt-4 border-t mt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <VocalRecordingPanel
                  onVoiceUploaded={handleVoiceUploaded}
                  onVoiceRemoved={handleVoiceRemoved}
                  existingVoicePath={uploadedVoicePath}
                  userId={user?.id || 0}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================ */}
      {/* ASTROLOGICAL INFORMATION — Professional tabbed display          */}
      {/* ================================================================ */}
      <div className="enhanced-glass-card">
        <button onClick={() => setAstroOpen(p => !p)} className="w-full flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(250,204,21,0.15))' }}>
            <span className="text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: COLORS.heading }}>Astrological Profile</p>
            <p className="text-xs" style={{ color: COLORS.body }}>
              {astroData?.western?.sunSign
                ? `${astroData.western.sunSign} · ${astroData.chinese?.animalSign || '?'}`
                : 'View your astrological data'}
            </p>
          </div>
          <ChevronIcon open={astroOpen} />
        </button>
        <AnimatePresence>
          {astroOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }} className="overflow-hidden">
              <div className="pt-4 border-t mt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {astroLoading ? (
                  <div className="flex items-center gap-2 p-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-pink-400/20 border-t-pink-400" />
                    <span className="text-xs" style={{ color: COLORS.label }}>Loading astrological data...</span>
                  </div>
                ) : astroData ? (
                  <AstrologicalDisplay data={astroData} />
                ) : (
                  <div className="p-3 text-center">
                    <p className="text-xs" style={{ color: COLORS.label }}>
                      Astrological data will appear after intake is completed.
                    </p>
                    <button onClick={fetchAstroData} className="mt-2 px-3 py-1 rounded-lg text-[10px] font-medium"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: COLORS.heading }}>
                      Refresh Data
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Age Range */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>Age Range</label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>Helps reviewers provide age-appropriate feedback.</p>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((range) => {
            const selected = ageRange === range;
            return (
              <button key={range} onClick={() => setAgeRange(range as AgeRange)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selected ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))' : 'rgba(255,255,255,0.06)',
                  border: selected ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  color: selected ? COLORS.heading : COLORS.body,
                }}>{range}</button>
            );
          })}
        </div>
      </div>

      {/* Self Statement */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>Self-Statement</label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>How do you see yourself? Reviewers compare their perception against this.</p>
        <textarea value={selfStatement} onChange={(e) => setSelfStatement(e.target.value)} maxLength={500} rows={4}
          placeholder="I see myself as someone who..." className="w-full rounded-lg p-3 text-sm resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: COLORS.body, outline: 'none' }} />
        <div className="text-right text-xs mt-1" style={{ color: COLORS.label }}>{selfStatement.length}/500</div>
      </div>

      {/* Feedback Areas */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>Feedback Areas (select 1-5)</label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>What areas do you want feedback on?</p>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_AREAS.map((area) => {
            const selected = selectedAreas.includes(area);
            return (
              <button key={area} onClick={() => toggleArea(area)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: selected ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))' : 'rgba(255,255,255,0.06)',
                  border: selected ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  color: selected ? COLORS.heading : COLORS.body,
                }}>{area}</button>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: COLORS.label }}>{selectedAreas.length}/5 selected</div>
      </div>

      {/* Shared Data Types */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Share Your Assessment Data (minimum {MINIMUM_SHARE_COUNT})
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>Reviewers see anonymized snapshots of your data.</p>
        <div className="space-y-2">
          {SHAREABLE_OPTIONS.map((opt) => {
            const selected = sharedTypes.includes(opt.value);
            return (
              <button key={opt.value} onClick={() => toggleShareType(opt.value)}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left"
                style={{
                  background: selected ? 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))' : 'rgba(255,255,255,0.04)',
                  border: selected ? '1px solid rgba(244,114,182,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                <span className="text-lg">{opt.icon}</span>
                <span className="text-sm font-medium" style={{ color: COLORS.body }}>{opt.label}</span>
                {selected && opt.value === 'facial' && !uploadedPhotoPath && (
                  <span className="ml-auto text-[10px] font-medium" style={{ color: '#f87171' }}>Upload photo required</span>
                )}
                {selected && opt.value === 'voice' && !uploadedVoicePath && (
                  <span className="ml-auto text-[10px] font-medium" style={{ color: '#f87171' }}>Record voice required</span>
                )}
                {selected && !(opt.value === 'facial' && !uploadedPhotoPath) && !(opt.value === 'voice' && !uploadedVoicePath) && (
                  <span className="ml-auto text-xs" style={{ color: COLORS.heading }}>Shared</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: COLORS.label }}>{sharedTypes.length}/{SHAREABLE_OPTIONS.length} shared</div>
      </div>

      {/* Error */}
      {displayError && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          {displayError}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={isSubmitting}
        className="w-full py-3 rounded-xl transition-opacity font-medium"
        style={{
          opacity: isSubmitting ? 0.6 : 1,
          background: 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(167,139,250,0.25))',
          border: '1px solid rgba(244,114,182,0.4)',
          color: COLORS.heading,
        }}>
        {isSubmitting ? 'Saving...' : isEditing ? 'Update Truth Card' : 'Create Truth Card'}
      </button>
    </div>
  );
}


// ============================================================================
// REVIEWER PREVIEW — shows the Truth Card as a reviewer would see it
// ============================================================================
function ReviewerPreview({
  displayAlias, ageRange, selfStatement, feedbackAreas, sharedTypes, profile, cardData, cardLoading, astroData, photoPreviewUrl, voiceUrl, userId,
}: {
  displayAlias: string; ageRange: string; selfStatement: string;
  feedbackAreas: FeedbackArea[]; sharedTypes: TruthStreamShareableType[];
  profile: NonNullable<ReturnType<typeof useTruthStream>['profile']>;
  cardData: TruthCardData | null; cardLoading: boolean;
  astroData: any; photoPreviewUrl: string | null; voiceUrl: string | null; userId: number;
}) {
  const shareableMap = Object.fromEntries(SHAREABLE_OPTIONS.map((o) => [o.value, o]));

  // Gate photo by 'facial' in sharedTypes — reviewers only see photo if user opted in
  const facialShared = sharedTypes.includes('facial');
  const voiceShared = sharedTypes.includes('voice');

  const photoPath = cardData?.photoPath || profile?.photoPath;
  const resolvedPhotoUrl = facialShared
    ? (photoPreviewUrl || safeStorageUrl(photoPath, userId, 'tier1'))
    : null;
  const resolvedVoiceUrl = voiceShared ? voiceUrl : null;

  return (
    <div className="enhanced-glass-card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(244,114,182,0.2)', color: COLORS.heading }}>Reviewer View</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            width: 64, height: 64, minWidth: 64, minHeight: 64,
            background: resolvedPhotoUrl ? 'none' : 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(167,139,250,0.25))',
            border: '2px solid rgba(244,114,182,0.3)',
          }}>
          {resolvedPhotoUrl ? (
            <img src={resolvedPhotoUrl} alt="Profile"
              style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-2xl">🎭</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold" style={{ color: COLORS.heading }}>{displayAlias.trim() || 'Anonymous'}</p>
          {ageRange && <p className="text-xs" style={{ color: COLORS.body }}>Age: {ageRange}</p>}
          <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: COLORS.label }}>
            <span>{profile.totalReviewsReceived} reviews received</span>
            <span>·</span>
            <span>{profile.totalReviewsGiven} given</span>
            {profile.perceptionGapScore != null && (<><span>·</span><span>Gap: {Math.round(profile.perceptionGapScore)}</span></>)}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>How they see themselves</p>
        <p className="text-sm leading-relaxed" style={{ color: COLORS.body }}>"{selfStatement.trim() || '...'}"</p>
      </div>

      {feedbackAreas.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>Wants feedback on</p>
          <div className="flex flex-wrap gap-1.5">
            {feedbackAreas.map((area) => (
              <span key={area} className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.3)', color: COLORS.heading }}>{area}</span>
            ))}
          </div>
        </div>
      )}

      {sharedTypes.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>Shared Assessment Data</p>
          <div className="space-y-2">
            {sharedTypes.map((type) => {
              const opt = shareableMap[type];
              return (
                <div key={type} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{opt?.icon}</span>
                    <span className="text-xs font-medium" style={{ color: COLORS.heading }}>{opt?.label}</span>
                  </div>
                  <SharedDataPreview type={type} cardData={cardData} astroData={astroData} loading={cardLoading} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voice greeting in reviewer preview — gated by 'voice' in sharedTypes */}
      {resolvedVoiceUrl && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>Voice Greeting</p>
          <audio controls src={resolvedVoiceUrl} className="w-full" style={{ height: 32 }}
            onError={(e) => { (e.target as HTMLAudioElement).style.display = 'none'; }} />
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] pt-2" style={{ color: COLORS.label, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span>Profile completeness: {profile.profileCompleteness}%</span>
        <span>Quality score: {profile.reviewerQualityScore}</span>
      </div>
    </div>
  );
}

function SharedDataPreview({ type, cardData, astroData, loading }: { type: TruthStreamShareableType; cardData: TruthCardData | null; astroData: any; loading: boolean }) {
  if (loading) return <p className="text-[10px]" style={{ color: COLORS.label }}>Loading...</p>;
  const shared = cardData?.sharedData;
  if (!shared && type !== 'astrological') return <p className="text-[10px] italic" style={{ color: COLORS.label }}>Data not yet available</p>;

  switch (type) {
    case 'personality':
      if (!shared?.personality) return <SnapshotPlaceholder />;
      return (
        <div className="text-xs space-y-1" style={{ color: COLORS.body }}>
          <p><strong>{shared.personality.mbtiType}</strong> — {shared.personality.description}</p>
          {shared.personality.dominantTraits?.length > 0 && <p>Traits: {shared.personality.dominantTraits.join(', ')}</p>}
        </div>
      );
    case 'cognitive':
      if (!shared?.cognitive) return <SnapshotPlaceholder />;
      return (
        <div className="text-xs" style={{ color: COLORS.body }}>
          <p>Category: {shared.cognitive.category}</p>
          {shared.cognitive.strengths?.length > 0 && <p>Strengths: {shared.cognitive.strengths.join(', ')}</p>}
        </div>
      );
    case 'facial':
      if (!shared?.facial) return <SnapshotPlaceholder />;
      return <div className="text-xs" style={{ color: COLORS.body }}><p>Dominant expression: {shared.facial.dominantExpression}</p></div>;
    case 'voice':
      if (!shared?.voice) return <SnapshotPlaceholder />;
      return <div className="text-xs" style={{ color: COLORS.body }}><p>Voice sample: {shared.voice.duration}s recorded</p></div>;
    case 'astrological': {
      // Try card shared data first, fall back to dashboard astro data
      const cardAstro = shared?.astrological;
      const western = cardAstro?.westernSign || astroData?.western?.sunSign;
      const chinese = cardAstro?.chineseSign || astroData?.chinese?.animalSign;
      const synthesis = cardAstro?.synthesis || astroData?.synthesis?.lifeDirection;

      if (!western && !chinese) return <SnapshotPlaceholder />;
      return (
        <div className="text-xs space-y-0.5" style={{ color: COLORS.body }}>
          <p>
            {western && <>Sun Sign: {western}</>}
            {western && chinese && ' · '}
            {chinese && <>Chinese Zodiac: {chinese}</>}
          </p>
          {synthesis && <p className="mt-0.5">{synthesis}</p>}
        </div>
      );
    }
    default:
      return <SnapshotPlaceholder />;
  }
}

function SnapshotPlaceholder() {
  return <p className="text-[10px] italic" style={{ color: COLORS.label }}>Assessment not yet completed</p>;
}