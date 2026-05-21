import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Architecture: React.FC = () => {
  return (
    <DevSection id="architecture" title="Architecture" eyebrow="System view">
      <DevSubsection id="architecture-topology" title="Topology">
        <p>
          Three processes (plus their workers), one shared MySQL, one shared
          Redis, one TLS endpoint. The Mirror client is a static SPA served
          from the same origin as <code>mirror-server</code>, which proxies
          to <code>dina-server</code> over the private network.
        </p>
        <DevCodeBlock
          language="ascii"
          caption="Logical topology"
          noLineNumbers
          code={`
          ┌──────────────────────────────────────────────────────────────┐
          │                       Browser (PWA)                          │
          │   Mirror client — React 19, Vite, Workbox service worker     │
          └─────────────────┬───────────────────────────────┬────────────┘
                            │ HTTPS                         │ WSS
                            │ /mirror/api/*                 │ /mirror/groups/{ws,chat}
                            ▼                               ▼
          ┌──────────────────────────────────────────────────────────────┐
          │   mirror-server  (Express, port 8444, TLS)                   │
          │   ├─ routes/        ├─ controllers/   ├─ services/           │
          │   ├─ managers/      ├─ middleware/    ├─ wss/                │
          │   ├─ analyzers/     ├─ paywall/       ├─ workers/ (PM2 × 4)  │
          │   └─ integrations/DINALLMConnector.ts  ◀── the only door     │
          └──────┬───────────────────────────────────┬───────────────────┘
                 │ MySQL pool (30)                   │ HTTPS + WSS
                 │ Redis (cache, queues, pub/sub)    │ JWT or X-Service-Key
                 ▼                                   ▼
          ┌─────────────────────────┐    ┌────────────────────────────────┐
          │  MySQL 8 / Redis        │    │ dina-server (Express, :8445)   │
          │  shared application     │    │ DinaCore ─┬─ src/modules/mirror│
          │  store                  │    │           ├─ src/modules/llm   │
          └─────────────────────────┘    │           ├─ src/modules/digim │
                                         │           └─ Ollama (local)    │
                                         └────────────────────────────────┘
          `}
        />
      </DevSubsection>

      <DevSubsection id="architecture-request-paths" title="Request paths">
        <p>Three canonical paths cover ~95% of traffic:</p>
        <ol className="ml-6 list-decimal space-y-2 text-white/85">
          <li>
            <strong>Pure CRUD</strong> — Browser hits <code>mirror-server</code>,
            which reads/writes MySQL and returns. Examples: login, journal
            entries, intake storage, group membership.
          </li>
          <li>
            <strong>Real-time fan-out</strong> — Browser opens WSS to{' '}
            <code>mirror-server/wss</code>. mirror-server writes the event to
            MySQL, pushes it to other connected members through the same WSS
            server, and falls back to Web Push for offline members.
          </li>
          <li>
            <strong>LLM synthesis</strong> — Browser asks mirror-server for an
            analysis. mirror-server enqueues a job, the worker calls{' '}
            <code>DINALLMConnector.synthesizeInsights()</code>, which crosses
            the boundary to Dina's Mirror module. Dina calls Ollama, returns
            a DUMP response, the worker stores it and notifies the browser.
          </li>
        </ol>
      </DevSubsection>

      <DevSubsection id="architecture-state" title="Where state lives">
        <DevFieldList
          caption="Storage targets"
          rows={[
            {
              name: 'MySQL 8',
              type: 'shared',
              description: (
                <>
                  All durable application state: users, sessions, intake,
                  journal entries, groups, group_chat_messages,
                  truth_stream_*, group_insights, user_subscriptions,
                  subscription_events, usage_tracking. Connection-pooled
                  (30 connections, 60s idle). Used by both mirror-server
                  and dina-server (dina-server has its own tables prefixed
                  with <code>dina_*</code>).
                </>
              ),
            },
            {
              name: 'Redis',
              type: 'shared',
              description: (
                <>
                  Cache + pub/sub + queue. Holds the four DUMP priority
                  queues, the chat broadcast pub/sub, ephemeral presence
                  and typing state, group analysis caches (1 hour TTL),
                  and Dina's response routing channels.
                </>
              ),
            },
            {
              name: 'Ollama disk',
              type: 'dina-only',
              description: (
                <>
                  LLM model weights. Kept on the Dina host; never copied
                  across the network. <code>keep_alive: 24h</code> avoids
                  cold loads.
                </>
              ),
            },
            {
              name: 'Browser localStorage',
              type: 'client',
              description: (
                <>
                  <code>mirror_jwt</code>, <code>refreshToken</code>,{' '}
                  <code>userInfo</code>, the in-flight intake under{' '}
                  <code>mirror_intake_v1</code>. Cleared on logout.
                </>
              ),
            },
            {
              name: 'IndexedDB (browser)',
              type: 'client',
              description: (
                <>
                  face-api.js model shards (~216 MB) once downloaded. Kept
                  out of precache deliberately — see PWA section.
                </>
              ),
            },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="architecture-protocols" title="Protocols at a glance">
        <ul className="ml-6 list-disc space-y-1 text-white/85">
          <li>
            <strong>HTTPS</strong> — public, browser ↔ mirror-server, and
            internal, mirror-server ↔ dina-server. Both ends enforce TLS.
          </li>
          <li>
            <strong>WSS</strong> — two channels on mirror-server (
            <code>/mirror/groups/ws</code> for notifications,{' '}
            <code>/mirror/groups/chat</code> for live chat) and one on
            dina-server (<code>/dina/ws</code>, used by workers for streaming
            LLM responses).
          </li>
          <li>
            <strong>DUMP</strong> — the Dina Universal Message Protocol. The
            envelope every request and response on dina-server uses
            internally; mirror-server's connector constructs it on the way
            in. See the <a className="underline" href="#dump-protocol">DUMP protocol</a>{' '}
            section.
          </li>
        </ul>
        <DevCallout kind="tip">
          A useful mental model: HTTPS is the door, WSS is the intercom,
          DUMP is the manila envelope that everything inside Dina travels
          in.
        </DevCallout>
      </DevSubsection>
    </DevSection>
  );
};

export default Architecture;
