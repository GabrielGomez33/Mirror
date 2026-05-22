/**
 * Mirror /dev manifest
 *
 * Single source of truth for the docs sidebar, table of contents, and
 * client-side search. Section/subsection ids MUST match the `id` props
 * passed to <DevSection /> and <DevSubsection /> in the corresponding
 * content files under ./sections.
 *
 * Keep this file alphabetized by category, NOT alphabetically — order here
 * controls the rendered order of the sidebar.
 */

export type DevCategoryId =
  | 'overview'
  | 'frontend'
  | 'backend'
  | 'integration'
  | 'security'
  | 'operations';

export interface DevCategory {
  id: DevCategoryId;
  label: string;
  description: string;
}

export interface DevSubsectionEntry {
  id: string;
  title: string;
  /** Extra search terms not present in the title. Kept short. */
  keywords?: string[];
}

export interface DevSectionEntry {
  id: string;
  title: string;
  category: DevCategoryId;
  /** Optional small label rendered above the section heading. */
  eyebrow?: string;
  /** Short summary used by search and the section cards on the index. */
  summary: string;
  subsections: DevSubsectionEntry[];
}

export const DEV_CATEGORIES: DevCategory[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'What Mirror is and how the three services fit together.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    description: 'The Mirror client — pages, contexts, services, PWA.',
  },
  {
    id: 'backend',
    label: 'Backend',
    description: 'mirror-server, dina-server, and the Dina mirror module.',
  },
  {
    id: 'integration',
    label: 'Integration',
    description: 'How the services talk to each other.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Auth, encryption, rate limits, key management.',
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Deployment, monitoring, environment, glossary.',
  },
];

export const DEV_SECTIONS: DevSectionEntry[] = [
  // ─── OVERVIEW ─────────────────────────────────────────────────────────
  {
    id: 'introduction',
    title: 'Introduction',
    category: 'overview',
    eyebrow: 'Start here',
    summary:
      'What Mirror is, why three repositories, and the contract between them.',
    subsections: [
      { id: 'introduction-what', title: 'What is Mirror?' },
      { id: 'introduction-three-repos', title: 'The three repositories', keywords: ['mirror', 'mirror-server', 'dina-server'] },
      { id: 'introduction-contract', title: 'The boundary contract', keywords: ['separation of concerns'] },
      { id: 'introduction-conventions', title: 'Conventions used in these docs' },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    category: 'overview',
    eyebrow: 'System view',
    summary: 'Topology, request paths, and where state lives.',
    subsections: [
      { id: 'architecture-topology', title: 'Topology' },
      { id: 'architecture-request-paths', title: 'Request paths' },
      { id: 'architecture-state', title: 'Where state lives', keywords: ['mysql', 'redis', 'localstorage'] },
      { id: 'architecture-protocols', title: 'Protocols at a glance', keywords: ['http', 'websocket', 'dump'] },
    ],
  },

  // ─── FRONTEND ─────────────────────────────────────────────────────────
  {
    id: 'frontend',
    title: 'Frontend — Mirror client',
    category: 'frontend',
    eyebrow: 'Mirror client',
    summary: 'React 19 + Vite app, PWA, glass-morphism design system.',
    subsections: [
      { id: 'frontend-stack', title: 'Stack' },
      { id: 'frontend-routing', title: 'Routing map', keywords: ['react-router', 'routes'] },
      { id: 'frontend-pages', title: 'Pages, page by page' },
      { id: 'frontend-contexts', title: 'Contexts and global state' },
      { id: 'frontend-services', title: 'Service layer (REST + WS)' },
      { id: 'frontend-components', title: 'Components' },
      { id: 'frontend-hooks', title: 'Hooks' },
      { id: 'frontend-styling', title: 'Design system & styling', keywords: ['glass', 'tailwind', 'fonts'] },
      { id: 'frontend-pwa', title: 'PWA & service worker', keywords: ['offline', 'push', 'workbox'] },
      { id: 'frontend-build', title: 'Build, deploy, .htaccess' },
    ],
  },
  {
    id: 'intake',
    title: 'The intake pipeline',
    category: 'frontend',
    eyebrow: 'Deep dive',
    summary:
      'How visual, vocal, IQ, astrology, and personality data are captured, stored, and submitted — in the order each step actually navigates.',
    subsections: [
      { id: 'intake-overview',          title: 'Overview', keywords: ['flow', 'order'] },
      { id: 'intake-entry',             title: 'Entry — Welcome / Registration' },
      { id: 'intake-step-visual',       title: 'Step 1 — VisualStep (face-api)', keywords: ['tensorflow', 'face', 'camera'] },
      { id: 'intake-step-vocal',        title: 'Step 2 — VocalStep', keywords: ['microphone', 'audio'] },
      { id: 'intake-step-iq',           title: 'Step 3 — IQStep' },
      { id: 'intake-step-astrology',    title: 'Step 4 — AstroLogicalStep' },
      { id: 'intake-step-personality',  title: 'Step 5 — PersonalityStep (Big-5 / MBTI)' },
      { id: 'intake-step-submit',       title: 'Step 6 — SubmitStep' },
      { id: 'intake-step-results',      title: 'Step 7 — ResultsStep' },
      { id: 'intake-persistence',       title: 'Client-side persistence', keywords: ['localstorage'] },
      { id: 'intake-payload',           title: 'Submission payload shape' },
      { id: 'intake-edge-cases',        title: 'Edge cases and recovery' },
    ],
  },

  // ─── BACKEND ──────────────────────────────────────────────────────────
  {
    id: 'mirror-server',
    title: 'Backend — mirror-server',
    category: 'backend',
    eyebrow: 'Express service',
    summary: 'Auth, intake storage, groups, chat, TruthStream, paywall.',
    subsections: [
      { id: 'mirror-server-stack', title: 'Stack' },
      { id: 'mirror-server-bootstrap', title: 'Bootstrap sequence' },
      { id: 'mirror-server-routes', title: 'Routes' },
      { id: 'mirror-server-controllers', title: 'Controllers' },
      { id: 'mirror-server-services', title: 'Services' },
      { id: 'mirror-server-managers', title: 'Managers' },
      { id: 'mirror-server-middleware', title: 'Middleware', keywords: ['authMiddleware', 'rate limit'] },
      { id: 'mirror-server-wss', title: 'WebSocket layer' },
      { id: 'mirror-server-workers', title: 'PM2 workers and queues' },
      { id: 'mirror-server-analyzers', title: 'Analyzers' },
      { id: 'mirror-server-paywall', title: 'Paywall (PayPal + tiers)' },
      { id: 'mirror-server-database', title: 'Database schema' },
    ],
  },
  {
    id: 'dina-server',
    title: 'Backend — dina-server',
    category: 'backend',
    eyebrow: 'Intelligence service',
    summary: 'Dina LLM (Ollama), DIGIM, and the Mirror module entry point.',
    subsections: [
      { id: 'dina-server-stack', title: 'Stack' },
      { id: 'dina-server-bootstrap', title: 'Bootstrap and DinaCore' },
      { id: 'dina-server-mirror-module', title: 'The Mirror module (entry point)', keywords: ['src/modules/mirror', 'boundary'] },
      { id: 'dina-server-llm', title: 'LLM module (Ollama)', keywords: ['qwen', 'mistral', 'codellama', 'llama2'] },
      { id: 'dina-server-digim', title: 'DIGIM intelligence' },
      { id: 'dina-server-api', title: 'API routes' },
      { id: 'dina-server-database', title: 'Database & Redis' },
      { id: 'dina-server-wss', title: 'WebSocket layer' },
    ],
  },

  // ─── INTEGRATION ──────────────────────────────────────────────────────
  {
    id: 'integration',
    title: 'Mirror ↔ Dina integration',
    category: 'integration',
    eyebrow: 'Cross-service',
    summary:
      'The mandatory boundary: every mirror-server → dina-server call goes through Dina’s Mirror module.',
    subsections: [
      { id: 'integration-boundary', title: 'The boundary rule' },
      { id: 'integration-connector', title: 'DINALLMConnector', keywords: ['mirror-server/integrations'] },
      { id: 'integration-endpoints', title: 'Dina endpoints used by mirror-server' },
      { id: 'integration-circuit-breaker', title: 'Circuit breaker & retries' },
      { id: 'integration-streaming', title: 'Streaming chat (@Dina)' },
    ],
  },
  {
    id: 'dump-protocol',
    title: 'DUMP protocol',
    category: 'integration',
    eyebrow: 'Message format',
    summary:
      'Dina Universal Message Protocol — the envelope every request and response uses.',
    subsections: [
      { id: 'dump-overview', title: 'Overview' },
      { id: 'dump-envelope', title: 'Envelope shape (DinaUniversalMessage)' },
      { id: 'dump-response', title: 'Response shape (DinaResponse)' },
      { id: 'dump-qos', title: 'Quality of service & priority' },
      { id: 'dump-tracing', title: 'Tracing & performance fields' },
    ],
  },
  {
    id: 'websocket',
    title: 'WebSocket events',
    category: 'integration',
    eyebrow: 'Real-time',
    summary: 'Every event broadcast on the groups, chat, and signaling sockets.',
    subsections: [
      { id: 'websocket-endpoints', title: 'Endpoints' },
      { id: 'websocket-groups', title: 'Group notification events' },
      { id: 'websocket-chat', title: 'Chat events' },
      { id: 'websocket-signaling', title: 'WebRTC signaling' },
      { id: 'websocket-lifecycle', title: 'Connection lifecycle' },
    ],
  },
  {
    id: 'api-reference',
    title: 'API reference',
    category: 'integration',
    eyebrow: 'Reference',
    summary: 'Complete catalog of HTTP endpoints exposed by mirror-server and dina-server.',
    subsections: [
      { id: 'api-reference-auth', title: 'Authentication' },
      { id: 'api-reference-user', title: 'User & account' },
      { id: 'api-reference-intake', title: 'Intake' },
      { id: 'api-reference-journal', title: 'Journal' },
      { id: 'api-reference-groups', title: 'Groups' },
      { id: 'api-reference-chat', title: 'Group chat' },
      { id: 'api-reference-truthstream', title: 'TruthStream' },
      { id: 'api-reference-mymirror', title: 'MyMirror / Personal analysis' },
      { id: 'api-reference-subscription', title: 'Subscription' },
      { id: 'api-reference-dina', title: 'Dina (v1)' },
    ],
  },

  // ─── SECURITY ─────────────────────────────────────────────────────────
  {
    id: 'security',
    title: 'Security model',
    category: 'security',
    eyebrow: 'Trust & defense',
    summary: 'Defense in depth — transport, headers, auth, encryption, rate limiting.',
    subsections: [
      { id: 'security-overview', title: 'Overview' },
      { id: 'security-transport', title: 'Transport (TLS, HSTS)' },
      { id: 'security-headers', title: 'HTTP security headers (Helmet)' },
      { id: 'security-cors', title: 'CORS allow-list' },
      { id: 'security-auth', title: 'Authentication & sessions' },
      { id: 'security-rbac', title: 'Authorization, tiers, and security levels' },
      { id: 'security-rate-limits', title: 'Rate limiting & usage gates' },
      { id: 'security-encryption', title: 'Encryption at rest (group AES-256-GCM)' },
      { id: 'security-trust-levels', title: 'Dina trust levels' },
      { id: 'security-input', title: 'Input validation & sanitization' },
      { id: 'security-secrets', title: 'Secrets & environment hygiene' },
      { id: 'security-disclosure', title: 'Reporting a vulnerability' },
    ],
  },

  // ─── OPERATIONS ───────────────────────────────────────────────────────
  {
    id: 'deployment',
    title: 'Deployment & operations',
    category: 'operations',
    eyebrow: 'Run book',
    summary: 'PM2, environment variables, certificates, logs, health checks.',
    subsections: [
      { id: 'deployment-pm2', title: 'PM2 process model' },
      { id: 'deployment-env-mirror', title: 'Environment — mirror-server' },
      { id: 'deployment-env-dina', title: 'Environment — dina-server' },
      { id: 'deployment-tls', title: 'TLS / certificates' },
      { id: 'deployment-logs', title: 'Logs & monitoring' },
      { id: 'deployment-health', title: 'Health checks' },
      { id: 'deployment-rollouts', title: 'Zero-downtime rollouts' },
    ],
  },
  {
    id: 'paywall',
    title: 'Paywall & subscriptions',
    category: 'operations',
    eyebrow: 'Billing',
    summary: 'Tiers, trials, grace periods, PayPal integration, gates.',
    subsections: [
      { id: 'paywall-tiers', title: 'Tiers' },
      { id: 'paywall-state-machine', title: 'Subscription state machine' },
      { id: 'paywall-gates', title: 'Feature gates' },
      { id: 'paywall-usage', title: 'Free-tier usage tracking' },
      { id: 'paywall-paypal', title: 'PayPal flow' },
      { id: 'paywall-webhooks', title: 'Webhook handling' },
      { id: 'paywall-cron', title: 'Background jobs (cron)' },
    ],
  },
  {
    id: 'glossary',
    title: 'Glossary',
    category: 'operations',
    eyebrow: 'Reference',
    summary: 'Terminology used across Mirror, Dina, and these docs.',
    subsections: [
      { id: 'glossary-terms', title: 'Terms A–Z' },
    ],
  },
];

/**
 * Convenience: flatten manifest to a searchable list of (sectionId, subsectionId, label, blob).
 * Pure function; safe to call in render.
 */
export interface SearchEntry {
  sectionId: string;
  sectionTitle: string;
  category: DevCategoryId;
  subsectionId?: string;
  label: string;
  blob: string;
}

export function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const s of DEV_SECTIONS) {
    entries.push({
      sectionId: s.id,
      sectionTitle: s.title,
      category: s.category,
      label: s.title,
      blob: `${s.title} ${s.summary} ${s.eyebrow || ''}`.toLowerCase(),
    });
    for (const sub of s.subsections) {
      const kw = sub.keywords ? sub.keywords.join(' ') : '';
      entries.push({
        sectionId: s.id,
        sectionTitle: s.title,
        category: s.category,
        subsectionId: sub.id,
        label: `${s.title} → ${sub.title}`,
        blob: `${sub.title} ${kw} ${s.title}`.toLowerCase(),
      });
    }
  }
  return entries;
}
