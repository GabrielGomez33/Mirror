// ============================================================================
// SUBSCRIPTION API SERVICE
// ============================================================================
// File: services/subscriptionApi.ts
// Frontend API calls for subscription management.
// ============================================================================

import { getToken } from '../utils/token';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api/subscription`
  : '/mirror/api/subscription';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionStatus {
  tier: 'free' | 'premium' | 'enterprise';
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
  accessUntil: string | null;
  features: string[];
  usage: Record<string, {
    used: number;
    limit: number;
    resetsAt: string;
    isExceeded: boolean;
  }>;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  provider: string | null;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  trialDays: number;
  isCurrent: boolean;
}

export interface CreateSubscriptionResult {
  approvalUrl: string;
  subscriptionId: string;
}

// ============================================================================
// HELPER
// ============================================================================

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed', code: 'UNKNOWN' }));
    throw {
      status: response.status,
      ...error,
    };
  }

  return response.json();
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Get current subscription status, tier, usage, and features.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiRequest<SubscriptionStatus>('/');
}

/**
 * Get available subscription plans.
 */
export async function getPlans(): Promise<{ plans: Plan[] }> {
  return apiRequest<{ plans: Plan[] }>('/plans');
}

/**
 * Create a new subscription. Returns PayPal approval URL.
 * Redirect the user to approvalUrl to complete payment.
 */
export async function createSubscription(planId: string): Promise<CreateSubscriptionResult> {
  return apiRequest<CreateSubscriptionResult>('/create', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}

/**
 * Activate subscription after PayPal approval.
 * Call this when user returns from PayPal with subscription_id.
 */
export async function activateSubscription(subscriptionId: string): Promise<{
  tier: string;
  status: string;
  features: string[];
  message: string;
}> {
  return apiRequest('/activate', {
    method: 'POST',
    body: JSON.stringify({ subscriptionId }),
  });
}

/**
 * Cancel current subscription with optional reason.
 */
export async function cancelSubscription(reason?: string): Promise<{
  status: string;
  accessUntil: string | null;
  message: string;
}> {
  return apiRequest('/cancel', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Start a free trial (if available).
 */
export async function startTrial(): Promise<{
  status: string;
  tier: string;
  trialDaysLeft: number;
  features: string[];
  message: string;
}> {
  return apiRequest('/start-trial', {
    method: 'POST',
  });
}

/**
 * Get detailed usage breakdown.
 */
export async function getUsage(): Promise<{
  tier: string;
  usage: SubscriptionStatus['usage'];
  isPremium: boolean;
}> {
  return apiRequest('/usage');
}
