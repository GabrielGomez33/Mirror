// ============================================================================
// PAYWALL INTERCEPTOR — Global 403 handler for subscription gating
// ============================================================================
// Fires a browser CustomEvent when any API returns 403 with paywall codes.
// SubscriptionContext listens and auto-opens the UpgradeModal.
// ============================================================================

const PAYWALL_EVENT = 'mirror:paywall:triggered';

export interface PaywallEvent {
  code: 'USAGE_LIMIT' | 'UPGRADE_REQUIRED';
  feature?: string;
  error: string;
  used?: number;
  limit?: number;
}

export function dispatchPaywallEvent(detail: PaywallEvent): void {
  window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail }));
}

export function onPaywallEvent(handler: (event: PaywallEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<PaywallEvent>).detail);
  window.addEventListener(PAYWALL_EVENT, listener);
  return () => window.removeEventListener(PAYWALL_EVENT, listener);
}