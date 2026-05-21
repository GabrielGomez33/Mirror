import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevFieldList from '../DevField';

const Glossary: React.FC = () => {
  return (
    <DevSection id="glossary" title="Glossary" eyebrow="Reference">
      <DevSubsection id="glossary-terms" title="Terms A–Z">
        <DevFieldList
          rows={[
            { name: 'Access level',          description: 'Client-side enum (PUBLIC / AUTHENTICATED / VERIFIED / INTAKE_REQUIRED / PREMIUM / ADMIN). Drives ProtectedRoute and ConditionalRender.' },
            { name: 'AES-256-GCM',           description: 'Authenticated encryption used for group chat and group-shared data. Provides confidentiality and integrity.' },
            { name: 'Big-5 / OCEAN',         description: 'Five-factor personality model — openness, conscientiousness, extraversion, agreeableness, neuroticism. Captured during intake step 1.' },
            { name: 'Boundary contract',     description: 'The rule that all mirror-server ↔ dina-server traffic goes through dina-server\'s Mirror module.' },
            { name: 'Circuit breaker',       description: 'Failure-tolerance pattern: closed → open after N failures → half-open after cool-off → closed on success. Used by DINALLMConnector and all workers.' },
            { name: 'DINALLMConnector',      description: 'mirror-server/integrations/DINALLMConnector.ts — the only file that calls dina-server.' },
            { name: 'DIGIM',                 description: 'Dina\'s intelligence-gathering module. Used internally by Dina; not directly addressed by mirror-server.' },
            { name: 'DUMP',                  description: 'Dina Universal Message Protocol — the JSON envelope every Dina request and response uses.' },
            { name: 'Face descriptor',       description: '128-dimensional embedding computed in-browser by face-api. Used for intake matching; the raw image is not sent.' },
            { name: 'Glass morphism',        description: 'The visual style — translucent panels with blur, soft borders, layered shadows. Lives in styles/glass.css and friends.' },
            { name: 'Goal alignment',        description: 'A scalar measure in group analysis comparing the requester\'s goal text to other members\' goals.' },
            { name: 'Grace period',          description: 'Days after a failed payment during which the user keeps access. Configurable via PAYWALL_GRACE_PERIOD_DAYS.' },
            { name: 'Helpfulness',           description: 'TruthStream concept: peers upvote / downvote a review\'s usefulness. Feeds back into the reviewer\'s quality score.' },
            { name: 'IntakeGate',            description: 'The component at "/" that decides where to send a user based on auth state and intake completion.' },
            { name: 'JWT',                   description: 'JSON Web Token. Access tokens live 15 min; refresh tokens live 7 days. HS256.' },
            { name: 'MBTI',                  description: '16-type personality system. Inferred client-side from Big-5 scores; not asked directly.' },
            { name: 'Mirror module',         description: 'dina-server\'s src/modules/mirror — the published entry point for Mirror traffic.' },
            { name: 'MyMirror',              description: 'The personal truth-mirror report — a synthesis of intake, journal, group, and TruthStream signals.' },
            { name: 'Ollama',                description: 'The local LLM runtime used by dina-server.' },
            { name: 'Perception gap',        description: 'TruthStream metric — the delta between self-rating and aggregated peer rating.' },
            { name: 'PM2',                   description: 'Process manager used in production for both servers and the four mirror-server workers.' },
            { name: 'PWA',                   description: 'Progressive Web App. The Mirror client is installable, has offline fallbacks, and supports Web Push.' },
            { name: 'Rate limit',            description: 'Per-process in-memory window. Returns 429 on exceed.' },
            { name: 'Security level',        description: 'Server-side enum (PUBLIC / BASIC / VERIFIED / TIER2_ACCESS / TIER3_ACCESS / ADMIN). Enforced by requireSecurityLevel().' },
            { name: 'Subscription gate',     description: 'Middleware that returns 403 on tier mismatch and increments usage counters on tier match.' },
            { name: 'Trust level',           description: 'Dina\'s four-state caller reputation: new / trusted / suspicious / blocked.' },
            { name: 'TruthStream',           description: 'Anonymous peer-review feature — profile, queue, review, dialogue, analysis, milestones.' },
            { name: 'Truth card',            description: 'A user\'s public-facing profile in TruthStream. Sharing is opt-in per data type.' },
            { name: 'Usage tracking',        description: 'Durable per-user, per-feature counters in MySQL that back the free-tier quotas.' },
            { name: 'Visibility reporter',   description: 'A no-UI React component that tells the server when the user has the app foregrounded, so Web Push can be skipped.' },
            { name: 'Web Push',              description: 'Browser push notifications for offline users; used as fallback when the WebSocket isn\'t reachable.' },
            { name: 'Zen scene',             description: 'The per-page Three.js background (ZenGarden, ZenPond, ZenBridge, SakuraForest). Visual identity of the app.' },
          ]}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default Glossary;
