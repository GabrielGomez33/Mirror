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
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100vw - 2rem)',
        maxWidth: '440px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        className="glass-card-enhanced"
        style={{
          borderRadius: 20,
          padding: '16px',
          color: '#1a1024',
          maxHeight: '80dvh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        {/* Top row: icon + text + close */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: 12,
              background: 'linear-gradient(135deg, #ff69b4, #c6469b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(198, 70, 155, 0.3)',
            }}
          >
            <span style={{ fontSize: '1.3rem', filter: 'brightness(10)' }}>✦</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, margin: 0, color: '#1a1024' }}>
              Upgrade to Premium — ${premiumPlan?.price || '9.99'}/mo
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.4, margin: '2px 0 0 0', color: 'rgba(26, 16, 36, 0.65)' }}>
              {isTrialing()
                ? 'Subscribe now to keep Premium access after your trial ends.'
                : status === 'cancelled'
                  ? 'Welcome back — resubscribe to restore Premium access.'
                  : getFeatureMessage(upgradeModalFeature)}
            </p>
          </div>
          {modalState !== 'processing' && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Dismiss"
              style={{
                flexShrink: 0, background: 'transparent', border: 'none',
                color: 'rgba(26, 16, 36, 0.4)', fontSize: 22, lineHeight: 1,
                cursor: 'pointer', padding: '0 2px', marginTop: -2,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Features list */}
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '4px 10px', padding: '0 2px' }}>
          {PREMIUM_FEATURES.map((feat, i) => (
            <span key={i} style={{ fontSize: 11, color: 'rgba(26, 16, 36, 0.55)', whiteSpace: 'nowrap' }}>
              {feat.icon} {feat.label}
            </span>
          ))}
        </div>

        {/* Email verification gate */}
        {!emailVerified && modalState !== 'success' && (
          <div style={{ marginTop: 12, borderRadius: 14, padding: '12px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
            <p style={{ fontSize: 12, color: '#92400e', margin: 0, fontWeight: 500 }}>
              ✉️ Verify your email before subscribing or starting a trial.
            </p>
            <button
              onClick={() => closeUpgradeModal()}
              style={{
                marginTop: 8, borderRadius: 999, padding: '7px 16px', fontSize: 12, fontWeight: 600,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
                border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Success */}
        {modalState === 'success' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <span style={{ fontSize: '2rem' }}>🎉</span>
            <p style={{ fontWeight: 600, fontSize: 14, color: '#1a1024', margin: '4px 0 0 0' }}>Welcome to Premium!</p>
          </div>
        )}

        {/* Error */}
        {modalState === 'error' && (
          <div style={{ marginTop: 10, borderRadius: 12, padding: 10, background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.12)', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>{errorMessage}</p>
            <button onClick={() => { setModalState('ready'); setErrorMessage(''); }}
              style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', marginTop: 4 }}>
              Try again
            </button>
          </div>
        )}

        {/* Loading / Processing */}
        {(modalState === 'loading_sdk' || modalState === 'processing') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 8 }}>
            <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(244, 114, 182, 0.3)', borderTopColor: '#f472b6', borderRadius: '50%' }} />
            <span style={{ fontSize: 12, color: 'rgba(26, 16, 36, 0.5)' }}>
              {modalState === 'loading_sdk' ? 'Loading payment options...' : 'Processing...'}
            </span>
          </div>
        )}

        {/* PayPal button container */}
        <div
          ref={paypalContainerRef}
          style={{ marginTop: emailVerified && modalState !== 'success' ? 12 : 0 }}
          className={modalState === 'processing' || modalState === 'success' || !emailVerified ? 'hidden' : ''}
        />

        {/* Terms */}
        {modalState !== 'success' && emailVerified && (
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'rgba(26, 16, 36, 0.35)', lineHeight: 1.5 }}>
            7-day free trial. Cancel anytime. You won't be charged until the trial ends.
          </p>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;