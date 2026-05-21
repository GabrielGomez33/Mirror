import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';

const DumpProtocol: React.FC = () => {
  return (
    <DevSection id="dump-protocol" title="DUMP protocol" eyebrow="Message format">
      <DevSubsection id="dump-overview" title="Overview">
        <p>
          DUMP — the Dina Universal Message Protocol — is the JSON envelope
          every request and response uses inside dina-server. It carries
          routing, security classification, payload, quality-of-service
          hints, and a tracing trail. Mirror-server only constructs it on
          the way in (via <code>DINALLMConnector</code>); the rest of the
          time Dina is the one packaging and unpackaging.
        </p>
        <DevCallout kind="info">
          Think of DUMP as the shipping manifest. The HTTP request is the
          truck; DUMP is what's on the clipboard inside it.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="dump-envelope" title="Envelope shape (DinaUniversalMessage)">
        <DevCodeBlock
          language="ts"
          caption="The full envelope"
          code={`
type DinaUniversalMessage = {
  // Identity
  id:        string;       // UUID v4
  timestamp: string;       // ISO 8601
  version:   string;       // protocol version, e.g. "2.0"

  // Routing
  source: {
    module:   'mirror' | 'api' | 'core' | 'llm' | 'database' | 'digim';
    instance?: string;     // host or process id
    version:   string;     // sending module version
  };
  target: {
    module:   'mirror' | 'api' | 'core' | 'llm' | 'database' | 'system' | 'digim';
    method:   string;      // e.g. 'mirror.synthesizeInsights'
    priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  };

  // Security
  security: {
    user_id?:    string;
    session_id?: string;
    clearance:   'public' | 'restricted' | 'confidential' | 'secret' | 'top_secret';
    sanitized:   boolean;
  };

  // Payload
  payload: {
    data:      unknown;
    context?:  unknown;
    metadata?: { size_bytes?: number; complexity_score?: number; user_count?: number };
  };

  // QoS
  qos: {
    delivery_mode: 'at_most_once' | 'at_least_once' | 'exactly_once';
    timeout_ms:    number;
    retry_count:   number;
    max_retries:   number;
    require_ack:   boolean;
    priority_boost?: boolean;
  };

  // Tracing
  trace: {
    created_at:             number;       // epoch ms
    route:                  string[];     // module hops
    request_chain:          string[];     // upstream request ids
    performance_target_ms:  number;
    queue_time_ms?:         number;
  };
};
          `}
        />
      </DevSubsection>

      <DevSubsection id="dump-response" title="Response shape (DinaResponse)">
        <DevCodeBlock
          language="ts"
          code={`
type DinaResponse = {
  request_id: string;       // echoes the originating envelope.id
  id:         string;       // unique response id
  timestamp:  string;
  status:     'success' | 'error' | 'processing' | 'queued';
  payload: {
    data:      unknown;
    metadata?: unknown;
  };
  error?: {
    code:     string;
    message:  string;
    details?: unknown;
  };
  metrics: {
    processing_time_ms: number;
    queue_time_ms?:     number;
    model_used?:        string;
    tokens_generated?:  number;
  };
};
          `}
        />
      </DevSubsection>

      <DevSubsection id="dump-qos" title="Quality of service & priority">
        <p>
          The four queues are bound to priority bands:{' '}
          <code>HIGH</code> = 7–10 (10ms tick),{' '}
          <code>MEDIUM</code> = 4–6 (50ms),{' '}
          <code>LOW</code> = 1–3 (200ms),{' '}
          <code>BATCH</code> = archived (1s). Interactive paths like @Dina
          chat live in HIGH; nightly aggregations land in BATCH.
        </p>
        <p>
          <code>delivery_mode</code> is the at-least-once / exactly-once
          contract; choose <code>exactly_once</code> only when the cost of
          double-processing is real (billing, irreversible side effects).
          Everything else should use <code>at_least_once</code>.
        </p>
      </DevSubsection>

      <DevSubsection id="dump-tracing" title="Tracing & performance fields">
        <p>
          <code>trace.route</code> accumulates a hop for every module the
          message passes through. <code>trace.request_chain</code> threads
          upstream request ids together so a single user action can be
          followed across modules without correlation queries.{' '}
          <code>trace.performance_target_ms</code> is the SLO; if the actual
          processing exceeds it, the orchestrator logs a warning with the
          full route for later analysis.
        </p>
      </DevSubsection>
    </DevSection>
  );
};

export default DumpProtocol;
