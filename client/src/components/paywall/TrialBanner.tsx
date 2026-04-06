// ============================================================================
// TRIAL BANNER COMPONENT
// ============================================================================
// File: components/paywall/TrialBanner.tsx
// Persistent top banner showing trial countdown with urgency coloring.
// Dismissible per session, reappears on next login.
// ============================================================================

import React, { useState, useCallback } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import '../../styles/enhanced-glass.css';

// ============================================================================
// COMPONENT
// ============================================================================

const TrialBanner: React.FC = () => {
  const { status, trialDaysLeft, openUpgradeModal } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem('mirror_trial_banner_dismissed', 'true');
  }, []);

  const handleUpgrade = useCallback(() => {
    openUpgradeModal('trial_banner');
  }, [openUpgradeModal]);

  // Only show for trialing users
  if (status !== 'trialing' || trialDaysLeft === null) return null;

  // Check session dismissal
  if (dismissed || sessionStorage.getItem('mirror_trial_banner_dismissed') === 'true') {
    // Re-show at 2 days left regardless of dismissal
    if (trialDaysLeft > 2) return null;
  }

  // Urgency coloring
  let bgGradient: string;
  let textColor: string;
  let ctaColor: string;
  let ctaShadow: string;
  let urgencyLabel: string;

  if (trialDaysLeft <= 1) {
    // Red — final day
    bgGradient = 'linear-gradient(135deg, rgba(220, 38, 38, 0.15), rgba(185, 28, 28, 0.15))';
    textColor = 'rgba(252, 165, 165, 0.95)';
    ctaColor = 'rgba(239, 68, 68, 0.9)';
    ctaShadow = '0 2px 12px rgba(239, 68, 68, 0.4)';
    urgencyLabel = trialDaysLeft === 0 ? 'Trial ends today!' : 'Trial ends tomorrow!';
  } else if (trialDaysLeft <= 3) {
    // Amber — getting close
    bgGradient = 'linear-gradient(135deg, rgba(217, 119, 6, 0.12), rgba(180, 83, 9, 0.12))';
    textColor = 'rgba(253, 230, 138, 0.95)';
    ctaColor = 'rgba(245, 158, 11, 0.9)';
    ctaShadow = '0 2px 12px rgba(245, 158, 11, 0.4)';
    urgencyLabel = `${trialDaysLeft} days left in your trial`;
  } else {
    // Sakura pink — comfortable
    bgGradient = 'linear-gradient(135deg, rgba(255, 105, 180, 0.1), rgba(218, 112, 214, 0.1))';
    textColor = 'rgba(255, 182, 193, 0.95)';
    ctaColor = 'linear-gradient(135deg, #ff69b4, #ff1493)';
    ctaShadow = '0 2px 12px rgba(255, 105, 180, 0.4)';
    urgencyLabel = `${trialDaysLeft} days left in your free trial`;
  }

  return (
    <div
      className="relative w-full px-4 py-2.5 flex items-center justify-center gap-3 text-sm z-50"
      style={{
        background: bgGradient,
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Trial countdown */}
      <span
        className="font-medium"
        style={{
          color: textColor,
          fontFamily: "'Inter', sans-serif",
          textShadow: '0 2px 6px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(255, 255, 255, 0.08)',
        }}
      >
        {urgencyLabel}
      </span>

      {/* CTA */}
      <button
        onClick={handleUpgrade}
        className="px-4 py-1 rounded-full text-xs font-semibold text-white transition-all duration-200 hover:scale-105"
        style={{
          fontFamily: "'Inter', sans-serif",
          background: ctaColor,
          boxShadow: ctaShadow,
        }}
      >
        Subscribe now
      </button>

      {/* Dismiss button (only if not critical) */}
      {trialDaysLeft > 2 && (
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default TrialBanner;
