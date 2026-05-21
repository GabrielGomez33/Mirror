import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';
import DevEndpointTable from '../DevEndpointTable';

const DinaServer: React.FC = () => {
  return (
    <DevSection id="dina-server" title="Backend — dina-server" eyebrow="Intelligence service">
      <DevSubsection id="dina-server-stack" title="Stack">
        <DevFieldList
          caption="Runtime dependencies"
          rows={[
            { name: 'express', type: '^4.18', description: 'HTTP framework. HTTPS listener on port 8445 by default (DINA_PORT).' },
            { name: 'ws', type: '^8.18', description: 'WebSocket server at /dina/ws. 16 MB max payload, per-message-deflate enabled.' },
            { name: 'mysql2', type: '^3.14', description: 'Connection pool to the shared MySQL. dina_* tables.' },
            { name: 'ioredis + redis + redis-om', type: '^5 / ^5 / 0.4', description: 'Smart cache, four-priority queue, pub/sub, optional vector storage.' },
            { name: 'node-fetch', type: '^2.6', description: 'HTTP client for Ollama (/api/generate, /api/embeddings, /api/tags).' },
            { name: 'jsonwebtoken + bcryptjs', type: '^9 / ^2.4', description: 'Auth.' },
            { name: 'helmet', type: '^7.2', description: 'HTTP security headers.' },
            { name: 'winston + morgan', type: '^3 / ^1.10', description: 'Structured logging.' },
            { name: 'uuid', type: '^14', description: 'Request and message IDs.' },
          ]}
        />
        <DevCallout kind="info" title="No Anthropic / OpenAI SDK">
          Dina uses Ollama only — local model runner over HTTP. The model
          catalog covers a fast small model (qwen2.5:3b), a balanced one
          (mistral:7b), a code-specialized one (codellama:34b), a heavyweight
          (llama2:70b), and an embedding model (mxbai-embed-large).
          <code className="ml-1">keep_alive: 24h</code> avoids cold loads
          between requests.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="dina-server-bootstrap" title="Bootstrap and DinaCore">
        <p>
          <code>src/index.ts</code> wraps a singleton <code>DinaServer</code>{' '}
          class. <code>DinaCore</code> (under <code>src/core/orchestrator/</code>){' '}
          is the central router that owns module initialization order and
          the four-priority queue processor.
        </p>
        <ol className="ml-6 list-decimal space-y-1 text-white/85">
          <li>Validate SSL certificates from <code>TUGRRPRIV</code> / <code>TUGRRCERT</code> / <code>TUGRRINTERCERT</code>.</li>
          <li>Construct Express, apply middleware, set 10 MB body limit (for Mirror submissions).</li>
          <li>DinaCore initializes modules in order: Database → LLM → DIGIM → Mirror.</li>
          <li>HTTPS listen on <code>DINA_PORT</code> (default 8445).</li>
          <li>Attach WebSocket server at <code>/dina/ws</code>.</li>
          <li>Spin up four queue processors at 10ms / 50ms / 200ms / 1000ms intervals (HIGH / MEDIUM / LOW / BATCH).</li>
          <li>SIGINT/SIGTERM trigger graceful shutdown with active-process drain.</li>
        </ol>
      </DevSubsection>

      <DevSubsection id="dina-server-mirror-module" title="The Mirror module (entry point)">
        <DevCallout kind="security" title="This is the boundary">
          <code>src/modules/mirror</code> is the <em>only</em> module in
          dina-server that mirror-server is allowed to reach. Any new Mirror
          feature that requires Dina goes through here. New endpoints get
          added <em>inside</em> this module, not on the LLM module, not on
          DIGIM, not on the orchestrator directly.
        </DevCallout>
        <p>
          The module is a singleton (<code>MirrorModule</code>) composed of
          eight sub-components. Each sub-component owns one concern. The
          module has its own private <code>DinaLLMManager</code> instance
          — it does <strong>not</strong> share the orchestrator's, so a
          Mirror-driven LLM call can never starve other Dina traffic and
          vice versa.
        </p>
        <DevFieldList
          caption="src/modules/mirror — sub-components"
          rows={[
            { name: 'MirrorDataProcessor', description: 'Validates a raw Mirror submission and turns it into ProcessedMirrorData (normalized internal format).' },
            { name: 'MirrorContextManager', description: 'Tracks behavioral patterns, preferences, temporal cycles, cross-modal correlations per user over time.' },
            { name: 'MirrorStorageManager', description: 'Writes processed submissions, insights, patterns, correlations, audit trail. Handles GC of old data.' },
            { name: 'MirrorInsightGenerator', description: 'Rule-based (NO LLM) immediate insights post-submission — pattern detection, cross-modal correlation, follow-up question seeds.' },
            { name: 'MirrorNotificationSystem', description: 'Per-user notifications for insights, patterns, follow-ups. Email / SMS / push integration hooks.' },
            { name: 'InsightSynthesizer', description: 'Primary entry point for mirror-server LLM requests. Converts InsightSynthesisRequest → LLM prompt → response (group / conversation / post-session).' },
            { name: 'TruthStreamSynthesizer', description: 'Handles TruthStream classify-review and generate-analysis. Long timeout (240s) tolerates Ollama cold starts.' },
            { name: 'PersonalAnalysisSynthesizer', description: 'Builds the MyMirror personal report from intake + journal + group + TruthStream.' },
          ]}
        />
        <DevFieldList
          caption="MirrorModule — public method surface"
          rows={[
            { name: 'processSubmission(DinaUniversalMessage)', description: 'Process facial / personality / IQ / astrology data → ProcessedMirrorData + immediate insights.' },
            { name: 'synthesizeInsights(InsightSynthesisRequest)', description: 'LLM synthesis for mirror-server — group_analysis | conversation_analysis | post_session_summary.' },
            { name: 'handleTruthStreamClassifyReview(req)', description: 'LLM-based review classification with confidence scores.' },
            { name: 'handleTruthStreamGenerateAnalysis(req)', description: 'Full Truth Mirror Report synthesis.' },
            { name: 'handleTruthStreamValidateTruthCard(req)', description: 'Structural validation of a truth card.' },
            { name: 'handleTruthStreamScoreReviewQuality(req)', description: 'Quality score 0–100.' },
            { name: 'handleTruthStreamAssessHostility(req)', description: 'Hostility pattern assessment from aggregate review data.' },
            { name: 'handlePersonalAnalysis(req)', description: 'Generate personal analysis from intake + journal.' },
            { name: 'healthCheck()', description: 'Component-level health snapshot (status, uptime, error rate).' },
            { name: 'getPerformanceMetrics()', description: 'Per-operation timing history.' },
            { name: 'shutdown()', description: 'Drains active processes, then resolves.' },
          ]}
        />
        <DevFieldList
          caption="Routes registered by the Mirror module (Dina-side)"
          rows={[
            { name: 'truthStreamRoutes.ts', description: <>Mounts POST <code>/mirror/truthstream/classify-review</code>, <code>/generate-analysis</code>, <code>/validate-truth-card</code>, <code>/score-review-quality</code>, <code>/assess-hostility-pattern</code> and GET <code>/health</code>.</> },
            { name: 'personalAnalysisRoutes.ts', description: <>POST <code>/mirror/personal-analysis/generate</code>.</> },
            { name: 'groupRoutes.ts', description: 'Group management metadata endpoints used by Dina internally; compatibility analysis routes.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="dina-server-llm" title="LLM module (Ollama)">
        <p>
          <code>src/modules/llm/manager.ts</code> wraps the Ollama HTTP API.
          The manager handles model lifecycle, streaming, and a Redis-backed
          cache keyed by <code>{`llm:{method}:{userId}:{query}`}</code>.
        </p>
        <DevFieldList
          caption="Public methods"
          rows={[
            { name: 'generate(query, options)', description: 'Text generation with optional system prompt. NDJSON response is parsed and concatenated until done:true.' },
            { name: 'embed(text, options)', description: 'mxbai-embed-large embeddings.' },
            { name: 'generateCode(req, options)', description: 'codellama path for code generation/review.' },
            { name: 'analyze(query, options)', description: 'Analytical queries against the heavier models.' },
            { name: 'listModels()', description: 'Enumerate available Ollama models.' },
            { name: 'warmupModels() / unloadUnusedModels()', description: 'Memory management.' },
          ]}
        />
        <DevCodeBlock
          language="json"
          caption="Ollama /api/generate request envelope"
          code={`
{
  "model": "mistral:7b",
  "prompt": "...",
  "system": "...",
  "stream": false,
  "options": { "num_predict": 1000, "temperature": 0.7 },
  "keep_alive": "24h"
}
          `}
        />
      </DevSubsection>

      <DevSubsection id="dina-server-digim" title="DIGIM intelligence">
        <p>
          <code>src/modules/digim</code> is Dina's intelligence-gathering
          module — multi-source aggregation, natural-language query
          processing. Used internally for richer context; not addressed
          directly by mirror-server. Reachable via the orchestrator from
          other Dina-internal callers.
        </p>
      </DevSubsection>

      <DevSubsection id="dina-server-api" title="API routes">
        <p>
          Public surface is mounted at <code>/dina/api/v1</code> (see{' '}
          <code>src/api/routes/index.ts</code>). The endpoints mirror-server
          uses are all under <code>/mirror/*</code>.
        </p>
        <DevEndpointTable
          caption="Endpoints used by mirror-server"
          rows={[
            { method: 'POST', path: '/dina/api/v1/mirror/synthesize-insights', description: 'Group / conversation / post-session LLM synthesis.', access: 'Service or JWT', notes: '300s timeout' },
            { method: 'POST', path: '/dina/api/v1/mirror/truthstream/classify-review', description: 'Tone + helpfulness classification.', access: 'Service or JWT', notes: '300s timeout' },
            { method: 'POST', path: '/dina/api/v1/mirror/truthstream/generate-analysis', description: 'Truth Mirror Report synthesis.', access: 'Service or JWT', notes: '300s timeout' },
            { method: 'POST', path: '/dina/api/v1/mirror/truthstream/validate-truth-card', description: 'Structural validation (non-LLM).', access: 'Service or JWT' },
            { method: 'POST', path: '/dina/api/v1/mirror/truthstream/score-review-quality', description: 'Quality score 0–100 (non-LLM).', access: 'Service or JWT' },
            { method: 'POST', path: '/dina/api/v1/mirror/truthstream/assess-hostility-pattern', description: 'Aggregate hostility pattern.', access: 'Service or JWT' },
            { method: 'POST', path: '/dina/api/v1/mirror/personal-analysis/generate', description: 'MyMirror personal report.', access: 'Service or JWT', notes: '300s timeout' },
            { method: 'GET',  path: '/dina/api/v1/mirror/truthstream/health', description: 'Liveness for the truthstream sub-module.', access: 'Public' },
            { method: 'POST', path: '/dina/api/v1/mirror/submit', description: 'Submit Mirror intake data for processing.', access: 'JWT' },
            { method: 'GET',  path: '/dina/api/v1/health', description: 'Overall Dina liveness.', access: 'Public' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="dina-server-database" title="Database & Redis">
        <p>
          Dina has its own MySQL connection pool managed by{' '}
          <code>DatabaseManager</code>. The application-domain tables are
          prefixed <code>dina_*</code> to avoid colliding with mirror-server's
          tables in the shared database:
        </p>
        <DevFieldList
          rows={[
            { name: 'dina_users', description: 'Internal user identity (dina_key), device fingerprint, IP, MAC, user-agent, trust_level (new / trusted / suspicious / blocked), suspicion_score, rate / token limits, allowed_models, allowed_endpoints.' },
            { name: 'dina_auth_requests', description: 'Full audit trail of every API call: method, endpoint, payload_hash, IP, MAC, user-agent, headers, signature.' },
            { name: 'dina_system_logs', description: 'Structured info/warn/error/critical logs with module + metadata.' },
            { name: 'dina_user_submissions', description: 'Raw + processed submission JSON, immediate insights array.' },
            { name: 'dina_insights', description: 'Generated insights with confidence + category.' },
            { name: 'dina_patterns', description: 'Detected behavior / emotional / temporal / modal patterns.' },
          ]}
        />
        <DevFieldList
          caption="Redis layout"
          rows={[
            { name: 'dina:queue:high|medium|low|batch', description: 'Four priority queues. Processors poll at 10/50/200/1000 ms.' },
            { name: 'dina:response:{instanceId}', description: 'Per-connection response channel. The WSS subscribes here per connection and forwards to the socket.' },
            { name: 'cache:{key}', description: 'General cache. 3600s default TTL.' },
            { name: 'llm:{method}:{userId}:{query}', description: 'LLM response cache.' },
            { name: 'context:{userId}:{conversationId}', description: 'Conversation context. 7200s TTL.' },
            { name: 'embedding:{id}', description: 'Vector storage. Supports gzip-compressed backups to disk.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="dina-server-wss" title="WebSocket layer">
        <p>
          <code>src/config/wss/index.ts</code> hosts <code>DinaWebSocketManager</code>.
          Each client connection is assigned a UUID and a Redis subscription
          to <code>dina:response:{`{connectionId}`}</code>. If Redis is
          unavailable, the manager falls back to an in-memory buffer
          (degraded mode) so workers can still complete.
        </p>
        <DevCodeBlock
          language="ascii"
          caption="Message flow"
          noLineNumbers
          code={`
Client (mirror-server worker) ──► WSS /dina/ws
                                     │ enqueue
                                     ▼
                              Redis: dina:queue:{priority}
                                     │
                                     ▼ processed by DinaCore.handleIncomingMessage()
                              Mirror module / LLM / DIGIM / …
                                     │
                                     ▼ publish
                              Redis: dina:response:{connectionId}
                                     │
                                     ▼
                              WSS forwards to client socket
          `}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default DinaServer;
