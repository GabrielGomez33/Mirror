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
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: '400px',
          maxHeight: '90dvh',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(253,242,244,0.95))',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        {/* Close button */}
        {modalState !== 'processing' && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ zIndex: 10, color: '#8a6070' }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="px-6 pt-6 pb-3 text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{
              background: 'linear-gradient(135deg, #ff69b4, #c6469b)',
            }}
          >
            <span className="text-2xl" style={{ filter: 'brightness(10)' }}>✦</span>
          </div>

          <h2 style={{ fontFamily: "'Poppins', sans-serif", color: '#3d1428', fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>
            Upgrade to Premium
          </h2>

          <p style={{ fontFamily: "'Inter', sans-serif", color: '#6b4050', fontSize: '0.85rem', lineHeight: 1.5 }}>
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
            <span style={{ fontFamily: "'Inter', sans-serif", color: '#8a6070', fontSize: '0.85rem' }}>/month</span>
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", color: '#c6469b', fontSize: '0.75rem', fontWeight: 500, marginTop: '2px' }}>
            Start with a 7-day free trial
          </p>
        </div>

        {/* Features list */}
        <div className="px-6 py-3">
          <div style={{ background: 'rgba(198, 70, 155, 0.04)', borderRadius: '16px', padding: '14px 16px', border: '1px solid rgba(198, 70, 155, 0.1)' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: '#8a6070', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 600 }}>
              Everything in Premium
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {PREMIUM_FEATURES.map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{feat.icon}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", color: '#2e1018', fontSize: '0.8rem' }}>{feat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PayPal Button / State Display */}
        <div className="px-6 pb-6">
          {/* Email verification required */}
          {!emailVerified && modalState !== 'success' && (
            <div style={{ borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '12px', background: 'linear-gradient(145deg, rgba(255,248,230,0.8), rgba(255,243,210,0.8))', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '1.3rem', filter: 'brightness(10)' }}>✉</span>
              </div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", color: '#92400e', fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Verify your email first</h3>
              <p style={{ fontFamily: "'Inter', sans-serif", color: '#a16207', fontSize: '0.8rem', marginBottom: '14px', lineHeight: 1.5 }}>
                Email verification is required before subscribing or starting a trial.
              </p>
              <button
                onClick={() => closeUpgradeModal()}
                style={{
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  border: 'none',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Success state */}
          {modalState === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", color: '#3d1428', fontSize: '1.2rem', fontWeight: 600 }}>Welcome to Premium!</h3>
              <p style={{ fontFamily: "'Inter', sans-serif", color: '#6b4050', fontSize: '0.85rem' }}>Your subscription is now active.</p>
            </div>
          )}

          {/* Error state */}
          {modalState === 'error' && (
            <div style={{ borderRadius: '12px', padding: '12px', textAlign: 'center', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", color: '#b91c1c', fontSize: '0.8rem' }}>{errorMessage}</p>
              <button
                onClick={() => { setModalState('ready'); setErrorMessage(''); }}
                style={{ fontFamily: "'Inter', sans-serif", color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading SDK */}
          {modalState === 'loading_sdk' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
              <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid #e8c4d0', borderTopColor: '#c6469b', borderRadius: '50%' }}></div>
              <span style={{ fontFamily: "'Inter', sans-serif", color: '#8a6070', fontSize: '0.8rem', marginLeft: '10px' }}>Loading payment options...</span>
            </div>
          )}

          {/* Processing */}
          {modalState === 'processing' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
              <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid #e8c4d0', borderTopColor: '#c6469b', borderRadius: '50%' }}></div>
              <span style={{ fontFamily: "'Inter', sans-serif", color: '#8a6070', fontSize: '0.8rem', marginLeft: '10px' }}>Processing your subscription...</span>
            </div>
          )}

          {/* PayPal button container */}
          <div
            ref={paypalContainerRef}
            className={modalState === 'processing' || modalState === 'success' ? 'hidden' : ''}
          />

          {/* Terms */}
          {modalState !== 'success' && (
            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.65rem', color: '#8a6070', fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
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