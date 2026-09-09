// src/components/mirrorgroups/DataSharingPanel.tsx
// Data sharing consent and management

import { useState, useCallback, useEffect } from 'react';
import { useGroups } from '../../context/GroupContext';
import type { ShareableDataType, GroupMember } from '../../types/groups';
import { getSharedDataFreshness, type GroupShareFreshnessEntry } from '../../services/groupsApi';

interface DataSharingPanelProps {
  groupId: string;
}

const DATA_TYPES: Array<{
  type: ShareableDataType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    type: 'profile',
    label: 'Contact Information',
    description: 'Email, phone, birthdate, location - visible to group members',
    icon: '📇',
  },
  {
    type: 'personality',
    label: 'Personality Profile',
    description: 'Big Five traits, MBTI type, personality characteristics',
    icon: '🧠',
  },
  {
    type: 'cognitive',
    label: 'Cognitive Patterns',
    description: 'IQ assessment results, cognitive strengths and styles',
    icon: '💡',
  },
  {
    type: 'facial',
    label: 'Visual Analysis',
    description: 'Facial expression patterns, emotional presentation',
    icon: '📸',
  },
  {
    type: 'voice',
    label: 'Voice Patterns',
    description: 'Communication style, vocal characteristics',
    icon: '🎙️',
  },
  {
    type: 'astrological',
    label: 'Astrological Profile',
    description: 'Sun, moon, rising signs and interpretations',
    icon: '⭐',
  },
  {
    type: 'full_profile',
    label: 'Complete Profile',
    description: 'All available data from your Mirror assessment',
    icon: '🔮',
  },
];

export default function DataSharingPanel({ groupId }: DataSharingPanelProps) {
  const { shareData, currentMembers, error, clearError } = useGroups();
  const [selectedTypes, setSelectedTypes] = useState<Set<ShareableDataType>>(new Set());
  const [consentText, setConsentText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Freshness of THIS group's snapshot vs the user's current intake (retake flow).
  const [freshness, setFreshness] = useState<GroupShareFreshnessEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current user's shared data (would need to be passed or fetched)
  const currentUserMember = currentMembers.find((m: GroupMember) => m.userId === getCurrentUserId());
  const alreadySharedTypes = new Set<ShareableDataType>(
    (currentUserMember?.sharedDataTypes || []) as ShareableDataType[]
  );

  // Load this group's share freshness. Fail-safe: any error leaves freshness null
  // so the panel renders exactly as before (no banner, sharing still works).
  const refreshFreshness = useCallback(async () => {
    try {
      const result = await getSharedDataFreshness();
      setFreshness(result.groups.find((g) => g.groupId === groupId) ?? null);
    } catch {
      setFreshness(null);
    }
  }, [groupId]);

  useEffect(() => { void refreshFreshness(); }, [refreshFreshness]);

  const isOutdated = Boolean(freshness?.outdated) && alreadySharedTypes.size > 0;

  // "Update what this group sees": re-share EXACTLY the types already shared, with
  // a fresh consent. The server reads current intake (forceFresh) so the snapshot
  // is refreshed in place. Separate from the toggle flow, which ADDS new types.
  const handleUpdateShared = useCallback(async () => {
    const typesToRefresh = Array.from(alreadySharedTypes);
    if (typesToRefresh.length === 0) return;
    setIsUpdating(true);
    clearError();
    const success = await shareData(groupId, {
      dataTypes: typesToRefresh,
      consentText: 'I consent to update my previously shared Mirror data for this group with my latest results.',
    });
    setIsUpdating(false);
    if (success) {
      setShowSuccess(true);
      await refreshFreshness();
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [alreadySharedTypes, shareData, groupId, clearError, refreshFreshness]);

  const toggleDataType = useCallback((type: ShareableDataType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        // If selecting full_profile, clear others
        if (type === 'full_profile') {
          return new Set<ShareableDataType>(['full_profile']);
        }
        // If selecting specific type, remove full_profile
        next.delete('full_profile');
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (selectedTypes.size === 0) return;

    const consentMessage =
      consentText.trim() ||
      'I consent to share my selected Mirror data with this group for collective insights.';

    setIsSharing(true);
    clearError();

    const success = await shareData(groupId, {
      dataTypes: Array.from(selectedTypes),
      consentText: consentMessage,
    });

    setIsSharing(false);

    if (success) {
      setShowSuccess(true);
      setSelectedTypes(new Set());
      setConsentText('');
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [selectedTypes, consentText, shareData, groupId, clearError]);

  const hasNewSelections = Array.from(selectedTypes).some(
    (type) => !alreadySharedTypes.has(type)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <span className="text-4xl mb-4 block">🔐</span>
        <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: 'var(--mg-heading, #784552)' }}>
          Share Your Mirror Data
        </h3>
        <p className="enhanced-glass-body text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
          Choose what aspects of your Mirror profile to share with this group for collective
          insights and compatibility analysis.
        </p>
      </div>

      {/* Outdated snapshot → prompt to re-share (e.g. after a retake). Shows only
          when the user's data changed since they last shared with this group. */}
      {isOutdated && (
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(250,204,21,0.10)', borderColor: 'rgba(250,204,21,0.35)' }}>
          <div className="flex items-start gap-3">
            <span className="text-xl" aria-hidden>↻</span>
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1" style={{ color: '#b45309' }}>Your Mirror data has changed</h4>
              <p className="enhanced-glass-subtle text-xs mb-3" style={{ color: 'var(--mg-body, #7e4151)' }}>
                You've updated your assessments since you last shared with this group. This group still
                sees your previous results. Update what they see to share your latest{
                  freshness?.sharedAt ? ` (last shared ${new Date(freshness.sharedAt).toLocaleDateString()})` : ''
                }.
              </p>
              <button
                type="button"
                onClick={() => void handleUpdateShared()}
                disabled={isUpdating}
                className="enhanced-action-button px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Updating…' : `↻ Update what this group sees (${alreadySharedTypes.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Already Shared */}
      {alreadySharedTypes.size > 0 && (
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
          <h4 className="text-green-300 text-sm font-medium mb-2">Currently Sharing</h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(alreadySharedTypes).map((type: ShareableDataType) => {
              const dataType = DATA_TYPES.find((d) => d.type === type);
              return (
                <span
                  key={type}
                  className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm"
                >
                  {dataType?.icon} {dataType?.label || type}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Type Selection */}
      <div className="space-y-3">
        <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-label, #6a1f33)' }}>
          Select data to share:
        </p>

        {DATA_TYPES.map((dataType) => {
          const isSelected = selectedTypes.has(dataType.type);
          const isAlreadyShared = alreadySharedTypes.has(dataType.type);

          return (
            <button
              key={dataType.type}
              onClick={() => toggleDataType(dataType.type)}
              disabled={isAlreadyShared}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                isAlreadyShared
                  ? 'bg-white/5 border-green-500/30 opacity-60 cursor-not-allowed'
                  : isSelected
                    ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                  {dataType.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="enhanced-glass-heading text-sm" style={{ color: 'var(--mg-heading, #784552)' }}>
                      {dataType.label}
                    </span>
                    {isAlreadyShared && (
                      <span className="text-green-400 text-xs">✓ Shared</span>
                    )}
                  </div>
                  <p className="enhanced-glass-subtle text-xs mt-1" style={{ color: 'var(--mg-body, #7e4151)' }}>
                    {dataType.description}
                  </p>
                </div>
                {!isAlreadyShared && (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-pink-400 bg-pink-400'
                        : 'border-white/30'
                    }`}
                  >
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Consent Text */}
      {selectedTypes.size > 0 && (
        <div>
          <label className="block enhanced-glass-text text-sm mb-2" style={{ color: 'var(--mg-label, #6a1f33)' }}>
            Consent Statement (optional)
          </label>
          <textarea
            value={consentText}
            onChange={(e) => setConsentText(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50 resize-none"
            placeholder="I consent to share my selected Mirror data with this group..."
            rows={3}
            maxLength={500}
          />
          <p className="enhanced-glass-subtle text-xs mt-1 text-right" style={{ color: 'var(--mg-label, #6a1f33)' }}>
            {consentText.length}/500
          </p>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="bg-white/5 rounded-xl p-4">
        <h4 className="enhanced-glass-text text-sm mb-2" style={{ color: 'var(--mg-label, #6a1f33)' }}>
          Privacy Information
        </h4>
        <ul className="space-y-2 text-xs">
          <li className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="enhanced-glass-subtle" style={{ color: 'var(--mg-body, #7e4151)' }}>
              Your data is encrypted and only visible to group members
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="enhanced-glass-subtle" style={{ color: 'var(--mg-body, #7e4151)' }}>
              You can revoke sharing at any time
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="enhanced-glass-subtle" style={{ color: 'var(--mg-body, #7e4151)' }}>
              Data is used for group insights and compatibility analysis only
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span className="enhanced-glass-subtle" style={{ color: 'var(--mg-body, #7e4151)' }}>
              Leaving the group automatically removes your shared data
            </span>
          </li>
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {showSuccess && (
        <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
          <p className="text-green-300 text-sm">Data shared successfully!</p>
        </div>
      )}

      {/* Share Button */}
      <button
        onClick={handleShare}
        disabled={!hasNewSelections || isSharing}
        className="w-full enhanced-action-button py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="enhanced-glass-text font-medium" style={{ color: 'var(--mg-label, #6a1f33)' }}>
          {isSharing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Sharing...
            </span>
          ) : selectedTypes.size === 0 ? (
            'Select Data to Share'
          ) : (
            `Share ${selectedTypes.size} Data Type${selectedTypes.size > 1 ? 's' : ''}`
          )}
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// UTILITY
// ============================================================================

function getCurrentUserId(): number {
  // Get from localStorage or auth context
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    try {
      const parsed = JSON.parse(userInfo);
      return parsed.userId;
    } catch {
      return 0;
    }
  }
  return 0;
}