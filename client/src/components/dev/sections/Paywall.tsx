import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Paywall: React.FC = () => {
  return (
    <DevSection id="paywall" title="Paywall & subscriptions" eyebrow="Billing">
      <DevSubsection id="paywall-tiers" title="Tiers">
        <DevFieldList
          rows={[
            { name: 'free', description: 'Default tier. Limited usage on metered features. 1 group / week, 100 journal entries / month, 1 personal analysis / week.' },
            { name: 'premium', description: 'Full feature access, no metered limits. Typically $9.99 / month via PayPal.' },
            { name: 'enterprise', description: 'Custom feature set. Manually managed; not user-self-serve.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="paywall-state-machine" title="Subscription state machine">
        <DevCodeBlock
          language="ascii"
          noLineNumbers
          code={`
            free ──────► trialing ───► active ───► past_due ───► expired
                          │             │              │
                          └─────► cancelled ◄──────────┘
                                       │
                          (after current_period_end)
                                       │
                                       ▼
                                   expired
          `}
        />
        <p>
          <code>VALID_TRANSITIONS</code> in <code>paywall/types/index.ts</code>{' '}
          encodes which transitions are legal. The subscription service
          rejects any update that doesn't match.
        </p>
      </DevSubsection>

      <DevSubsection id="paywall-gates" title="Feature gates">
        <p>
          Gates are declarative. The <code>PAYWALL_GATES</code> entry in{' '}
          <code>.payenv</code> maps route patterns → required tier. At
          startup, <code>authMiddleware.buildGateRulesFromConfig()</code>{' '}
          compiles them into the global <code>subscriptionGate</code>{' '}
          middleware.
        </p>
        <DevCodeBlock
          language="ini"
          caption=".payenv excerpt"
          code={`
PAYWALL_GATES={
  "create_group":     "premium",
  "group_insights":   "premium",
  "journal_analysis": "premium"
}

PAYWALL_FREE_LIMITS={
  "groups_created":            1,
  "journal_entries":         100,
  "personal_analysis_per_week": 1
}
          `}
        />
      </DevSubsection>

      <DevSubsection id="paywall-usage" title="Free-tier usage tracking">
        <p>
          <code>usage_tracking</code> rows are keyed by (user_id, feature_key,
          period_type, period_start). The gate middleware increments before
          the handler runs and returns 429 if the count would exceed the
          limit. Periods reset on the natural boundary (start of day, week,
          month). Premium users skip the counter entirely.
        </p>
      </DevSubsection>

      <DevSubsection id="paywall-paypal" title="PayPal flow">
        <ol className="dt-numbered space-y-1.5">
          <li>Client posts to <code>/mirror/api/subscription/create</code> with a planId.</li>
          <li>Server calls PayPal <code>POST /v1/billing/subscriptions</code>; PayPal returns an approval URL.</li>
          <li>Server responds with the approval URL; client redirects.</li>
          <li>User approves on PayPal; PayPal redirects back to the configured return URL with the subscription id.</li>
          <li>Client posts to <code>/mirror/api/subscription/approve</code>.</li>
          <li>Server fetches subscription details from PayPal, upserts <code>user_subscriptions</code>, writes a row in <code>subscription_events</code>.</li>
        </ol>
      </DevSubsection>

      <DevSubsection id="paywall-webhooks" title="Webhook handling">
        <p>
          PayPal webhooks are mounted <strong>before</strong> auth middleware
          at <code>PAYWALL_WEBHOOK_PATH</code> (e.g.{' '}
          <code>/mirror/api/webhooks/paypal</code>). The handler verifies the
          signature, then writes an event row keyed by{' '}
          <code>provider_event_id</code> — the unique constraint provides
          natural idempotency for retried deliveries.
        </p>
        <DevCallout kind="warning" title="Reject before mutate">
          Signature verification happens first; if it fails the handler
          returns 401 and writes nothing. Replays of valid events are
          accepted but no-op via the unique-constraint conflict.
        </DevCallout>
        <DevFieldList
          caption="Event handlers"
          rows={[
            { name: 'billing.subscription.created',  description: 'status → trialing or active; set trial_end / current_period_end.' },
            { name: 'billing.subscription.updated',  description: 'Map PayPal sub state into our state machine.' },
            { name: 'payment.capture.completed',     description: 'Confirm active; clear past_due if set.' },
            { name: 'payment.capture.refunded',      description: 'Record the refund in the event log; tier evaluation re-runs on next request.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="paywall-cron" title="Background jobs (cron)">
        <DevFieldList
          rows={[
            { name: 'Every 30 seconds', description: 'Email queue flush — sends queued welcome / verify / reset / trial-ending / payment-confirmed emails with retry.' },
            { name: 'Hourly',           description: 'Expire trials whose trial_end has passed; expire grace periods whose grace_period_end has passed.' },
            { name: 'Daily',            description: 'Send trial-ending notifications 24h before trial_end.' },
            { name: 'Weekly',           description: 'Expire cancelled subscriptions whose current_period_end has passed.' },
          ]}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default Paywall;
