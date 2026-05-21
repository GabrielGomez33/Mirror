import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Integration: React.FC = () => {
  return (
    <DevSection id="integration" title="Mirror ↔ Dina integration" eyebrow="Cross-service">
      <DevSubsection id="integration-boundary" title="The boundary rule">
        <DevCallout kind="security" title="One door, one connector">
          mirror-server reaches dina-server through{' '}
          <code>mirror-server/integrations/DINALLMConnector.ts</code> only.
          The connector targets paths under <code>/mirror/*</code> on Dina,
          which are served by Dina's <code>src/modules/mirror</code>. New
          features must extend this surface — they may not introduce new
          callers of dina-server elsewhere in mirror-server.
        </DevCallout>
        <p>This is enforced by code review and the doc you are reading. There are three reasons:</p>
        <ol className="ml-6 list-decimal space-y-1 text-white/85">
          <li>
            <strong>Auditability.</strong> One file holds the contract. A
            grep for that file finds every cross-service call.
          </li>
          <li>
            <strong>Isolation.</strong> The Mirror module has its own
            LLMManager. A burst of Mirror traffic can't starve the rest of
            Dina.
          </li>
          <li>
            <strong>Future-proofing.</strong> If Dina ever moves to a
            different runtime (e.g. trades Ollama for hosted), only the
            Mirror module's internals change — the mirror-server
            contract is stable.
          </li>
        </ol>
      </DevSubsection>

      <DevSubsection id="integration-connector" title="DINALLMConnector">
        <p>
          The connector exposes a small set of methods that mirror-server's
          workers and analyzers call. Internally it formats a DUMP envelope,
          POSTs over HTTPS (or streams over WSS for chat), tracks
          per-method circuit-breaker state, and falls back to a stub when{' '}
          <code>USE_DINA_STUB=true</code> for local development.
        </p>
        <DevFieldList
          caption="Public surface"
          rows={[
            { name: 'synthesizeInsights(req)', description: 'POST /mirror/synthesize-insights. Returns grouped insights, key findings, recommendations.' },
            { name: 'classifyReview(req)', description: 'POST /mirror/truthstream/classify-review.' },
            { name: 'generateAnalysis(req)', description: 'POST /mirror/truthstream/generate-analysis.' },
            { name: 'generatePersonalAnalysis(req)', description: 'POST /mirror/personal-analysis/generate.' },
            { name: 'streamChat(req, onChunk)', description: 'WSS-based streaming for @Dina chat. The callback receives partial response chunks; the WS client correlates by requestId.' },
            { name: 'initialize() / shutdown()', description: 'Lifecycle hooks called by mirror-server bootstrap.' },
            { name: 'isAvailable()', description: 'Returns false if the circuit breaker is open.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="integration-endpoints" title="Dina endpoints used by mirror-server">
        <p>
          All of the endpoints called by mirror-server are listed in the{' '}
          <a className="underline" href="#dina-server-api">dina-server API routes</a>{' '}
          section. The complete A–Z surface is in the{' '}
          <a className="underline" href="#api-reference-dina">API reference — Dina (v1)</a>{' '}
          subsection.
        </p>
      </DevSubsection>

      <DevSubsection id="integration-circuit-breaker" title="Circuit breaker & retries">
        <p>
          The connector tracks failures per method. Five consecutive failures
          opens the breaker for 60 seconds; during that window calls fail
          fast (<code>isAvailable() === false</code>) and workers re-enqueue
          jobs with the standard backoff schedule. After the 60-second
          window, the breaker enters half-open and lets a single probe call
          through; on success it closes, on failure it re-opens.
        </p>
        <DevCodeBlock
          language="ts"
          caption="Backoff schedule shared by every Mirror worker"
          code={`
const RETRY_DELAYS_MS = [
  30_000,        // 30 seconds
  120_000,       //  2 minutes
  600_000,       // 10 minutes
  3_600_000,     //  1 hour
  14_400_000,    //  4 hours
];

// Each retry adds ±10% jitter to avoid thundering-herd on recovery.
const jittered = (ms: number) => ms * (0.9 + Math.random() * 0.2);
          `}
        />
        <DevCallout kind="info" title="Why a five-step ladder">
          Five steps cover transient Ollama loads (the first two), short
          dina-server restarts (steps three and four), and long outages
          (the four-hour bucket) without overwhelming the worker
          schedulers or the queues' Redis memory budget.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="integration-streaming" title="Streaming chat (@Dina)">
        <p>
          When a group chat message tags <code>@Dina</code>, the chat
          controller enqueues a job in <code>dina_chat_queue</code>. The
          <code>DinaChatQueueProcessor</code> opens a streaming WS request,
          forwards chunks back to the group via Redis pub/sub, and stores
          the final, encrypted message in <code>group_chat_messages</code>.
          The chat UI listens for <code>dina_processing</code> and{' '}
          <code>dina_message</code> events on the chat WebSocket and renders
          the partial response progressively.
        </p>
      </DevSubsection>
    </DevSection>
  );
};

export default Integration;
