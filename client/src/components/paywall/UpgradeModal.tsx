// ============================================================================
// UPGRADE MODAL COMPONENT
// ============================================================================
// File: components/paywall/UpgradeModal.tsx
// Full-screen modal with PayPal subscription button, feature comparison,
// and trial information. Triggered by FeatureGate or manual openUpgradeModal().
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import '../../styles/enhanced-glass.css';

// ============================================================================
// PAYPAL SDK LOADER
// ============================================================================

let paypalScriptPromise: Promise<void> | null = null;

function loadPayPalScript(clientId: string): Promise<void> {
  if (paypalScriptPromise) return paypalScriptPromise;

  paypalScriptPromise = new Promise((resolve, reject) => {
    if ((window as any).paypal) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
    script.setAttribute('data-sdk-integration-source', 'button-factory');
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      paypalScriptPromise = null;
      reject(new Error('Failed to load PayPal SDK'));
    };
    document.head.appendChild(script);
  });

  return paypalScriptPromise;
}

// ============================================================================
// PREMIUM FEATURES LIST
// ============================================================================

const PREMIUM_FEATURES = [
  { icon: '📝', label: 'Unlimited journal entries' },
  { icon: '📊', label: 'AI-powered journal analysis' },
  { icon: '🪞', label: 'Personal Mirror Report' },
  { icon: '👥', label: 'Create unlimited MirrorGroups' },
  { icon: '🧠', label: 'Group AI insights & compatibility' },
  { icon: '💬', label: 'Receive TruthStream reviews' },
  { icon: '🔮', label: 'Truth Mirror Report' },
  { icon: '✨', label: 'Unlimited @Dina AI queries' },
  { icon: '📥', label: 'Data export' },
];

// ============================================================================
// TYPES
// ============================================================================

type ModalState = 'idle' | 'loading_sdk' | 'ready' | 'processing' | 'success' | 'error';

const FEATURE_MESSAGES: Record<string, string> = {
  journal_entries_per_month: "You've reached your monthly journal limit. Upgrade for unlimited entries.",
  groups_joined: "You've reached your group join limit. Upgrade to join unlimited groups.",
  dina_queries_per_day: "You've used all your daily @Dina queries. Upgrade for unlimited AI conversations.",
  personal_analysis_per_week: "You've used your weekly personal analysis. Upgrade for unlimited reports.",
  personal_analysis: "Personal analysis reports help you understand yourself deeply. Upgrade to generate more.",
  truth_mirror_report: "Truth Mirror reports reveal how others perceive you. Upgrade to access TruthStream.",
  truthstream: "TruthStream — anonymous peer reviews and deep self-insight — is a Premium feature.",
  create_group: "Creating MirrorGroups is a Premium feature. Upgrade to build your own groups.",
  group_insights: "Group AI insights are a Premium feature. Upgrade to unlock compatibility analysis.",
  data_export: "Data export is a Premium feature. Upgrade to download your complete Mirror report.",
  join_one_group: "You've reached your group join limit this month. Upgrade for unlimited access.",
};

function getFeatureMessage(feature: string | null): string {
  if (!feature) return 'Get the full Mirror experience';
  return FEATURE_MESSAGES[feature] || 'Unlock this feature and everything Mirror has to offer';
}

// ============================================================================
// COMPONENT
// ============================================================================

const UpgradeModal: React.FC = () => {
  const {
    upgradeModalOpen,
    upgradeModalFeature,
    closeUpgradeModal,
    confirmActivation,
    plans,
    loadPlans,
    isTrialing,
    status,
  } = useSubscription();

  const { user, markEmailVerified } = useAuth();

  const [modalState, setModalState] = useState<ModalState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonRendered = useRef(false);

  const handleClose = useCallback(() => {
    if (modalState !== 'processing') {
      closeUpgradeModal();
    }
  }, [modalState, closeUpgradeModal]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (upgradeModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [upgradeModalOpen]);

  // Load plans when modal opens
  useEffect(() => {
    if (upgradeModalOpen && plans.length === 0) {
      loadPlans();
    }
  }, [upgradeModalOpen, plans.length, loadPlans]);

  const [emailVerified, setEmailVerified] = useState(user?.emailVerified ?? false);

  // Check live email verification status when modal opens (AuthContext may be stale)
  useEffect(() => {
    if (upgradeModalOpen && !emailVerified) {
      import('../../services/emailVerificationApi').then(({ getVerificationStatus }) => {
        getVerificationStatus().then(s => {
          if (s.verified) {
            setEmailVerified(true);
            // Also update AuthContext so it stays in sync
            if (user && !user.emailVerified) {
              try { markEmailVerified(); } catch {}
            }
          }
        }).catch(() => {});
      });
    }
  }, [upgradeModalOpen]);

  // Load PayPal SDK and render button
  useEffect(() => {
    if (!upgradeModalOpen || paypalButtonRendered.current) return;

    if (!emailVerified) return;

    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setErrorMessage('Payment configuration missing. Please contact support.');
      setModalState('error');
      return;
    }

    const premiumPlan = plans.find(p => p.id === 'premium');
    if (!premiumPlan) return;

    setModalState('loading_sdk');

    loadPayPalScript(clientId)
      .then(() => {
        if (!paypalContainerRef.current || paypalButtonRendered.current) return;

        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) {
          throw new Error('PayPal Buttons not available');
        }

        paypal.Buttons({
          style: {
            shape: 'pill',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe',
          },
          createSubscription: (_data: any, actions: any) => {
            setModalState('processing');
            const paypalPlanId = import.meta.env.VITE_PAYPAL_PLAN_ID;
            return actions.subscription.create({
              plan_id: paypalPlanId,
              custom_id: user ? `user_${user.id}` : undefined,
            });
          },
          onApprove: async (data: { subscriptionID: string }) => {
            try {
              setModalState('processing');
              await confirmActivation(data.subscriptionID);
              setModalState('success');
              setTimeout(() => {
                closeUpgradeModal();
                setModalState('idle');
                paypalButtonRendered.current = false;
              }, 2000);
            } catch (error: any) {
              setErrorMessage(error?.error || 'Failed to activate subscription');
              setModalState('error');
            }
          },
          onCancel: () => {
            setModalState('ready');
          },
          onError: (err: Error) => {
            console.error('PayPal error:', err);
            setErrorMessage('Payment processing error. Please try again.');
            setModalState('error');
          },
        }).render(paypalContainerRef.current);

        paypalButtonRendered.current = true;
        setModalState('ready');
      })
      .catch((error: Error) => {
        console.error('PayPal SDK load error:', error);
        setErrorMessage('Could not load payment system. Please try again later.');
        setModalState('error');
      });
  }, [upgradeModalOpen, plans, confirmActivation, closeUpgradeModal, emailVerified]);

  // Reset state when modal closes
  useEffect(() => {
    if (!upgradeModalOpen) {
      setModalState('idle');
      setErrorMessage('');
      paypalButtonRendered.current = false;
    }
  }, [upgradeModalOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && upgradeModalOpen && modalState !== 'processing') {
        closeUpgradeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [upgradeModalOpen, modalState, closeUpgradeModal]);

  if (!upgradeModalOpen) return null;

  const premiumPlan = plans.find(p => p.id === 'premium');

  return (
    <div
      className="fixed inset-0 flex items-start sm:items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 99999,
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="upgrade-modal-panel enhanced-glass-panel relative w-full max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-y-auto"
        style={{
          maxWidth: 'min(420px, 100vw)',
          margin: '0 auto',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5), 0 0 120px rgba(255, 105, 180, 0.1)',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        {/* Close button */}
        {modalState !== 'processing' && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white/90 hover:bg-white/10 transition-all"
            style={{ zIndex: 10 }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-3 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl mb-3"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.3), rgba(218, 112, 214, 0.3))',
              border: '1px solid rgba(255, 105, 180, 0.3)',
            }}
          >
            <span className="text-2xl sm:text-3xl">✦</span>
          </div>

          <h2 className="enhanced-glass-heading text-xl sm:text-2xl mb-1">
            Upgrade to Premium
          </h2>

          <p className="enhanced-glass-body text-xs sm:text-sm">
            {isTrialing()
              ? 'Subscribe now to keep Premium access after your trial ends'
              : status === 'cancelled'
                ? 'Welcome back — resubscribe to restore Premium access'
                : getFeatureMessage(upgradeModalFeature)}
          </p>

          {/* Price */}
          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span
              className="text-3xl sm:text-4xl font-bold"
              style={{
                fontFamily: "'Poppins', sans-serif",
                background: 'linear-gradient(135deg, #ff69b4, #ff1493, #da70d6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ${premiumPlan?.price || '9.99'}
            </span>
            <span className="enhanced-glass-subtle text-xs sm:text-sm">/month</span>
          </div>

          <p
            className="text-xs mt-1 font-medium"
            style={{
              fontFamily: "'Inter', sans-serif",
              color: 'rgba(255, 105, 180, 0.9)',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            Start with a 7-day free trial
          </p>
        </div>

        {/* Features list */}
        <div className="px-5 sm:px-8 py-3">
          <div className="enhanced-glass-card" style={{ padding: '12px 14px' }}>
            <p className="enhanced-glass-subtle text-xs uppercase tracking-wider mb-2 font-medium">
              Everything in Premium
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {PREMIUM_FEATURES.map((feat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-shrink-0">{feat.icon}</span>
                  <span className="enhanced-glass-body text-xs sm:text-sm leading-tight">{feat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PayPal Button / State Display */}
        <div className="px-5 sm:px-8 pb-5 sm:pb-8">
          {/* Email verification required */}
          {!emailVerified && modalState !== 'success' && (
            <div
              className="rounded-xl p-4 sm:p-6 text-center mb-4"
              style={{
                background: 'rgba(255, 165, 0, 0.1)',
                border: '1px solid rgba(255, 165, 0, 0.3)',
              }}
            >
              <div className="text-2xl mb-2">✉️</div>
              <h3 className="enhanced-glass-heading text-base sm:text-lg mb-1">Verify your email first</h3>
              <p className="enhanced-glass-body text-xs sm:text-sm mb-3">
                Email verification is required before subscribing or starting a trial.
              </p>
              <button
                onClick={() => closeUpgradeModal()}
                className="px-5 py-2 rounded-full text-xs sm:text-sm font-medium text-white"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Success state */}
          {modalState === 'success' && (
            <div className="text-center py-4 sm:py-6">
              <div className="text-4xl sm:text-5xl mb-2">🎉</div>
              <h3 className="enhanced-glass-heading text-lg sm:text-xl mb-1">Welcome to Premium!</h3>
              <p className="enhanced-glass-body text-xs sm:text-sm">Your subscription is now active.</p>
            </div>
          )}

          {/* Error state */}
          {modalState === 'error' && (
            <div className="mb-3">
              <div
                className="rounded-xl p-3 text-center"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                <p className="text-red-300 text-xs sm:text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>{errorMessage}</p>
                <button
                  onClick={() => {
                    setModalState('ready');
                    setErrorMessage('');
                  }}
                  className="text-red-400 text-xs mt-1 underline hover:text-red-300"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Loading SDK */}
          {modalState === 'loading_sdk' && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-400"></div>
              <span className="enhanced-glass-subtle ml-3 text-xs sm:text-sm">Loading payment options...</span>
            </div>
          )}

          {/* Processing */}
          {modalState === 'processing' && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-400"></div>
              <span className="enhanced-glass-subtle ml-3 text-xs sm:text-sm">Processing your subscription...</span>
            </div>
          )}

          {/* PayPal button container */}
          <div
            ref={paypalContainerRef}
            className={modalState === 'processing' || modalState === 'success' ? 'hidden' : ''}
          />

          {/* Terms */}
          {modalState !== 'success' && (
            <p
              className="text-center mt-3 leading-relaxed"
              style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.3)',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              By subscribing, you agree to our Terms of Service. Your 7-day free trial begins
              immediately. You won't be charged until the trial ends. Cancel anytime.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;