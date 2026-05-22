import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCallout from '../DevCallout';
import DevBadge from '../DevBadge';
import DevCodeBlock from '../DevCodeBlock';

const Introduction: React.FC = () => {
  return (
    <DevSection id="introduction" title="Introduction" eyebrow="Start here">
      <DevSubsection id="introduction-what" title="What is Mirror?">
        <p>
          Mirror is a personal-intelligence platform. It captures a
          multi-modal profile of a person — facial signal, vocal signal,
          cognitive ability, astrological context, and personality — and
          turns that profile into self-knowledge through three lenses:
        </p>
        <ul className="dt-bullets">
          <li>
            <strong>MyMirror</strong> — a private report on how the person
            looks from the inside. Synthesizes intake, journal, group, and
            TruthStream data into a single narrative.
          </li>
          <li>
            <strong>MirrorGroups</strong> — small, end-to-end encrypted
            groups where members opt in to share parts of their profile.
            The system surfaces compatibility, collective strengths, and
            conflict risk without ever decrypting messages on the server.
          </li>
          <li>
            <strong>TruthStream</strong> — anonymous peer review. Other
            users review you against your stated goal; the result is a
            perception-gap report that compares your self-rating to the
            distribution of how others see you.
          </li>
        </ul>
        <p>
          The intelligence layer — synthesis, classification, narrative
          analysis — is provided by a separate service named{' '}
          <em>Dina</em>. Mirror itself never talks to a language model
          directly; it talks to Dina, and only through one published
          entry point. The reason for that separation is documented in
          the <a href="#introduction-contract">boundary contract</a>{' '}
          below.
        </p>
      </DevSubsection>

      <DevSubsection id="introduction-three-repos" title="The three repositories">
        <p>
          The system is split into three Git repositories, each with one
          sharp responsibility. Boundaries are deliberately strict: code
          does not casually cross repository lines.
        </p>
        <DevCodeBlock
          language="ascii"
          caption="repos at a glance"
          noLineNumbers
          code={`
   ┌─ GabrielGomez33/Mirror ────────────────────────────────────────┐
   │  Client. React 19 + Vite PWA. Renders pages, captures intake,  │
   │  talks to mirror-server over HTTPS and WSS. NEVER talks to     │
   │  Dina directly. Path inside this repo: client/                 │
   └────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌─ GabrielGomez33/mirror-server ─────────────────────────────────┐
   │  Application server. Express on :8444. Owns auth, sessions,    │
   │  intake storage, journals, groups, group chat, TruthStream,    │
   │  paywall, and four PM2 workers. Talks to Dina via a single     │
   │  file: integrations/DINALLMConnector.ts                        │
   └────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌─ GabrielGomez33/dina-server ───────────────────────────────────┐
   │  Intelligence server. Express on :8445. Owns the local LLM     │
   │  runtime (Ollama), DIGIM, the vector cache, and the Mirror     │
   │  module at src/modules/mirror — Dina's published entry point   │
   │  for every Mirror-driven operation.                            │
   └────────────────────────────────────────────────────────────────┘`}
        />
      </DevSubsection>

      <DevSubsection id="introduction-contract" title="The boundary contract">
        <p>The cardinal rule of this codebase, codified here so it never erodes:</p>
        <DevCallout
          kind="security"
          title="Mirror ↔ Dina only through src/modules/mirror"
        >
          Every request from <code>mirror-server</code> to{' '}
          <code>dina-server</code> flows through Dina's{' '}
          <code>src/modules/mirror</code> module — the published surface.
          No direct LLM calls from Mirror. No direct DIGIM calls. No calls
          to anything else on Dina from Mirror. Separation of concerns at
          the service boundary: Dina owns "how to think"; mirror-server
          owns "what to ask".
        </DevCallout>
        <p>The boundary buys three concrete properties:</p>
        <ol className="dt-numbered">
          <li>
            <strong>Auditability.</strong> One file —{' '}
            <code>mirror-server/integrations/DINALLMConnector.ts</code> —
            holds the contract. A <code>grep</code> for that filename
            finds every cross-service call in the system.
          </li>
          <li>
            <strong>Isolation.</strong> The Mirror module has its own
            <code> DinaLLMManager</code> instance, not the orchestrator's.
            A burst of Mirror-driven traffic cannot starve other Dina
            consumers, and vice versa.
          </li>
          <li>
            <strong>Future-proofing.</strong> If Dina ever swaps Ollama
            for a hosted model, or adds a new runtime entirely, only the
            internals of the Mirror module change. mirror-server's
            contract is stable.
          </li>
        </ol>
        <p>
          The dina-server section of these docs goes deep on the Mirror
          module's component composition, every method on its public
          surface, and the request/response shape (DUMP). The
          mirror-server section documents the connector and the workers
          that use it.
        </p>
      </DevSubsection>

      <DevSubsection id="introduction-conventions" title="Conventions used in these docs">
        <p>Tags used through the catalog:</p>
        <ul className="dt-bullets">
          <li>
            <DevBadge tone="get">GET</DevBadge>{' '}
            <DevBadge tone="post">POST</DevBadge>{' '}
            <DevBadge tone="put">PUT</DevBadge>{' '}
            <DevBadge tone="delete">DELETE</DevBadge>{' '}
            <DevBadge tone="patch">PATCH</DevBadge>
            {' '}— HTTP methods.
          </li>
          <li>
            <DevBadge tone="ws">WS</DevBadge> — a WebSocket event. Direction
            (client→server vs server→client) is disambiguated by context
            in the surrounding prose.
          </li>
          <li>
            <DevBadge tone="queue">QUEUE</DevBadge> — a background job
            processed by a PM2 worker, not an HTTP handler.
          </li>
          <li>
            <DevBadge tone="public">Public</DevBadge>{' '}
            <DevBadge tone="auth">JWT</DevBadge>{' '}
            <DevBadge tone="premium">Premium</DevBadge>{' '}
            <DevBadge tone="admin">Admin</DevBadge>{' '}
            — access requirements.
          </li>
        </ul>
        <p>
          Code blocks reflect the actual codebase. Where they have been
          shortened for layout, an ellipsis (<code>…</code>) marks the
          elided section. Where they show only a shape — a TypeScript
          type, an envelope, a payload — the field names and types are
          authoritative.
        </p>
        <p>
          Keyboard shortcuts are written as <kbd className="dt-kbd">/</kbd>,
          <kbd className="dt-kbd">Esc</kbd>, etc. The most useful one
          on this page is <kbd className="dt-kbd">/</kbd>, which focuses
          the search prompt from anywhere.
        </p>
      </DevSubsection>
    </DevSection>
  );
};

export default Introduction;
