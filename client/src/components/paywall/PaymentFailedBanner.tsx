// ============================================================================
// PAYMENT FAILED BANNER COMPONENT
// ============================================================================
// File: components/paywall/PaymentFailedBanner.tsx
// Persistent warning banner shown when subscription is in past_due state.
// Non-dismissible — user must resolve payment to remove.
// ============================================================================

import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import '../../styles/enhanced-glass.css';

// ============================================================================
// COMPONENT
// ============================================================================

const PaymentFailedBanner: React.FC = () => {
  const { status, graceDaysLeft } = useSubscription();

  // Only show for past_due status
  if (status !== 'past_due' || graceDaysLeft === null) return null;

  const isUrgent = graceDaysLeft <= 2;

  return (
    <div
      className="relative w-full px-4 py-3 flex items-center justify-center gap-3 text-sm z-50"
      style={{
        background: isUrgent
          ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(185, 28, 28, 0.2))'
          : 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(180, 83, 9, 0.15))',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Warning icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        className="flex-shrink-0"
      >
        <path
          d="M9 1.5L1.5 16.5h15L9 1.5z"
          stroke={isUrgent ? '#fca5a5' : '#fcd34d'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 7v3.5M9 13h.007"
          stroke={isUrgent ? '#fca5a5' : '#fcd34d'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Message */}
      <span
        className="enhanced-glass-body font-medium"
        style={{
          color: isUrgent ? 'rgba(252, 165, 165, 0.95)' : 'rgba(253, 230, 138, 0.95)',
          textShadow: '0 2px 6px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(255, 255, 255, 0.08)',
        }}
      >
        Payment failed.
        {graceDaysLeft > 0
          ? ` Update your payment method within ${graceDaysLeft} day${graceDaysLeft !== 1 ? 's' : ''} to keep Premium access.`
          : ' Your Premium access will be removed today unless payment is resolved.'}
      </span>

      {/* PayPal link */}
      <a
        href="https://www.paypal.com/myaccount/autopay"
        target="_blank"
        rel="noopener noreferrer"
        className="enhanced-action-button px-4 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0"
        style={{
          background: isUrgent ? 'rgba(239, 68, 68, 0.9)' : 'linear-gradient(135deg, #ff69b4, #ff1493)',
          boxShadow: isUrgent
            ? '0 2px 12px rgba(239, 68, 68, 0.3)'
            : '0 2px 12px rgba(255, 105, 180, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        Update payment
      </a>
    </div>
  );
};

export default PaymentFailedBanner;
