// ============================================================================
// SUBSCRIPTION CONTEXT
// ============================================================================
// File: context/SubscriptionContext.tsx
// Global subscription state management. Provides tier, status, features,
// usage, and methods for upgrade/cancel flows.
// ============================================================================

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { onPaywallEvent } from '../services/paywallInterceptor';
import {
  getSubscriptionStatus,
  getPlans,
  createSubscription,
  activateSubscription,
  cancelSubscription,
  startTrial,
  getUsage,
} from '../services/subscriptionApi';
import type { SubscriptionStatus, Plan } from '../services/subscriptionApi';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionState {
  // Core subscription data
  tier: 'free' | 'premium' | 'enterprise';
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  features: string[];
  usage: SubscriptionStatus['usage'];

  // Time-sensitive
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
  accessUntil: string | null;
  currentPeriodEnd: string | null;

  // Plans
  plans: Plan[];

  // UI state
  isLoading: boolean;
  error: string | null;
  upgradeModalOpen: boolean;
  upgradeModalFeature: string | null;

  // Metadata
  lastFetched: number | null;
}

type SubscriptionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SUBSCRIPTION'; payload: SubscriptionStatus }
  | { type: 'SET_PLANS'; payload: Plan[] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'OPEN_UPGRADE_MODAL'; payload: string | null }
  | { type: 'CLOSE_UPGRADE_MODAL' }
  | { type: 'RESET' };

interface SubscriptionContextValue extends SubscriptionState {
  // Queries
  canAccess: (feature: string) => boolean;
  isPremium: () => boolean;
  isTrialing: () => boolean;
  hasGracePeriod: () => boolean;
  getFeatureUsage: (feature: string) => { used: number; limit: number; remaining: number } | null;

  // Actions
  refreshSubscription: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  loadPlans: () => Promise<void>;
  initiateUpgrade: (planId: string) => Promise<string>;
  confirmActivation: (subscriptionId: string) => Promise<void>;
  requestCancel: (reason?: string) => Promise<void>;
  requestTrial: () => Promise<void>;

  // UI
  openUpgradeModal: (feature?: string) => void;
  closeUpgradeModal: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SubscriptionState = {
  tier: 'free',
  status: 'free',
  features: [],
  usage: {},
  trialDaysLeft: null,
  graceDaysLeft: null,
  accessUntil: null,
  currentPeriodEnd: null,
  plans: [],
  isLoading: false,
  error: null,
  upgradeModalOpen: false,
  upgradeModalFeature: null,
  lastFetched: null,
};

// ============================================================================
// REDUCER
// ============================================================================

function subscriptionReducer(state: SubscriptionState, action: SubscriptionAction): SubscriptionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SUBSCRIPTION':
      return {
        ...state,
        tier: action.payload.tier,
        status: action.payload.status,
        features: action.payload.features,
        usage: action.payload.usage,
        trialDaysLeft: action.payload.trialDaysLeft,
        graceDaysLeft: action.payload.graceDaysLeft,
        accessUntil: action.payload.accessUntil,
        currentPeriodEnd: action.payload.currentPeriodEnd,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      };

    case 'SET_PLANS':
      return { ...state, plans: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'OPEN_UPGRADE_MODAL':
      return { ...state, upgradeModalOpen: true, upgradeModalFeature: action.payload };

    case 'CLOSE_UPGRADE_MODAL':
      return { ...state, upgradeModalOpen: false, upgradeModalFeature: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const fetchInProgress = useRef(false);

  // ========================================================================
  // DATA FETCHING
  // ========================================================================

  const refreshSubscription = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const sub = await getSubscriptionStatus();
      dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    } catch (error: any) {
      // Don't show error for 401 (not logged in)
      if (error?.status !== 401) {
        dispatch({ type: 'SET_ERROR', payload: error?.error || 'Failed to load subscription' });
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  // Auto-refresh subscription status on mount
  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const refreshUsage = useCallback(async () => {
    try {
      const usageData = await getUsage();
      if (usageData.usage) {
        // Usage is already part of subscription status, but this allows targeted refresh
        await refreshSubscription();
      }
    } catch {
      // Non-critical — usage display is supplementary
    }
  }, [refreshSubscription]);

  const loadPlans = useCallback(async () => {
    try {
      const { plans } = await getPlans();
      dispatch({ type: 'SET_PLANS', payload: plans });
    } catch (error: any) {
      console.error('Failed to load plans:', error);
    }
  }, []);

  // ========================================================================
  // QUERIES
  // ========================================================================

  const canAccess = useCallback((feature: string): boolean => {
    // If feature is in the user's features list, they have access
    if (state.features.includes(feature)) return true;

    // Premium features require active-like status
    const activeStatuses = ['active', 'trialing', 'past_due'];
    if (activeStatuses.includes(state.status) && state.tier !== 'free') {
      return true;
    }

    // Cancelled but within period
    if (state.status === 'cancelled' && state.accessUntil) {
      return new Date(state.accessUntil) > new Date();
    }

    return false;
  }, [state.features, state.status, state.tier, state.accessUntil]);

  const isPremium = useCallback((): boolean => {
    return state.tier !== 'free' && ['active', 'trialing', 'past_due'].includes(state.status);
  }, [state.tier, state.status]);

  const isTrialing = useCallback((): boolean => {
    return state.status === 'trialing';
  }, [state.status]);

  const hasGracePeriod = useCallback((): boolean => {
    return state.status === 'past_due';
  }, [state.status]);

  const getFeatureUsage = useCallback((feature: string) => {
    const usage = state.usage[feature];
    if (!usage) return null;
    return {
      used: usage.used,
      limit: usage.limit,
      remaining: Math.max(0, usage.limit - usage.used),
    };
  }, [state.usage]);

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const initiateUpgrade = useCallback(async (planId: string): Promise<string> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await createSubscription(planId);
      dispatch({ type: 'SET_LOADING', payload: false });
      return result.approvalUrl;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.error || 'Failed to create subscription' });
      throw error;
    }
  }, []);

  const confirmActivation = useCallback(async (subscriptionId: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await activateSubscription(subscriptionId);
      await refreshSubscription();
      dispatch({ type: 'CLOSE_UPGRADE_MODAL' });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.error || 'Failed to activate subscription' });
      throw error;
    }
  }, [refreshSubscription]);

  const requestCancel = useCallback(async (reason?: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await cancelSubscription(reason);
      await refreshSubscription();
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.error || 'Failed to cancel subscription' });
      throw error;
    }
  }, [refreshSubscription]);

  const requestTrial = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await startTrial();
      await refreshSubscription();
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error?.error || 'Failed to start trial' });
      throw error;
    }
  }, [refreshSubscription]);

  // ========================================================================
  // UI HELPERS
  // ========================================================================

  const openUpgradeModal = useCallback((feature?: string) => {
    dispatch({ type: 'OPEN_UPGRADE_MODAL', payload: feature || null });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_UPGRADE_MODAL' });
  }, []);

  // Listen for paywall events from API interceptor — auto-open UpgradeModal
  useEffect(() => {
    const cleanup = onPaywallEvent((event) => {
      console.log('[Subscription] Paywall triggered:', event.code, event.feature);
      openUpgradeModal(event.feature || undefined);
      refreshSubscription();
    });
    return cleanup;
  }, [openUpgradeModal, refreshSubscription]);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const value: SubscriptionContextValue = {
    ...state,
    canAccess,
    isPremium,
    isTrialing,
    hasGracePeriod,
    getFeatureUsage,
    refreshSubscription,
    refreshUsage,
    loadPlans,
    initiateUpgrade,
    confirmActivation,
    requestCancel,
    requestTrial,
    openUpgradeModal,
    closeUpgradeModal,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
