// src/components/mirrorgroups/CreateGroupModal.tsx
// Modal for creating new MirrorGroups - Enterprise-grade with full validation

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGroups } from '../../context/GroupContext';
import type {
  GroupType,
  GroupPrivacy,
  PartnerSubtype,
  CreateGroupFormData,
} from '../../types/groups';
import {
  FAMILY_GOAL_PRESETS,
  PARTNERS_GOAL_PRESETS,
  TEAMWORK_GOAL_PRESETS,
} from '../../types/groups';

export interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

// ============================================================================
// GROUP TYPE DEFINITIONS WITH SMART DEFAULTS
// ============================================================================

interface GroupTypeConfig {
  value: GroupType;
  label: string;
  description: string;
  icon: string;
  defaultPrivacy: GroupPrivacy;
  typicalSize: string;
  maxMembersDefault: number;
  maxMembersMax: number;
  insightsFocus: string[];
}

const GROUP_TYPES: GroupTypeConfig[] = [
  {
    value: 'family',
    label: 'Family',
    description: 'Blood relatives or chosen family building understanding',
    icon: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
    defaultPrivacy: 'private',
    typicalSize: '3-8',
    maxMembersDefault: 8,
    maxMembersMax: 20,
    insightsFocus: [
      'Intergenerational communication',
      'Shared traits vs. individual differences',
      'Conflict resolution styles',
    ],
  },
  {
    value: 'partners',
    label: 'Partners',
    description: 'Romantic or platonic partnerships deepening connection',
    icon: '\u{1F49E}',
    defaultPrivacy: 'private',
    typicalSize: '2-4',
    maxMembersDefault: 4,
    maxMembersMax: 6,
    insightsFocus: [
      'Compatibility across all modalities',
      'Complementary strengths',
      'Friction points & mitigation',
    ],
  },
  {
    value: 'teamwork',
    label: 'Teamwork',
    description: 'Work teams, project groups, skill-building cohorts',
    icon: '\u{1F680}',
    defaultPrivacy: 'private',
    typicalSize: '4-20',
    maxMembersDefault: 12,
    maxMembersMax: 100,
    insightsFocus: [
      'Leadership distribution',
      'Collaboration patterns',
      'Skill complementarity & gaps',
    ],
  },
  {
    value: 'friends',
    label: 'Friends',
    description: 'Connect with your close friends',
    icon: '\u{1F91D}',
    defaultPrivacy: 'private',
    typicalSize: '3-10',
    maxMembersDefault: 10,
    maxMembersMax: 30,
    insightsFocus: [
      'Social dynamics',
      'Communication preferences',
      'Group harmony',
    ],
  },
  {
    value: 'therapy',
    label: 'Support Group',
    description: 'Therapeutic and support circles',
    icon: '\u{1F49A}',
    defaultPrivacy: 'private',
    typicalSize: '3-12',
    maxMembersDefault: 10,
    maxMembersMax: 20,
    insightsFocus: [
      'Emotional support patterns',
      'Progress tracking',
      'Safe space dynamics',
    ],
  },
  {
    value: 'anonymous',
    label: 'Anonymous',
    description: 'Share insights without identity',
    icon: '\u{1F3AD}',
    defaultPrivacy: 'secret',
    typicalSize: '5-25',
    maxMembersDefault: 20,
    maxMembersMax: 50,
    insightsFocus: [
      'Aggregated patterns',
      'Anonymous insights',
      'Collective wisdom',
    ],
  },
];

const PARTNER_SUBTYPES: Array<{ value: PartnerSubtype; label: string; description: string; icon: string }> = [
  {
    value: 'lover',
    label: 'Romantic',
    description: 'Dating, engaged, married, or romantic partnership',
    icon: '\u2764\uFE0F',
  },
  {
    value: 'platonic',
    label: 'Platonic',
    description: 'Best friends, creative partners, business co-founders',
    icon: '\u{1F91D}',
  },
];

const PRIVACY_OPTIONS: Array<{ value: GroupPrivacy; label: string; description: string; icon: string }> = [
  {
    value: 'private',
    label: 'Private',
    description: 'Invisible to search. Invite-only. Members-only insights.',
    icon: '\u{1F512}',
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Listed in directory. Users request to join. Admin approves.',
    icon: '\u{1F310}',
  },
  {
    value: 'secret',
    label: 'Secret',
    description: 'Hidden from all search. Invite-only. Maximum privacy.',
    icon: '\u{1F6E1}\uFE0F',
  },
];

// ============================================================================
// INLINE STYLE HELPERS (bypasses CSS cascade issues from enhanced-glass.css)
// ============================================================================

const COLORS = {
  heading: '#784552',
  body: '#7e4151',
  label: '#6a1f33',
  subtle: 'rgba(255,255,255,0.4)',
  error: '#f87171',
  errorBg: 'rgba(239,68,68,0.15)',
  errorBorder: 'rgba(239,68,68,0.3)',
};

function selectionCardStyle(isSelected: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '1rem',
    borderRadius: '0.75rem',
    border: isSelected
      ? '2px solid rgba(236, 72, 153, 0.6)'
      : '1px solid rgba(255,255,255,0.1)',
    background: isSelected
      ? 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))'
      : 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    outline: 'none',
  };
}

function smallSelectionStyle(isSelected: boolean): React.CSSProperties {
  return {
    ...selectionCardStyle(isSelected),
    padding: '0.75rem',
    borderRadius: '0.5rem',
  };
}

// ============================================================================
// STEP CONFIG
// ============================================================================

const TOTAL_STEPS = 4;
const STEP_LABELS = ['Type', 'Details', 'Goal', 'Settings'];

// ============================================================================
// COMPONENT
// ============================================================================

export default function CreateGroupModal({ onClose, onGroupCreated }: CreateGroupModalProps) {
  const { createGroup, error, clearError } = useGroups();

  // No default type — user must explicitly choose
  const [selectedType, setSelectedType] = useState<GroupType | null>(null);
  const [formData, setFormData] = useState<CreateGroupFormData>({
    name: '',
    description: '',
    type: 'family', // will be overwritten when user selects
    privacy: 'private',
    maxMembers: 8,
    settings: {
      allowAnonymousSharing: false,
      requireApproval: true,
      enableVoting: true,
      enableConversationInsights: true,
    },
  });

  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [customGoal, setCustomGoal] = useState('');
  const [useCustomGoal, setUseCustomGoal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitGuardRef = useRef(false);

  // Get current type config
  const currentTypeConfig = useMemo(
    () => GROUP_TYPES.find((t) => t.value === (selectedType ?? formData.type)) || GROUP_TYPES[0],
    [selectedType, formData.type]
  );

  // Get goal presets for current type
  const goalPresets = useMemo(() => {
    const t = selectedType ?? formData.type;
    switch (t) {
      case 'family': return [...FAMILY_GOAL_PRESETS];
      case 'partners': return [...PARTNERS_GOAL_PRESETS];
      case 'teamwork': return [...TEAMWORK_GOAL_PRESETS];
      default: return [...TEAMWORK_GOAL_PRESETS];
    }
  }, [selectedType, formData.type]);

  // ==================== KEYBOARD ====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== PER-STEP VALIDATION ====================

  const canProceedStep1 = selectedType !== null;

  const canProceedStep2 = useMemo(() => {
    if (!formData.name.trim() || formData.name.length < 3) return false;
    if (formData.type === 'partners' && !formData.subtype) return false;
    if (formData.privacy === 'public' && !formData.description.trim()) return false;
    if (formData.description && formData.description.length > 500) return false;
    return true;
  }, [formData.name, formData.description, formData.type, formData.subtype, formData.privacy]);

  // Step 3 (Goal) is always optional — can proceed
  // Step 4 is the final submit

  const canProceed = step === 1 ? canProceedStep1
    : step === 2 ? canProceedStep2
    : step === 3 ? true
    : !submitting;

  // ==================== VALIDATE STEP 2 (with error messages) ====================

  const validateStep2 = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Group name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }

    if (formData.type === 'partners' && !formData.subtype) {
      errors.subtype = 'Please select a partnership type';
    }

    if (formData.privacy === 'public' && !formData.description.trim()) {
      errors.description = 'Description is required for public groups';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.name, formData.description, formData.type, formData.subtype, formData.privacy]);

  // ==================== CLEAR ERRORS ON INPUT CHANGE ====================

  useEffect(() => {
    if (validationErrors.name && formData.name.trim().length >= 3) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next.name; return next; });
    }
  }, [formData.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (validationErrors.description) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next.description; return next; });
    }
  }, [formData.description]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (validationErrors.subtype && formData.subtype) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next.subtype; return next; });
    }
  }, [formData.subtype]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== NAVIGATION ====================

  const handleNext = useCallback(() => {
    if (!canProceed) return;

    if (step === 1 && selectedType) {
      const config = GROUP_TYPES.find((t) => t.value === selectedType) || GROUP_TYPES[0];
      setFormData((prev) => ({
        ...prev,
        type: selectedType,
        subtype: undefined,
        goal: undefined,
        goalCustom: undefined,
        privacy: config.defaultPrivacy,
        maxMembers: config.maxMembersDefault,
      }));
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3) {
      if (useCustomGoal && customGoal.trim()) {
        setFormData((prev) => ({ ...prev, goal: undefined, goalCustom: customGoal.trim() }));
      }
      setStep(4);
    }
  }, [step, canProceed, selectedType, validateStep2, useCustomGoal, customGoal]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep(step - 1);
      setValidationErrors({});
      setSubmitError(null);
    }
  }, [step]);

  // ==================== SUBMIT ====================

  const handleSubmit = useCallback(async () => {
    if (submitGuardRef.current || submitting) return;
    submitGuardRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    clearError();

    try {
      const finalData = { ...formData };
      if (useCustomGoal && customGoal.trim()) {
        finalData.goal = undefined;
        finalData.goalCustom = customGoal.trim();
      }

      const groupId = await createGroup(finalData);
      if (groupId) {
        onGroupCreated?.(groupId);
        onClose();
      } else {
        setSubmitError('Failed to create group. Please try again.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
      submitGuardRef.current = false;
    }
  }, [createGroup, formData, onGroupCreated, onClose, clearError, useCustomGoal, customGoal, submitting]);

  const handleClose = useCallback(() => {
    if (submitting) return; // Don't close while submitting
    clearError();
    setValidationErrors({});
    setSubmitError(null);
    setStep(1);
    setSelectedType(null);
    onClose();
  }, [clearError, onClose, submitting]);

  // ==================== TYPE SELECTION HANDLER ====================

  const handleTypeSelect = useCallback((typeValue: GroupType) => {
    setSelectedType(typeValue);
    setUseCustomGoal(false);
    setCustomGoal('');
  }, []);

  // ==================== RENDER ====================

  const displayError = submitError || error;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      {/* Modal Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '32rem',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          boxShadow: '0 16px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== HEADER ==================== */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.heading, margin: 0 }}>
              Create New Group
            </h2>
            <button
              onClick={handleClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)',
              }}
              aria-label="Close modal"
            >
              {'\u00D7'}
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {STEP_LABELS.map((label, i) => {
              const s = i + 1;
              const active = s <= step;
              return (
                <div key={label} style={{ flex: 1 }}>
                  <div style={{
                    height: 4, borderRadius: 4,
                    background: active
                      ? 'linear-gradient(to right, #f472b6, #a855f7)'
                      : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s ease',
                  }} />
                  <p style={{
                    fontSize: 10, marginTop: 4, textAlign: 'center',
                    color: active ? '#f9a8d4' : 'rgba(255,255,255,0.3)',
                    fontWeight: active ? 600 : 400,
                  }}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================== CONTENT ==================== */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

          {/* ============================================ */}
          {/* Step 1: Group Type (MUST explicitly select) */}
          {/* ============================================ */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 14, color: COLORS.label, marginBottom: 4 }}>
                What kind of group are you creating?
              </p>
              <p style={{ fontSize: 12, color: COLORS.subtle, marginBottom: 16 }}>
                Select a type to continue. This determines default settings and AI insights.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {GROUP_TYPES.map((type) => {
                  const isSelected = selectedType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => handleTypeSelect(type.value)}
                      style={selectionCardStyle(isSelected)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Selection indicator */}
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          border: isSelected
                            ? '2px solid #ec4899'
                            : '2px solid rgba(255,255,255,0.2)',
                          background: isSelected
                            ? 'radial-gradient(circle, #ec4899 40%, transparent 40%)'
                            : 'transparent',
                          transition: 'all 0.2s ease',
                        }} />
                        <span style={{ fontSize: 24, flexShrink: 0 }}>{type.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{
                              fontSize: 14, fontWeight: 600,
                              color: isSelected ? '#ec4899' : COLORS.heading,
                              margin: 0,
                            }}>
                              {type.label}
                            </p>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                              background: 'rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.5)',
                            }}>
                              {type.typicalSize} members
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: COLORS.body, margin: '2px 0 0 0' }}>
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Hint when nothing selected */}
              {!selectedType && (
                <p style={{
                  fontSize: 12, color: 'rgba(251,191,36,0.7)', marginTop: 16,
                  textAlign: 'center', fontStyle: 'italic',
                }}>
                  Please select a group type to continue
                </p>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* Step 2: Details */}
          {/* ============================================ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Partners subtype */}
              {formData.type === 'partners' && (
                <div>
                  <p style={{ fontSize: 14, color: COLORS.label, marginBottom: 8 }}>
                    Partnership Type <span style={{ color: COLORS.error }}>*</span>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {PARTNER_SUBTYPES.map((sub) => {
                      const isSelected = formData.subtype === sub.value;
                      return (
                        <button
                          key={sub.value}
                          onClick={() => setFormData((prev) => ({ ...prev, subtype: sub.value }))}
                          style={selectionCardStyle(isSelected)}
                        >
                          <span style={{ fontSize: 20 }}>{sub.icon}</span>
                          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.heading, margin: '4px 0 0' }}>
                            {sub.label}
                          </p>
                          <p style={{ fontSize: 10, color: COLORS.body, margin: '2px 0 0' }}>
                            {sub.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {validationErrors.subtype && (
                    <p style={{ color: COLORS.error, fontSize: 12, marginTop: 4 }}>
                      {validationErrors.subtype}
                    </p>
                  )}
                </div>
              )}

              {/* Group Name */}
              <div>
                <label style={{ display: 'block', fontSize: 14, color: COLORS.label, marginBottom: 8 }}>
                  Group Name <span style={{ color: COLORS.error }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', border: validationErrors.name
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.15)',
                    color: 'white', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder={
                    formData.type === 'family' ? 'e.g., The Johnson Family'
                    : formData.type === 'partners'
                      ? formData.subtype === 'lover' ? 'e.g., Alex & Jordan' : 'e.g., The Founders'
                    : formData.type === 'teamwork' ? 'e.g., Dev Team Alpha'
                    : 'Enter group name...'
                  }
                  maxLength={50}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {validationErrors.name ? (
                    <p style={{ color: COLORS.error, fontSize: 12, margin: 0 }}>{validationErrors.name}</p>
                  ) : <span />}
                  <p style={{ color: COLORS.subtle, fontSize: 12, margin: 0 }}>{formData.name.length}/50</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 14, color: COLORS.label, marginBottom: 8 }}>
                  Description {formData.privacy === 'public' && <span style={{ color: COLORS.error }}>*</span>}
                  {formData.privacy === 'public' && (
                    <span style={{ fontSize: 10, color: COLORS.subtle, marginLeft: 8 }}>(Shown in public directory)</span>
                  )}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', border: validationErrors.description
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.15)',
                    color: 'white', fontSize: 14, outline: 'none', resize: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                  placeholder={
                    formData.type === 'family' ? 'What does your family want to understand better?'
                    : formData.type === 'teamwork' ? "Describe your team and what you're working on..."
                    : 'What is this group about?'
                  }
                  rows={3}
                  maxLength={500}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {validationErrors.description ? (
                    <p style={{ color: COLORS.error, fontSize: 12, margin: 0 }}>{validationErrors.description}</p>
                  ) : <span />}
                  <p style={{ color: COLORS.subtle, fontSize: 12, margin: 0 }}>{formData.description.length}/500</p>
                </div>
              </div>

              {/* Insights Focus Preview */}
              <div style={{
                padding: 12, borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <p style={{ fontSize: 10, color: COLORS.subtle, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Insights Focus
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {currentTypeConfig.insightsFocus.map((focus) => (
                    <span key={focus} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(168,85,247,0.1)', color: '#c084fc',
                      border: '1px solid rgba(168,85,247,0.2)',
                    }}>
                      {focus}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* Step 3: Goal Selection */}
          {/* ============================================ */}
          {step === 3 && (
            <div>
              <p style={{ fontSize: 14, color: COLORS.label, marginBottom: 4 }}>
                What is this group's primary goal?
              </p>
              <p style={{ fontSize: 12, color: COLORS.subtle, marginBottom: 16 }}>
                Optional - helps Dina tailor insights. You can skip this step.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goalPresets.map((preset) => {
                  const isSelected = formData.goal === preset && !useCustomGoal;
                  return (
                    <button
                      key={preset}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, goal: preset, goalCustom: undefined }));
                        setUseCustomGoal(false);
                        setCustomGoal('');
                      }}
                      style={smallSelectionStyle(isSelected)}
                    >
                      <p style={{ fontSize: 13, color: COLORS.body, margin: 0 }}>{preset}</p>
                    </button>
                  );
                })}
              </div>

              {/* Custom Goal */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, marginTop: 16 }}>
                <button
                  onClick={() => {
                    setUseCustomGoal(!useCustomGoal);
                    if (!useCustomGoal) {
                      setFormData((prev) => ({ ...prev, goal: undefined }));
                    }
                  }}
                  style={smallSelectionStyle(useCustomGoal)}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.heading, margin: 0 }}>
                    Other - Write your own goal
                  </p>
                </button>

                {useCustomGoal && (
                  <textarea
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    style={{
                      width: '100%', marginTop: 12, padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white', fontSize: 14, outline: 'none', resize: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                    placeholder="Describe your group's goal..."
                    rows={2}
                    maxLength={300}
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* Step 4: Privacy, Members & Settings */}
          {/* ============================================ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Privacy */}
              <div>
                <p style={{ fontSize: 14, color: COLORS.label, marginBottom: 12 }}>Privacy Setting</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PRIVACY_OPTIONS.map((option) => {
                    const isSelected = formData.privacy === option.value;
                    const isRecommended = option.value === currentTypeConfig.defaultPrivacy;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFormData((prev) => ({ ...prev, privacy: option.value }))}
                        style={smallSelectionStyle(isSelected)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{option.icon}</span>
                          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.heading, margin: 0 }}>
                            {option.label}
                          </p>
                          {isRecommended && (
                            <span style={{
                              fontSize: 9, padding: '2px 8px', borderRadius: 9999,
                              background: 'rgba(34,197,94,0.15)', color: '#86efac',
                            }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: COLORS.body, margin: '4px 0 0 28px' }}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Members */}
              <div>
                <label style={{ display: 'block', fontSize: 14, color: COLORS.label, marginBottom: 8 }}>
                  Maximum Members: <strong>{formData.maxMembers}</strong>
                  <span style={{ fontSize: 12, color: COLORS.subtle, marginLeft: 8 }}>
                    (typical: {currentTypeConfig.typicalSize})
                  </span>
                </label>
                <input
                  type="range"
                  min="2"
                  max={currentTypeConfig.maxMembersMax}
                  value={formData.maxMembers}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                  className="w-full accent-pink-400"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLORS.subtle, marginTop: 4 }}>
                  <span>2</span>
                  <span>{currentTypeConfig.maxMembersMax}</span>
                </div>
              </div>

              {/* Feature Toggles */}
              <div>
                <p style={{ fontSize: 14, color: COLORS.label, marginBottom: 12 }}>Features</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'enableVoting', label: 'Enable group voting' },
                    { key: 'enableConversationInsights', label: 'Enable AI conversation insights' },
                    { key: 'requireApproval', label: 'Require approval for join requests' },
                    { key: 'allowAnonymousSharing', label: 'Allow anonymous data sharing' },
                  ].map((feature) => (
                    <label
                      key={feature.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                        borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                        cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(formData.settings?.[feature.key as keyof typeof formData.settings])}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, [feature.key]: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded accent-pink-400"
                      />
                      <span style={{ fontSize: 13, color: COLORS.body }}>{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={{
                padding: 12, borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <p style={{ fontSize: 10, color: COLORS.subtle, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Group Summary
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <p style={{ color: COLORS.body, margin: 0 }}>
                    <span style={{ color: COLORS.subtle }}>Type:</span>{' '}
                    {currentTypeConfig.icon} {currentTypeConfig.label}
                    {formData.subtype && ` (${formData.subtype})`}
                  </p>
                  <p style={{ color: COLORS.body, margin: 0 }}>
                    <span style={{ color: COLORS.subtle }}>Name:</span> {formData.name}
                  </p>
                  {(formData.goal || formData.goalCustom) && (
                    <p style={{ color: COLORS.body, margin: 0 }}>
                      <span style={{ color: COLORS.subtle }}>Goal:</span>{' '}
                      {formData.goal || formData.goalCustom}
                    </p>
                  )}
                  <p style={{ color: COLORS.body, margin: 0 }}>
                    <span style={{ color: COLORS.subtle }}>Privacy:</span>{' '}
                    {PRIVACY_OPTIONS.find((p) => p.value === formData.privacy)?.icon}{' '}
                    {formData.privacy}
                  </p>
                  <p style={{ color: COLORS.body, margin: 0 }}>
                    <span style={{ color: COLORS.subtle }}>Max Members:</span> {formData.maxMembers}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ERROR DISPLAY ==================== */}
          {displayError && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 8,
              background: COLORS.errorBg, border: `1px solid ${COLORS.errorBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{ color: COLORS.error, fontSize: 13, margin: 0 }}>{displayError}</p>
              <button
                onClick={() => { setSubmitError(null); clearError(); }}
                style={{
                  background: 'none', border: 'none', color: COLORS.error,
                  cursor: 'pointer', fontSize: 18, padding: '0 4px', flexShrink: 0,
                }}
              >
                {'\u00D7'}
              </button>
            </div>
          )}
        </div>

        {/* ==================== FOOTER ==================== */}
        <div style={{
          padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <button
            onClick={step === 1 ? handleClose : handleBack}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14,
            }}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
            disabled={!canProceed}
            style={{
              padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed',
              background: canProceed
                ? 'linear-gradient(135deg, #ec4899, #a855f7)'
                : 'rgba(255,255,255,0.08)',
              color: canProceed ? 'white' : 'rgba(255,255,255,0.3)',
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                  \u23F3
                </span>
                Creating...
              </span>
            ) : step === TOTAL_STEPS ? (
              'Create Group'
            ) : step === 3 ? (
              formData.goal || (useCustomGoal && customGoal.trim()) ? 'Next' : 'Skip'
            ) : (
              'Next'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
