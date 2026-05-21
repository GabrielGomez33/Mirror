import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const MirrorServer: React.FC = () => {
  return (
    <DevSection id="mirror-server" title="Backend — mirror-server" eyebrow="Express service">
      <DevSubsection id="mirror-server-stack" title="Stack">
        <DevFieldList
          caption="Runtime dependencies"
          rows={[
            { name: 'express', type: '^5.1', description: 'HTTP framework. Uses native HTTPS with project-supplied TLS certs.' },
            { name: 'mysql2', type: '^3.14', description: 'MySQL driver with connection pool (30 connections, 60s idle, 10s connect timeout).' },
            { name: 'ioredis', type: '^5.3', description: 'Redis client — cache, pub/sub, queues, presence, drawing sync.' },
            { name: 'ws', type: '^8.14', description: 'Native WebSocket server (not Socket.IO in the runtime hot path).' },
            { name: 'jsonwebtoken', type: '^9.0', description: 'HS256 access + refresh tokens.' },
            { name: 'bcrypt', type: '^6.0', description: 'Password hashing (10 rounds).' },
            { name: 'helmet', type: '^8.1', description: 'HTTP security headers with strict CSP + HSTS + frame-ancestors none.' },
            { name: 'cors', type: '^2.8', description: 'Whitelist-based CORS (allow-list, never reflective).' },
            { name: 'multer', type: '^2.0', description: 'Multipart upload (intake voice blob, storage upload).' },
            { name: 'web-push', type: '^3.6', description: 'Web Push protocol for offline notification fallback.' },
            { name: 'uuid', type: '^14', description: 'v4 UUIDs for all surrogate ids.' },
            { name: 'cosine-similarity', type: '^1.0', description: 'Vector similarity used by the compatibility analyzer.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-bootstrap" title="Bootstrap sequence">
        <p>
          <code>index.ts</code> is ~36 KB of orchestration. Initialization is
          ordered because later phases depend on earlier ones:
        </p>
        <ol className="ml-6 list-decimal space-y-1 text-white/85">
          <li>Load and validate <code>.env</code> (required: <code>TUGRRPRIV</code>, <code>TUGRRCERT</code>, <code>TUGRRINTERCERT</code>, <code>MIRRORPORT</code>, <code>MIRRORSTORAGE</code>, <code>JWT_KEY</code>, <code>REDIS_PASSWORD</code>, <code>SYSTEM_MASTER_KEY</code>).</li>
          <li>Load <code>.payenv</code>; initialize paywall config, tier definitions, gates, free-limits.</li>
          <li>Express app + middleware: Helmet → CORS → JSON (100 KB) → URL-encoded (50 KB) → structured logger.</li>
          <li>Mount PayPal webhooks <strong>before</strong> auth — webhooks carry their own signature, not a JWT.</li>
          <li>Mount the 17 route groups (auth, user, storage, debug, intake, dashboard, journal, push, notification-preferences, groups, group-insights, group-votes, sessions, group-chat, truthstream, personal-analysis, subscription).</li>
          <li>Mount <code>GET /mirror/api/health</code>.</li>
          <li>Initialize MirrorGroups phases 0 → 5: Redis + notifications → encryption manager → analysis system → DINA connector → conversation intelligence + voting → chat message manager + WS.</li>
          <li>Wire WS broadcast to chat manager so workers can fan out messages.</li>
          <li>Connect to Dina over WSS (with retry) before opening the WS server, so workers have a path the moment they're enabled.</li>
          <li>Register paywall cron jobs (hourly, daily, weekly, 30-second email queue).</li>
          <li>Register SIGTERM/SIGINT handlers — 30-second graceful shutdown, phases torn down in reverse.</li>
          <li>Listen on <code>MIRRORPORT</code> over HTTPS.</li>
        </ol>
      </DevSubsection>

      <DevSubsection id="mirror-server-routes" title="Routes">
        <p>
          All routes are mounted under <code>/mirror/api</code>. The full
          catalog with HTTP methods is in the{' '}
          <a className="underline" href="#api-reference">API reference</a>.
          Here are the route files and their mount points:
        </p>
        <DevFieldList
          caption="routes/"
          rows={[
            { name: 'auth.ts', description: '/mirror/api/auth — register, login, verify, refresh, logout (current + all), send-verification, verify-email, verification-status, forgot-password, reset-password (validate + apply).' },
            { name: 'user.ts', description: '/mirror/api/user — search, export (GDPR), update-password, update-email, delete. Subscription-gated where applicable.' },
            { name: 'intake.ts', description: '/mirror/api/intake — store, retrieve, list, latest.' },
            { name: 'journal.ts', description: '/mirror/api/journal — entry CRUD (10/5min limit), entry by date, list, search, premium mood-trend analytics.' },
            { name: 'storage.ts', description: '/mirror/api/storage — upload, download, delete, list. Multer.' },
            { name: 'dashboard.ts', description: '/mirror/api/dashboard — summary + stats.' },
            { name: 'push.ts', description: '/mirror/api/push — subscribe, unsubscribe, send (admin).' },
            { name: 'notificationPreferences.ts', description: '/mirror/api/user/notification-preferences — get, put, mark-read.' },
            { name: 'groups.ts', description: '/mirror/api/groups — create (premium), CRUD, invite/accept, members, request-join, approve/reject, directory.' },
            { name: 'groupChat.ts', description: '/mirror/api/groups/:groupId/chat — message CRUD, reactions, typing, presence, read receipts, search.' },
            { name: 'groupInsights.ts', description: '/mirror/api/groups/:groupId — generate-insights (premium), insights, history, compatibility, strengths, conflicts.' },
            { name: 'groupVotes.ts', description: '/mirror/api/groups/:groupId/votes — create, get, cast, close.' },
            { name: 'sessionInsights.ts', description: '/mirror/api/groups/:groupId/sessions — get + trigger session-level analysis.' },
            { name: 'truthstream.ts', description: '/mirror/api/truthstream — profile, queue, reviews (received/given/helpful/flag), dialogue, analysis, stats, milestones, questionnaire, feedback-request.' },
            { name: 'personalAnalysis.ts', description: '/mirror/api/personal-analysis — generate (1/week free), get, history.' },
            { name: 'subscriptionRoutes.ts', description: '/mirror/api/subscription — status, plans, create, approve, cancel, reactivate.' },
            { name: 'debug.ts', description: '/mirror/api/debug — admin-only diagnostics.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-controllers" title="Controllers">
        <p>
          One controller per major resource. Controllers do request
          validation, call services/managers, and shape responses.
        </p>
        <DevFieldList
          caption="controllers/"
          rows={[
            { name: 'authController.ts', description: 'TokenManager + SecurityMonitor + register/login/verify/refresh/logout. Returns emailVerified and subscriptionStatus in /verify so the client can hydrate without a second round-trip.' },
            { name: 'userController.ts', description: 'searchUsersHandler, updateUserPasswordHandler, updateUserEmailHandler, deleteUserHandler. Cascades on delete.' },
            { name: 'groupController.ts', description: 'Full lifecycle: create, list, details, update, delete, invite, accept, remove, search directory, request-to-join + approve/reject.' },
            { name: 'chatController.ts', description: 'Message send/get/edit/delete, reactions, typing, read receipts, search. Wraps ChatMessageManager.' },
            { name: 'truthstreamController.ts', description: '23 handler functions across profile, queue, reviews, dialogue, analysis, stats, milestones, questionnaire, feedback-requests.' },
            { name: 'intakeController.ts', description: 'storeIntake / retrieve / list / latest. Latest is hot path — the IntakeGate hits it on every root navigation.' },
            { name: 'journalController.ts', description: 'CRUD + search + mood trend. Usage counter increment is here, not in the gate, because the gate counts before write.' },
            { name: 'storageController.ts', description: 'Multer upload, byte-range download, soft-delete with 30-day retention.' },
            { name: 'encryptionController.ts', description: 'encryptMessage / decryptMessage / deriveGroupKey / rotateGroupKeys. Pure utility — no routes.' },
            { name: 'emailVerificationController.ts', description: 'Token generate / consume / status. 24h TTL.' },
            { name: 'passwordResetController.ts', description: 'Token generate (rate-limited, generic response) / validate / consume. 60-minute TTL. All sessions revoked on successful reset.' },
            { name: 'directoryController.ts', description: 'Public-tier directory writes. Used by groups on type=public.' },
            { name: 'exportController.ts', description: 'GDPR ZIP export of every record tied to a user.' },
            { name: 'debugController.ts', description: 'Admin diagnostics.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-services" title="Services">
        <DevFieldList
          caption="services/"
          rows={[
            { name: 'DinaWebSocketClient.ts', description: 'Shared WS client to dina-server. Auto-reconnect with exponential backoff, request/response correlation via requestId, streaming with chunk callbacks, heartbeat every 25s, 30s default timeout.' },
            { name: 'emailService.ts', description: 'Provider-agnostic (Resend, Brevo). Templated emails (welcome, verify, reset, payment confirmed/failed, trial ending, subscription cancelled). Queue + retry with exponential backoff.' },
            { name: 'pushService.ts', description: 'Web Push to all of a user\'s registered devices.' },
            { name: 'pushNotificationDispatcher.ts', description: 'Online → WS, offline → Push. Decides per recipient.' },
            { name: 'notificationEmailFallback.ts', description: 'Daily digest for users without push subscribed.' },
            { name: 'notificationPreferences.ts', description: 'Per-type channel selection (email/push/in-app) and global mute.' },
            { name: 'GroupDataExtractor.ts', description: 'Intake → analysis-ready blob. Respects each user\'s shared_data_types so analyzers never see fields the user didn\'t share.' },
            { name: 'TruthStreamQueueManager.ts', description: 'Fair FIFO with anti-self / anti-duplicate guards.' },
            { name: 'TruthStreamReviewScorer.ts', description: 'Helpfulness, perception gap, trends.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-managers" title="Managers">
        <DevFieldList
          caption="managers/"
          rows={[
            { name: 'ChatMessageManager.ts', description: <>Encrypt / decrypt, cursor pagination (default 50, max 100), reactions + read receipts, threads + edits, full-text search, ephemeral typing (5s TTL in Redis), pin/unpin. The chat router is a thin wrapper around this.</> },
            { name: 'GroupInsightManager.ts', description: 'Orchestrates the four analyzers, caches in Redis (1-hour TTL), enriches with chat history before LLM synthesis.' },
            { name: 'PublicAssessmentAggregator.ts', description: 'Trending + rating aggregation for the public groups directory.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-middleware" title="Middleware">
        <DevFieldList
          caption="middleware/"
          rows={[
            { name: 'authMiddleware.ts', description: <><code>verifyToken</code> (401 on failure, hydrates <code>req.user</code>), <code>verifyRefreshToken</code>, <code>requireSecurityLevel(level)</code> (RBAC), <code>subscriptionGate</code> (403 on tier mismatch, increments usage counters on the way through), <code>rateLimit(count, windowMs)</code> (in-memory; 429 on exceed).</> },
            { name: 'groupAuth.ts', description: <><code>requireGroupMember</code>, <code>requireGroupAdmin</code>, <code>requireGroupOwner</code> — group-scoped RBAC layered on top of the global one.</> },
          ]}
        />
        <DevCallout kind="info" title="The middleware order matters">
          On a protected, gated route:{' '}
          <code>verifyToken</code> → <code>subscriptionGate</code> →{' '}
          <code>rateLimit</code> → handler. The gate runs <em>after</em>{' '}
          token verification so it can see the user and{' '}
          <em>before</em> the rate limiter so a user can't exhaust their
          rate budget on a request they don't have access to anyway.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="mirror-server-wss" title="WebSocket layer">
        <p>
          Two endpoints, both authenticated by JWT in the query string at
          upgrade time, both with native ping/pong liveness (30s ping, 10s
          pong timeout) and Redis pub/sub fan-out.
        </p>
        <DevFieldList
          caption="wss/"
          rows={[
            { name: 'setupWSS.ts', description: 'The setup: validates JWT on connect, updates last_active, registers connection for heartbeat, exposes isUserOnline / getConnectedUserIds for the rest of the server.' },
            { name: 'chatWSHandler.ts', description: 'Group chat: message / typing / presence / reaction / read / mention. End-to-end encrypted at rest; the WSS broadcasts the ciphertext envelope.' },
            { name: 'groupSignaling.ts', description: 'WebRTC offer / answer / ICE relay for group video and audio.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-workers" title="PM2 workers and queues">
        <p>
          Long-running work runs in separate processes managed by PM2 so the
          main HTTP server is never blocked by a slow LLM call. Each worker
          polls a queue, holds a circuit breaker (5 failures = open, 60s
          reset), and retries with backoff <code>30s → 2m → 10m → 1h → 4h</code>{' '}
          with jitter.
        </p>
        <DevFieldList
          caption="workers/"
          rows={[
            { name: 'DinaChatQueueProcessor.ts', description: 'Streams @Dina chat responses via WS. Sliding-window per-user rate limiter, input sanitization (null bytes, length caps), structured logging, health monitoring. ~66 KB.' },
            { name: 'TruthStreamQueueProcessor.ts', description: 'Two job types — classify_review and generate_analysis. Health endpoint on :7777 when run standalone. ~48 KB.' },
            { name: 'AnalysisQueueProcessor.ts', description: 'Group analysis: orchestrates Compatibility → Strengths → Conflict → LLM synthesis. Caches result in Redis for 1 hour.' },
            { name: 'PersonalAnalysisQueueProcessor.ts', description: 'MyMirror: aggregates intake + journal + group + TruthStream into a narrative report. 1/week free, unlimited premium.' },
            { name: 'ProcessorOrchestrator.ts', description: 'A single coordinator that can manage all queues from one process (alt to running each separately).' },
            { name: 'DinaChatWorker.ts', description: 'Simpler non-streaming worker, kept as an alternative path.' },
          ]}
        />
        <DevCodeBlock
          language="bash"
          caption="Standalone worker run (useful for local debugging)"
          code={`
npx ts-node workers/DinaChatQueueProcessor.ts
npx ts-node workers/TruthStreamQueueProcessor.ts
npx ts-node workers/AnalysisQueueProcessor.ts
npx ts-node workers/PersonalAnalysisQueueProcessor.ts
          `}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-analyzers" title="Analyzers">
        <DevFieldList
          caption="analyzers/"
          rows={[
            { name: 'GroupAnalyzer.ts', description: <>Master. Fetches members + shared data, runs the three sub-analyzers, calls <code>DINALLMConnector.synthesizeInsights()</code> for narrative, caches, writes to <code>group_insights</code>. ~37 KB.</> },
            { name: 'CompatibilityCalculator.ts', description: 'Pairwise compatibility — cosine similarity of personality vectors, communication-style match, value alignment, conflict-style fit. 0–100 per pair + average + confidence.' },
            { name: 'CollectiveStrengthDetector.ts', description: 'Detects complementary skill combinations and unique group capabilities; potency 0–100.' },
            { name: 'ConflictRiskPredictor.ts', description: 'Predicts conflict types with risk score + recommended intervention. Detects style mismatches, value clashes, power imbalances.' },
            { name: 'ConversationAnalyzer.ts', description: 'Sentiment, topic extraction, participation balance (Gini), conversation health, momentum. Drives the periodic insights feed.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="mirror-server-paywall" title="Paywall (PayPal + tiers)">
        <p>
          The paywall is self-contained under <code>paywall/</code>: config
          parsing (<code>paywall.config.ts</code> loads <code>.payenv</code>),
          a PayPal provider, a subscription service, three middlewares
          (global gate, per-route gate, usage limiter), webhooks, and types.
          See the <a className="underline" href="#paywall">Paywall</a>{' '}
          section for the state machine and flows.
        </p>
      </DevSubsection>

      <DevSubsection id="mirror-server-database" title="Database schema">
        <p>
          MySQL 8 with utf8mb4. Connection pool is configured in{' '}
          <code>db.ts</code>. Migration files live under{' '}
          <code>migrations/</code>. Here are the tables by domain:
        </p>
        <DevFieldList
          caption="Core"
          rows={[
            { name: 'users', description: 'id, email, username, password_hash, email_verified, created_at, updated_at, last_active.' },
            { name: 'user_sessions', description: 'id, user_id, session_id, user_agent, ip_address, device_fingerprint, expires_at.' },
            { name: 'intake_data', description: 'id, user_id, data (JSON), created_at, updated_at.' },
            { name: 'journal_entries', description: 'id, user_id, date, content, mood_score, tags (JSON), timestamps.' },
            { name: 'files', description: 'id, user_id, original_name, stored_path, size, mime_type, created_at, deleted_at (soft delete).' },
          ]}
        />
        <DevFieldList
          caption="MirrorGroups"
          rows={[
            { name: 'groups', description: 'Identity + type/subtype/goal/privacy + encryption_key_id + shared_data_types (JSON) + status + max_members.' },
            { name: 'group_members', description: 'group_id × user_id, role (owner / admin / member), shared_data_types (JSON), per-member wrapped encryption_key.' },
            { name: 'group_invitations / join_requests', description: 'Token-based invites + workflow for public groups (pending / approved / rejected).' },
            { name: 'group_insights', description: 'id, group_id, analysis_id, type (compatibility / strengths / conflicts / llm), data (JSON), confidence, generated_at, expires_at.' },
            { name: 'analysis_queue', description: 'Worker queue with status, priority, retry_count, next_retry_at, input_data (JSON).' },
            { name: 'group_chat_messages', description: 'Sender, parent_message_id (threads), encrypted content, content_type, metadata (JSON), edited_at, deleted_at.' },
            { name: 'message_reactions / message_read_receipts', description: 'Per-message, per-user.' },
          ]}
        />
        <DevFieldList
          caption="TruthStream"
          rows={[
            { name: 'truth_stream_profiles', description: 'Goal + goal_category + shared_data_types + counters (reviews received/given, quality, perception gap).' },
            { name: 'truth_stream_reviews', description: 'reviewer_id, reviewee_id, goal_category, responses (JSON), tone_classification, is_helpful (nullable), dialogue_enabled.' },
            { name: 'truth_stream_dialogue', description: 'Threaded conversation per review.' },
            { name: 'truth_stream_analysis', description: 'Perception-gap score + analysis_data (JSON), generated_at.' },
            { name: 'truth_stream_questionnaires', description: 'Versioned questionnaires per goal_category.' },
            { name: 'truth_stream_queue', description: 'pending / reviewing / completed + locked_until.' },
            { name: 'truth_stream_feedback_requests', description: 'Targeted feedback requests with responses.' },
          ]}
        />
        <DevFieldList
          caption="Paywall + auth-adjacent"
          rows={[
            { name: 'user_subscriptions', description: 'tier, status, provider, provider_subscription_id, provider_plan_id, trial_start/end, current_period_*, grace_period_end, cancelled_at, cancel_reason.' },
            { name: 'subscription_events', description: 'Immutable audit log. provider_event_id unique constraint = webhook idempotency.' },
            { name: 'usage_tracking', description: 'feature_key, period_type, period_start, count, limit_value.' },
            { name: 'email_verification_tokens', description: 'token, expires_at (24h), used_at.' },
            { name: 'password_reset_tokens', description: 'token, expires_at (60min), used_at. One-shot use.' },
            { name: 'notification_preferences', description: 'Per-user per-type email/push/in-app flags.' },
          ]}
        />
        <DevCallout kind="success" title="No raw SQL strings flow from input">
          Every query is a prepared statement with placeholders (
          <code>?</code>). User-supplied identifiers (groupId, messageId)
          are validated as UUIDs before they reach the database call.
        </DevCallout>
      </DevSubsection>
    </DevSection>
  );
};

export default MirrorServer;
