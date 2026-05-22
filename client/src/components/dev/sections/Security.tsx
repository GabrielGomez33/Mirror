import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Security: React.FC = () => {
  return (
    <DevSection id="security" title="Security model" eyebrow="Trust & defense">
      <DevSubsection id="security-overview" title="Overview">
        <p>
          Mirror runs defense in depth across six layers: transport, headers,
          allow-listed cross-origin, authentication, authorization, and
          rate / usage limits. End-user content lives behind an additional
          encryption layer for group data. Nothing trusts a single layer —
          every layer assumes the layer above it was bypassed.
        </p>
      </DevSubsection>

      <DevSubsection id="security-transport" title="Transport (TLS, HSTS)">
        <p>
          Both services listen over HTTPS only. TLS certs are loaded from
          paths supplied by the environment (<code>TUGRRPRIV</code>,{' '}
          <code>TUGRRCERT</code>, <code>TUGRRINTERCERT</code>) at process
          start. Helmet applies HSTS with a 1-year max-age, including
          subdomains and preload eligibility.
        </p>
        <DevCodeBlock
          language="ts"
          caption="Helmet HSTS (effective settings)"
          code={`
helmet({
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  // ...
})
          `}
        />
      </DevSubsection>

      <DevSubsection id="security-headers" title="HTTP security headers (Helmet)">
        <DevCodeBlock
          language="ts"
          caption="Effective Content-Security-Policy on mirror-server"
          code={`
contentSecurityPolicy: {
  directives: {
    defaultSrc:              ["'self'"],
    scriptSrc:               ["'self'"],
    styleSrc:                ["'self'", "'unsafe-inline'"],
    imgSrc:                  ["'self'", "data:", "https:"],
    fontSrc:                 ["'self'", "https:"],
    connectSrc:              ["'self'", "wss:", "https:"],
    frameAncestors:          ["'none'"],
    objectSrc:               ["'none'"],
    baseUri:                 ["'self'"],
    formAction:              ["'self'"],
    upgradeInsecureRequests: [],
  },
}
          `}
        />
        <DevCallout kind="info" title="'unsafe-inline' for style only">
          The CSP allows inline styles because Tailwind's runtime + a
          handful of style-attribute usages would otherwise require a
          script-level CSP nonce pipeline. Scripts have no inline
          allowance.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="security-cors" title="CORS allow-list">
        <p>
          Cross-origin is explicit, never reflective. Allowed origins:
        </p>
        <ul className="dt-bullets space-y-1">
          <li><code>https://theundergroundrailroad.world</code></li>
          <li><code>https://www.theundergroundrailroad.world</code></li>
          <li>In dev: <code>http://localhost:3000</code>, <code>http://localhost:5173</code>, and 127.0.0.1 equivalents.</li>
        </ul>
        <p>
          Methods allowed: GET, POST, PUT, DELETE, PATCH, OPTIONS. Headers
          allowed: Content-Type, Authorization, X-Requested-With. Preflight
          cache 24 hours. Credentials true.
        </p>
      </DevSubsection>

      <DevSubsection id="security-auth" title="Authentication & sessions">
        <DevFieldList
          caption="Auth contract"
          rows={[
            { name: 'JWT algorithm', type: 'HS256', description: 'Symmetric — JWT_KEY must remain a secret, never shipped to the client.' },
            { name: 'Access token TTL', type: '15 minutes', description: 'Short on purpose. The client refreshes proactively at T-5min.' },
            { name: 'Refresh token TTL', type: '7 days', description: 'Stored in localStorage. Revoked on logout, password reset, and forced logout.' },
            { name: 'Session record', type: 'user_sessions', description: 'Holds user_id, session_id, user_agent, ip_address, device_fingerprint, expires_at. The session_id is embedded in the JWT.' },
            { name: 'Password hashing', type: 'bcrypt × 10', description: 'About 100ms per hash. Tunable upward as hardware improves.' },
            { name: 'Password policy', description: '≥ 8 chars, mixed case, digit, special. Compared against a common-password list before acceptance.' },
            { name: 'Email verification token', type: '24h, single-use', description: 'Stored in email_verification_tokens; consumed on /auth/verify-email.' },
            { name: 'Password reset token', type: '60min, single-use', description: <>Stored in password_reset_tokens. <strong>All</strong> active sessions are revoked on successful reset.</> },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="security-rbac" title="Authorization, tiers, and security levels">
        <DevFieldList
          caption="Client-side AccessLevel enum"
          rows={[
            { name: 'PUBLIC',            description: 'No auth required.' },
            { name: 'AUTHENTICATED',     description: 'Valid JWT.' },
            { name: 'VERIFIED',          description: 'JWT + verified email.' },
            { name: 'INTAKE_REQUIRED',   description: 'Intake completed.' },
            { name: 'PREMIUM',           description: 'Active premium subscription (incl. trialing / grace).' },
            { name: 'ADMIN',             description: 'Admin role.' },
          ]}
        />
        <DevFieldList
          caption="Server-side SecurityLevel enum"
          rows={[
            { name: 'PUBLIC (0)',         description: 'No auth.' },
            { name: 'BASIC (1)',          description: 'JWT only.' },
            { name: 'VERIFIED (2)',       description: 'JWT + email verified.' },
            { name: 'TIER2_ACCESS (3)',   description: 'Verified + tier-2 data permissions.' },
            { name: 'TIER3_ACCESS (4)',   description: 'Verified + tier-3 data permissions.' },
            { name: 'ADMIN (5)',          description: 'Admin operations.' },
          ]}
        />
        <p>
          The two ladders are coupled by the route permission map and the{' '}
          <code>requireSecurityLevel(level)</code> middleware. A request
          that satisfies the access ladder but fails the security ladder
          returns 403 with a route-specific error message.
        </p>
      </DevSubsection>

      <DevSubsection id="security-rate-limits" title="Rate limiting & usage gates">
        <p>
          There are two related but distinct controls. <strong>Rate
          limits</strong> protect the system from one user spamming
          (e.g. 10 journal entries / 5 min, 10 truth-card upserts / 5 min,
          60 truth-card reads / minute). <strong>Usage gates</strong>{' '}
          enforce subscription-tier quotas (e.g. 100 journal entries /
          month for free tier).
        </p>
        <p>
          Rate limits are in-memory and per process — acceptable because
          the same user reaching multiple processes is rare and the limits
          are intentionally generous. Usage tracking is durable in MySQL
          (<code>usage_tracking</code>) and resets at period boundaries
          (daily / weekly / monthly).
        </p>
      </DevSubsection>

      <DevSubsection id="security-encryption" title="Encryption at rest (group AES-256-GCM)">
        <p>
          Group chat messages and group-shared data are encrypted with
          AES-256-GCM. Each group owns a master key, derived at group
          creation; each member's copy is wrapped with a key-encryption-key
          derived from their credentials. Keys rotate on member join and
          leave.
        </p>
        <DevCodeBlock
          language="ts"
          caption="Cipher contract (simplified)"
          code={`
// Encrypt (writer side)
const nonce = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', groupMasterKey, nonce);
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
return { ciphertext: ct, nonce, tag };

// Decrypt (reader side) — fails closed if tag doesn't verify
const decipher = createDecipheriv('aes-256-gcm', groupMasterKey, nonce);
decipher.setAuthTag(tag);
const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
          `}
        />
        <DevCallout kind="warning" title="Database fields contain ciphertext only">
          The <code>content</code> column of <code>group_chat_messages</code>{' '}
          stores the AES-GCM ciphertext envelope. Even an operator with
          direct database access cannot read messages without the per-group
          key material, which is itself wrapped per member.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="security-trust-levels" title="Dina trust levels">
        <p>
          Dina has its own four-state trust model independent of Mirror's
          subscription tier. The state is per device fingerprint + IP +
          user-agent triple, stored in <code>dina_users</code>.
        </p>
        <DevFieldList
          rows={[
            { name: 'new',         description: 'First-time caller. 30 req/min, 50 K token budget, restricted model list.' },
            { name: 'trusted',     description: 'Proven responsible use. 500 req/min, unlimited tokens, all models.' },
            { name: 'suspicious',  description: 'Anomalous behavior detected. 5 req/min, 10 K tokens, embedding + small models only.' },
            { name: 'blocked',     description: '1 req/min, 1 K tokens, embedding only — effectively read-only.' },
          ]}
        />
        <p>
          For service-to-service traffic from mirror-server, the connector
          can also use <code>X-Service-Key</code> with{' '}
          <code>MIRROR_SERVICE_KEY</code> (timing-safe comparison) which
          bypasses the trust-level ladder.
        </p>
      </DevSubsection>

      <DevSubsection id="security-input" title="Input validation & sanitization">
        <ul className="dt-bullets space-y-1">
          <li>All MySQL queries use prepared statements with placeholders.</li>
          <li>Route handlers validate UUIDs, integer ranges, and enum membership before any DB call.</li>
          <li>Strings are stripped of control characters and capped at length (10 KB journal content, 500 char group description, 255 char names).</li>
          <li>Multer enforces MIME and size limits on uploads.</li>
          <li>Worker inputs are sanitized for null bytes and whitespace normalization before reaching the LLM prompt.</li>
        </ul>
      </DevSubsection>

      <DevSubsection id="security-secrets" title="Secrets & environment hygiene">
        <ul className="dt-bullets space-y-1">
          <li><code>.env</code> and <code>.payenv</code> are <strong>not</strong> committed.</li>
          <li>JWT secret minimum 32 characters; <code>SYSTEM_MASTER_KEY</code> is 64 hex chars (256 bits).</li>
          <li>PayPal client secret is split between <code>.payenv</code> and the provider; webhooks verify signatures before any state transition.</li>
          <li>Logs scrub Authorization headers and token-shaped values before write.</li>
        </ul>
      </DevSubsection>

      <DevSubsection id="security-disclosure" title="Reporting a vulnerability">
        <DevCallout kind="security" title="Coordinated disclosure">
          If you find a security issue, please report it privately via the
          repo owner's GitHub profile before opening a public issue.
          Provide reproduction steps, the affected component, and an
          assessment of impact. Expect an acknowledgement within 72 hours
          and a target remediation window proportional to severity.
        </DevCallout>
      </DevSubsection>
    </DevSection>
  );
};

export default Security;
