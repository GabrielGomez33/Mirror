// ============================================================================
// PAYWALL INTERCEPTOR — Global 403 handler for subscription gating
// ============================================================================
// Wraps any API call and intercepts 403 responses with paywall-specific
// error codes (USAGE_LIMIT, UPGRADE_REQUIRED). Shows the UpgradeModal
// automatically with contextual messaging.
//
// Usage:
//   import { paywallFetch } from '../services/paywallInterceptor';
//   const data = await paywallFetch('/mirror/api/journal/entry', { method: 'POST', ... });
//
// Or use the hook:
//   const { guardedFetch } = usePaywallGuard();
//   const data = await guardedFetch('/mirror/api/journal/entry', { method: 'POST', ... });
// ============================================================================

// Global event bus for paywall triggers — decouples API layer from React
const PAYWALL_EVENT = 'mirror:paywall:triggered';

export interface PaywallEvent {
  code: 'USAGE_LIMIT' | 'UPGRADE_REQUIRED';
  feature?: string;
  error: string;
  used?: number;
  limit?: number;
  upgradeUrl?: string;
}

/**
 * Dispatch a paywall event that the SubscriptionContext listens for.
 * This decouples the API layer from React — no context imports needed.
 */
export function dispatchPaywallEvent(detail: PaywallEvent): void {
  window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail }));
}

/**
 * Listen for paywall events. Returns cleanup function.
 */
export function onPaywallEvent(handler: (event: PaywallEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<PaywallEvent>).detail);
  window.addEventListener(PAYWALL_EVENT, listener);
  return () => window.removeEventListener(PAYWALL_EVENT, listener);
}

/**
 * Enhanced fetch that intercepts 403 paywall responses.
 * - USAGE_LIMIT: User hit their free-tier limit (e.g., 5/5 journal entries)
 * - UPGRADE_REQUIRED: Feature requires premium subscription
 *
 * For non-paywall errors (auth failures, validation, etc.), throws normally.
 */
export async function paywallFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 403) {
    // Clone response so we can read body without consuming it
    const cloned = response.clone();
    try {
      const data = await cloned.json();

      if (data.code === 'USAGE_LIMIT' || data.code === 'UPGRADE_REQUIRED') {
        dispatchPaywallEvent({
          code: data.code,
          feature: data.feature,
          error: data.error,
          used: data.used,
          limit: data.limit,
          upgradeUrl: data.upgradeUrl,
        });

        // Throw a structured error so callers can differentiate
        const err = new Error(data.error) as any;
        err.code = data.code;
        err.feature = data.feature;
        err.isPaywall = true;
        throw err;
      }
    } catch (parseErr) {
      // If it's our paywall error, re-throw it
      if ((parseErr as any)?.isPaywall) throw parseErr;
      // Otherwise it's a non-paywall 403 (auth issue, etc.) — let it fall through
    }
  }

  return response;
}
