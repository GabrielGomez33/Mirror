// src/components/mirrorgroups/CreateGroupModal.tsx
// Modal for creating new MirrorGroups

import { useState, useCallback } from 'react';
import { useGroups } from '../../context/GroupContext';
import type { GroupType, GroupPrivacy, CreateGroupFormData } from '../../types/groups';

export interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

const GROUP_TYPES: Array<{ value: GroupType; label: string; description: string; icon: string }> = [
  {
    value: 'family',
    label: 'Family',
    description: 'For family members to share insights',
    icon: '👨‍👩‍👧‍👦',
  },
  {
    value: 'friends',
    label: 'Friends',
    description: 'Connect with your close friends',
    icon: '🤝',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Work teams and colleagues',
    icon: '💼',
  },
  {
    value: 'therapy',
    label: 'Support Group',
    description: 'Therapeutic and support circles',
    icon: '💚',
  },
  {
    value: 'anonymous',
    label: 'Anonymous',
    description: 'Share insights anonymously',
    icon: '🎭',
  },
];

const PRIVACY_OPTIONS: Array<{ value: GroupPrivacy; label: string; description: string }> = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only invited members can join',
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can request to join',
  },
  {
    value: 'secret',
    label: 'Secret',
    description: 'Hidden from search, invite only',
  },
];

export default function CreateGroupModal({ onClose, onGroupCreated }: CreateGroupModalProps) {
  const { createGroup, isLoading, error, clearError } = useGroups();

  const [formData, setFormData] = useState<CreateGroupFormData>({
    name: '',
    description: '',
    type: 'friends',
    privacy: 'private',
    maxMembers: 10,
    settings: {
      allowAnonymousSharing: false,
      requireApproval: true,
      enableVoting: true,
      enableConversationInsights: true,
    },
  });

  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateStep1 = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Group name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.name, formData.description]);

  const handleNext = useCallback(() => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }, [step, validateStep1]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep(step - 1);
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    clearError();

    const groupId = await createGroup(formData);
    if (groupId) {
      onGroupCreated?.(groupId);
      onClose();
      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'friends',
        privacy: 'private',
        maxMembers: 10,
        settings: {
          allowAnonymousSharing: false,
          requireApproval: true,
          enableVoting: true,
          enableConversationInsights: true,
        },
      });
      setStep(1);
    }
  }, [createGroup, formData, onGroupCreated, onClose, clearError]);

  const handleClose = useCallback(() => {
    clearError();
    setValidationErrors({});
    setStep(1);
    onClose();
  }, [clearError, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg enhanced-glass-panel p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2
              className="enhanced-glass-heading text-xl"
              style={{ color: '#784552' }}
            >
              Create New Group
            </h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Close modal"
            >
              <span className="text-white/80">×</span>
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  s <= step ? 'bg-gradient-to-r from-pink-400 to-purple-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label
                  className="block enhanced-glass-text text-sm mb-2"
                  style={{ color: '#6a1f33' }}
                >
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50 transition-colors"
                  placeholder="e.g., Sunday Dinner Club"
                  maxLength={50}
                />
                {validationErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  className="block enhanced-glass-text text-sm mb-2"
                  style={{ color: '#6a1f33' }}
                >
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50 transition-colors resize-none"
                  placeholder="What is this group about?"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-white/40 text-xs mt-1 text-right">
                  {formData.description.length}/500
                </p>
                {validationErrors.description && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Group Type */}
          {step === 2 && (
            <div className="space-y-3">
              <p
                className="enhanced-glass-text text-sm mb-4"
                style={{ color: '#6a1f33' }}
              >
                Choose a group type
              </p>

              {GROUP_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    formData.type === type.value
                      ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <p
                        className="enhanced-glass-heading text-sm"
                        style={{ color: '#784552' }}
                      >
                        {type.label}
                      </p>
                      <p
                        className="enhanced-glass-subtle text-xs"
                        style={{ color: '#7e4151' }}
                      >
                        {type.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Privacy & Settings */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Privacy */}
              <div>
                <p
                  className="enhanced-glass-text text-sm mb-3"
                  style={{ color: '#6a1f33' }}
                >
                  Privacy Setting
                </p>
                <div className="space-y-2">
                  {PRIVACY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, privacy: option.value })}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        formData.privacy === option.value
                          ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <p
                        className="enhanced-glass-text text-sm"
                        style={{ color: '#784552' }}
                      >
                        {option.label}
                      </p>
                      <p className="enhanced-glass-subtle text-xs" style={{ color: '#7e4151' }}>
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Members */}
              <div>
                <label
                  className="block enhanced-glass-text text-sm mb-2"
                  style={{ color: '#6a1f33' }}
                >
                  Maximum Members: {formData.maxMembers}
                </label>
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={formData.maxMembers}
                  onChange={(e) =>
                    setFormData({ ...formData, maxMembers: parseInt(e.target.value) })
                  }
                  className="w-full accent-pink-400"
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>2</span>
                  <span>100</span>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-3">
                <p
                  className="enhanced-glass-text text-sm"
                  style={{ color: '#6a1f33' }}
                >
                  Features
                </p>

                {[
                  { key: 'enableVoting', label: 'Enable group voting' },
                  { key: 'enableConversationInsights', label: 'Enable AI conversation insights' },
                  { key: 'requireApproval', label: 'Require approval for join requests' },
                  { key: 'allowAnonymousSharing', label: 'Allow anonymous data sharing' },
                ].map((feature) => (
                  <label
                    key={feature.key}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Boolean(formData.settings?.[feature.key as keyof typeof formData.settings])
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            [feature.key]: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded accent-pink-400"
                    />
                    <span
                      className="enhanced-glass-body text-sm"
                      style={{ color: '#7e4151' }}
                    >
                      {feature.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-between">
          <button
            onClick={step === 1 ? handleClose : handleBack}
            className="px-6 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={isLoading}
            className="enhanced-action-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className="enhanced-glass-text font-medium"
              style={{ color: '#6a1f33' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Creating...
                </span>
              ) : step === 3 ? (
                'Create Group'
              ) : (
                'Next'
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
