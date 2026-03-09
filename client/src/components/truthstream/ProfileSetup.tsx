// src/components/truthstream/ProfileSetup.tsx
// Create or edit a TruthStream Truth Card profile

import { useState, useEffect } from 'react';
import { useTruthStream } from '../../context/TruthStreamContext';
import {
  FEEDBACK_AREAS,
  MINIMUM_SHARE_COUNT,
  type FeedbackArea,
  type TruthStreamShareableType,
} from '../../types/truthstream';

const SHAREABLE_OPTIONS: { value: TruthStreamShareableType; label: string; icon: string }[] = [
  { value: 'personality', label: 'Personality Profile', icon: '🧠' },
  { value: 'cognitive', label: 'Cognitive Style', icon: '💡' },
  { value: 'facial', label: 'Photo / Facial', icon: '📸' },
  { value: 'voice', label: 'Voice Signature', icon: '🎙' },
  { value: 'astrological', label: 'Astrological', icon: '✨' },
];

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;

const COLORS = {
  heading: '#784552',
  body: '#7e4151',
  label: '#6a1f33',
};

export default function ProfileSetup() {
  const { profile, isSubmitting, error, createProfile, updateProfile, setView } = useTruthStream();
  const isEditing = !!profile;

  const [displayAlias, setDisplayAlias] = useState(profile?.displayAlias || '');
  const [ageRange, setAgeRange] = useState(profile?.ageRange || '');
  const [selfStatement, setSelfStatement] = useState(profile?.selfStatement || '');
  const [selectedAreas, setSelectedAreas] = useState<FeedbackArea[]>(profile?.feedbackAreas || []);
  const [sharedTypes, setSharedTypes] = useState<TruthStreamShareableType[]>(profile?.sharedDataTypes || []);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayAlias(profile.displayAlias || '');
      setAgeRange(profile.ageRange || '');
      setSelfStatement(profile.selfStatement || '');
      setSelectedAreas(profile.feedbackAreas || []);
      setSharedTypes(profile.sharedDataTypes || []);
    }
  }, [profile]);

  const toggleArea = (area: FeedbackArea) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : prev.length < 5 ? [...prev, area] : prev
    );
  };

  const toggleShareType = (type: TruthStreamShareableType) => {
    setSharedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    setLocalError(null);

    // Validate display alias if provided (optional — server auto-generates if blank)
    const trimmedAlias = displayAlias.trim();
    if (trimmedAlias && (trimmedAlias.length < 3 || trimmedAlias.length > 50)) {
      setLocalError('Display name must be 3-50 characters, or leave blank for an auto-generated name.');
      return;
    }

    if (!ageRange) {
      setLocalError('Please select your age range.');
      return;
    }

    if (!selfStatement.trim()) {
      setLocalError('Please write a self-statement.');
      return;
    }
    if (selfStatement.trim().length < 20) {
      setLocalError('Self-statement should be at least 20 characters.');
      return;
    }
    if (selectedAreas.length < 1) {
      setLocalError('Select at least 1 feedback area.');
      return;
    }
    if (sharedTypes.length < MINIMUM_SHARE_COUNT) {
      setLocalError(`Share at least ${MINIMUM_SHARE_COUNT} data types to receive meaningful reviews.`);
      return;
    }

    const data: {
      displayAlias?: string;
      ageRange: string;
      selfStatement: string;
      feedbackAreas: typeof selectedAreas;
      sharedDataTypes: typeof sharedTypes;
    } = {
      ageRange,
      selfStatement: selfStatement.trim(),
      feedbackAreas: selectedAreas,
      sharedDataTypes: sharedTypes,
    };

    if (trimmedAlias) {
      data.displayAlias = trimmedAlias;
    }

    const success = isEditing ? await updateProfile(data) : await createProfile(data);
    if (!success && !error) {
      setLocalError('Something went wrong. Please try again.');
    }
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
            <button
              onClick={() => setView('overview')}
              className="text-sm px-3 py-1 rounded-lg"
              style={{ color: COLORS.label, background: 'rgba(255,255,255,0.08)' }}
            >
              Cancel
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: COLORS.body }}>
          {isEditing
            ? 'Update how others see and review you.'
            : 'Set up your profile so others can give you honest, anonymous feedback.'}
        </p>
      </div>

      {/* Display Alias (anonymous name) */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Anonymous Display Name
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>
          Choose a name reviewers will see instead of your real identity. Leave blank for an auto-generated name.
        </p>
        <input
          type="text"
          value={displayAlias}
          onChange={(e) => setDisplayAlias(e.target.value)}
          maxLength={50}
          placeholder="e.g. ThoughtfulOwl, Mirror_42..."
          className="w-full rounded-lg p-3 text-sm"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: COLORS.body,
            outline: 'none',
          }}
        />
        <div className="text-right text-xs mt-1" style={{ color: COLORS.label }}>
          {displayAlias.length}/50
        </div>
      </div>

      {/* Age Range */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Age Range
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>
          Helps reviewers provide age-appropriate feedback.
        </p>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((range) => {
            const selected = ageRange === range;
            return (
              <button
                key={range}
                onClick={() => setAgeRange(range)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))'
                    : 'rgba(255,255,255,0.06)',
                  border: selected
                    ? '1px solid rgba(244,114,182,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                  color: selected ? COLORS.heading : COLORS.body,
                }}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Self Statement */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Self-Statement
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>
          How do you see yourself? Reviewers will compare their perception against this.
        </p>
        <textarea
          value={selfStatement}
          onChange={(e) => setSelfStatement(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="I see myself as someone who..."
          className="w-full rounded-lg p-3 text-sm resize-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: COLORS.body,
            outline: 'none',
          }}
        />
        <div className="text-right text-xs mt-1" style={{ color: COLORS.label }}>
          {selfStatement.length}/500
        </div>
      </div>

      {/* Feedback Areas */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Feedback Areas (select 1-5)
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>
          What areas do you want feedback on?
        </p>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_AREAS.map((area) => {
            const selected = selectedAreas.includes(area);
            return (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, rgba(244,114,182,0.3), rgba(167,139,250,0.3))'
                    : 'rgba(255,255,255,0.06)',
                  border: selected
                    ? '1px solid rgba(244,114,182,0.5)'
                    : '1px solid rgba(255,255,255,0.12)',
                  color: selected ? COLORS.heading : COLORS.body,
                }}
              >
                {area}
              </button>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: COLORS.label }}>
          {selectedAreas.length}/5 selected
        </div>
      </div>

      {/* Shared Data Types */}
      <div className="enhanced-glass-card">
        <label className="block text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
          Share Your Assessment Data (minimum {MINIMUM_SHARE_COUNT})
        </label>
        <p className="text-xs mb-3" style={{ color: COLORS.body }}>
          Reviewers see anonymized snapshots of your data to give more informed feedback.
        </p>
        <div className="space-y-2">
          {SHAREABLE_OPTIONS.map((opt) => {
            const selected = sharedTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleShareType(opt.value)}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))'
                    : 'rgba(255,255,255,0.04)',
                  border: selected
                    ? '1px solid rgba(244,114,182,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-lg">{opt.icon}</span>
                <span className="text-sm font-medium" style={{ color: COLORS.body }}>
                  {opt.label}
                </span>
                {selected && (
                  <span className="ml-auto text-xs" style={{ color: COLORS.heading }}>
                    Shared
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: COLORS.label }}>
          {sharedTypes.length}/{SHAREABLE_OPTIONS.length} shared
        </div>
      </div>

      {/* Error */}
      {displayError && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
        >
          {displayError}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full enhanced-action-button py-3 transition-opacity"
        style={{ opacity: isSubmitting ? 0.6 : 1 }}
      >
        <span className="font-medium" style={{ color: COLORS.label }}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Truth Card' : 'Create Truth Card'}
        </span>
      </button>
    </div>
  );
}
