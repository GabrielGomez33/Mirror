import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCallout from '../DevCallout';
import DevBadge from '../DevBadge';

const Introduction: React.FC = () => {
  return (
    <DevSection id="introduction" title="Introduction" eyebrow="Start here">
      <DevSubsection id="introduction-what" title="What is Mirror?">
        <p>
          Mirror is a personal-intelligence platform. It collects a multi-modal
          profile of a person — personality, astrology, cognitive ability,
          facial signal, vocal signal — and turns that profile into self-
          knowledge through three lenses:
        </p>
        <ul className="ml-6 list-disc space-y-1 text-white/85">
          <li>
            <strong>MyMirror</strong> — a private report on how the person
            looks from the inside.
          </li>
          <li>
            <strong>MirrorGroups</strong> — small, encrypted groups where
            members opt-in to share parts of their profile and discover
            compatibility, collective strengths, and conflict risk.
          </li>
          <li>
            <strong>TruthStream</strong> — anonymous peer review that
            surfaces the gap between self-perception and how others see you.
          </li>
        </ul>
        <p>
          The intelligence layer — synthesis, classification, narrative
          analysis — is provided by a separate service called <em>Dina</em>.
          Mirror never speaks to a model directly; it speaks to Dina, and Dina
          speaks to models.
        </p>
      </DevSubsection>

      <DevSubsection id="introduction-three-repos" title="The three repositories">
        <p>The system is split across three repositories, each with a single, sharp responsibility.</p>
        <div className="my-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-2">
              <DevBadge tone="info">Client</DevBadge>
              <span className="font-mono text-xs text-white/60">Mirror</span>
            </div>
            <div className="text-sm text-white/85">
              React 19 + Vite PWA. Renders pages, captures intake, talks to
              mirror-server over HTTPS and WSS. <strong>Never</strong> talks
              to Dina directly.
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-2">
              <DevBadge tone="info">Application</DevBadge>
              <span className="font-mono text-xs text-white/60">mirror-server</span>
            </div>
            <div className="text-sm text-white/85">
              Express service on <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.85em]">:8444</code>.
              Owns auth, sessions, intake storage, journals, groups, chat,
              TruthStream, paywall, and PM2 workers. Talks to Dina via a
              single connector.
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-2">
              <DevBadge tone="info">Intelligence</DevBadge>
              <span className="font-mono text-xs text-white/60">dina-server</span>
            </div>
            <div className="text-sm text-white/85">
              Express service on <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.85em]">:8445</code>.
              Owns the LLM runtime (Ollama), DIGIM intelligence, vector
              cache, and the <strong>Mirror module</strong> — Dina's
              published entry point for everything Mirror needs.
            </div>
          </div>
        </div>
      </DevSubsection>

      <DevSubsection id="introduction-contract" title="The boundary contract">
        <p>
          The cardinal rule of this codebase, encoded into the docs so it
          never erodes:
        </p>
        <DevCallout kind="security" title="Mirror ↔ Dina only through src/modules/mirror">
          Every request from <code>mirror-server</code> to <code>dina-server</code>
          flows through Dina's <code>src/modules/mirror</code> module. No
          direct LLM calls, no direct DIGIM calls, no calls to anything else
          on Dina from Mirror. This is separation of concerns at the
          service boundary: Dina owns "how to think"; mirror-server owns
          "what to ask".
        </DevCallout>
        <p>
          In code, this rule is enforced by a single integration:
          <code>mirror-server/integrations/DINALLMConnector.ts</code>.
          It routes everything to <code>/mirror/synthesize-insights</code>,
          the TruthStream <code>/mirror/truthstream/*</code> endpoints, and
          the personal-analysis <code>/mirror/personal-analysis/*</code>
          endpoints — all of which are served by Dina's Mirror module.
        </p>
      </DevSubsection>

      <DevSubsection id="introduction-conventions" title="Conventions used in these docs">
        <ul className="ml-6 list-disc space-y-1.5 text-white/85">
          <li>
            <DevBadge tone="get">GET</DevBadge> <DevBadge tone="post">POST</DevBadge>{' '}
            <DevBadge tone="put">PUT</DevBadge> <DevBadge tone="delete">DELETE</DevBadge>
            {' '}— HTTP methods.
          </li>
          <li>
            <DevBadge tone="ws">WS</DevBadge> — a WebSocket event direction
            (either client→server or server→client; context disambiguates).
          </li>
          <li>
            <DevBadge tone="queue">QUEUE</DevBadge> — a background job
            processed by a PM2 worker.
          </li>
          <li>
            <DevBadge tone="public">Public</DevBadge> — no auth required.
            <DevBadge tone="auth">JWT</DevBadge> — bearer token required.
            <DevBadge tone="premium">Premium</DevBadge> — subscription gated.
            <DevBadge tone="admin">Admin</DevBadge> — admin-only.
          </li>
          <li>
            Code blocks are paste-friendly. Where snippets are shortened for
            clarity, the elided lines are marked with <code>…</code>.
          </li>
          <li>
            Press <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-white/80">/</kbd>{' '}
            anywhere in /dev to focus the search bar.
          </li>
        </ul>
      </DevSubsection>
    </DevSection>
  );
};

export default Introduction;
