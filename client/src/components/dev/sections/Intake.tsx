import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

/**
 * Intake pipeline documentation.
 *
 * The order is derived from the actual `navigate('/intake/<next>')` call
 * inside each step, NOT from the order of <Route> declarations in
 * IntakeFlow.tsx (which is alphabetical and not the user journey).
 *
 * Entry → Visual → Vocal → IQ → Astrology → Personality → Submit → Results
 *
 * Verified by grepping each file in client/src/components/intake/:
 *   WelcomeStep.tsx        →  /intake/visual
 *   RegistrationStep.tsx   →  /intake/visual
 *   VisualStep.tsx         →  /intake/vocal
 *   VocalStep.tsx          →  /intake/iq
 *   IQStep.tsx             →  /intake/astrology
 *   AstroLogicalStep.tsx   →  /intake/personality
 *   PersonalityStep.tsx    →  /intake/submit
 *   SubmitStep.tsx         →  /intake/results
 */
const Intake: React.FC = () => {
  return (
    <DevSection id="intake" title="The intake pipeline" eyebrow="Deep dive">
      <DevSubsection id="intake-overview" title="Overview">
        <p>
          Intake is Mirror's onboarding ceremony. A new authenticated user
          who has no completed intake is routed here by{' '}
          <code>IntakeGate</code> at <code>/</code>. The flow collects, in
          order, a facial signal, a vocal signal, a cognitive score, an
          astrological profile, and a personality profile. The user then
          confirms and submits. State is persisted to{' '}
          <code>localStorage</code> after every step, so a closed tab or
          dropped connection never erases progress.
        </p>
        <DevCallout
          kind="info"
          title="Why this order matters in the docs"
        >
          The route order declared in <code>src/pages/IntakeFlow.tsx</code>{' '}
          is alphabetical, not chronological. The <em>actual</em> user
          journey is determined by the <code>navigate('/intake/&lt;next&gt;')</code>{' '}
          call inside each step's <code>handleNext</code>. Below is that
          chain, verified file-by-file.
        </DevCallout>
        <DevCodeBlock
          language="ascii"
          caption="Intake flow — verified from each step's handleNext()"
          noLineNumbers
          code={`
   ┌──────────────────────────────────────────────────────┐
   │  /  → IntakeGate                                     │
   │      └─ no intake found → /intake                    │
   └────────────────────────┬─────────────────────────────┘
                            │
                            ▼  (existing user: /intake)
   ┌──────────────────────────────────────────────────────┐
   │  WelcomeStep   or   RegistrationStep                 │
   │       └────────────┬─────────────┘                   │
   │                    │                                 │
   │  both call navigate('/intake/visual')                │
   └────────────────────┬─────────────────────────────────┘
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  01 · VisualStep        ─► /intake/vocal             │
   │  02 · VocalStep         ─► /intake/iq                │
   │  03 · IQStep            ─► /intake/astrology         │
   │  04 · AstroLogicalStep  ─► /intake/personality       │
   │  05 · PersonalityStep   ─► /intake/submit            │
   │  06 · SubmitStep        ─► /intake/results           │
   │  07 · ResultsStep       ─► /dashboard                │
   └──────────────────────────────────────────────────────┘
          `}
        />
        <p>
          The flow is anchored by <code>IntakeContext</code> in{' '}
          <code>src/context/IntakeContext.tsx</code> and wrapped in{' '}
          <code>IntakeErrorBoundary</code> so a thrown step never breaks
          the parent shell. Every step calls{' '}
          <code>markStepComplete(name, summaryData)</code> before
          navigating, which is how downstream code (and the Submit step)
          knows whether a step is "real-complete" vs simply visited.
        </p>
        <DevCallout kind="warning" title="A note on /intake/register">
          <code>RegistrationStep</code> is registered as a route but is{' '}
          <em>not</em> a chronological intermediate — it is an alternative
          entry point used when the user reached <code>/intake</code>{' '}
          without an account. It also navigates to{' '}
          <code>/intake/visual</code> on completion. Treat it as a sibling
          of <code>WelcomeStep</code> at the head of the flow, not as a
          middle step.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-entry" title="Entry — Welcome / Registration">
        <p>
          The first screen the user actually sees depends on auth state.
          An authenticated user sees <code>WelcomeStep</code> (a brief
          consent and orientation card). An unauthenticated user sees{' '}
          <code>RegistrationStep</code> (email + password + username).
          Both end by calling <code>navigate('/intake/visual')</code>,
          which is why the deep dive starts there.
        </p>
        <DevFieldList
          rows={[
            { name: 'WelcomeStep.tsx',     type: 'auth', description: <>Brief orientation; explains what data will be collected and that storage is encrypted. Next: <code>/intake/visual</code>.</> },
            { name: 'RegistrationStep.tsx', type: 'public + auth-on-success', description: <>Standard registration form. On success, the new JWT is written and the user transitions directly into the intake flow at <code>/intake/visual</code>.</> },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="intake-step-visual" title="Step 1 — VisualStep (face-api)">
        <p>
          The first measured step. The user adds a still — by uploading from
          their device, or on mobile by tapping <code>Take Photo</code>, which
          opens the native OS camera through a <code>&lt;input capture&gt;</code>
          field (the legacy in-browser <code>getUserMedia</code> viewfinder was
          removed: it was unreliable on mobile WebKit and the native picker also
          transcodes iOS HEIC → JPEG automatically). The image is processed{' '}
          <strong>entirely in the browser</strong> by{' '}
          <code>@vladmandic/face-api</code>: landmarks (68 × {`{x, y}`}),
          an expression vector, and a 128-dimensional face descriptor are
          computed locally. Only those derived features travel to the
          server with the rest of the intake; the raw photo bytes do not
          leave the browser.
        </p>
        <DevCallout kind="security" title="Models load lazily and stay local">
          The face-api model shards weigh ~216 MB total and live under{' '}
          <code>public/models/faceapi/</code>. They are{' '}
          <strong>not precached</strong> by the service worker —
          downloading them all at install time would be hostile to first
          paint and bandwidth budgets. The <code>useFaceApi</code> hook
          lazy-loads on first invocation and caches the models in
          IndexedDB so the second visit is instant.
        </DevCallout>
        <p>
          Facial analysis is <strong>required</strong>:{' '}
          <code>handleNext()</code> refuses to advance unless{' '}
          <code>analysisState.hasAnalysis</code> is true — there is no skip
          path. When detection fails the user gets a <em>Try Again</em> action
          plus an actionable tips panel (lighting, framing, remove glasses) to
          help capture a usable photo. If the face-api engine itself fails to
          load, a <em>Retry</em> button re-loads the models in place via{' '}
          <code>useFaceApi.reload()</code> (no full page refresh) — the user
          still cannot continue until analysis succeeds. A decode watchdog
          clears any stuck <code>Analyzing…</code> state, and the action area
          auto-scrolls into view on success so the Continue button is never
          stranded below the fold.
        </p>
        <DevCodeBlock
          language="ts"
          caption="VisualStep — markStepComplete + navigate"
          code={`
markStepComplete('VisualStep', {
  hasPhoto:     captureState.hasPhoto,
  hasAnalysis:  true, // required — guaranteed at this point
  qualityScore: analysisState.qualityScore,
});
navigate('/intake/vocal');
          `}
        />
      </DevSubsection>

      <DevSubsection id="intake-step-vocal" title="Step 2 — VocalStep">
        <p>
          A short recording captured via the browser's{' '}
          <code>MediaRecorder</code> API. The captured <code>Blob</code>{' '}
          is held in memory; the metadata (MIME type, duration, device
          and browser fingerprint) is added to{' '}
          <code>IntakeContext</code> immediately. The blob itself ships at
          submit time as a multipart field.
        </p>
        <DevCodeBlock
          language="ts"
          caption="VoicePayload shape persisted to IntakeContext"
          code={`
type VoicePayload = {
  blobUrl:    string;     // local object URL, used only for in-step playback
  mimeType:   string;     // 'audio/webm;codecs=opus' on Chromium, 'audio/mp4' on Safari
  size:       number;     // bytes
  durationMs: number;
  deviceInfo: {
    isMobile: boolean;
    platform: string;
    browser:  string;
  };
};
          `}
        />
        <DevCallout kind="warning" title="The blob is the one thing that doesn't survive reload">
          Everything else in <code>IntakeContext</code> is JSON-serializable
          and lands in <code>localStorage</code> automatically. A{' '}
          <code>Blob</code> cannot. If the user refreshes between Vocal
          and Submit, the Submit step detects the missing blob and routes
          them back to <code>/intake/vocal</code> to re-record. We chose
          this over IndexedDB persistence because the cost of re-recording
          one short clip is lower than the cost of an extra storage
          subsystem with its own lifecycle and quota errors.
        </DevCallout>
        <p>Next: <code>/intake/iq</code>.</p>
      </DevSubsection>

      <DevSubsection id="intake-step-iq" title="Step 3 — IQStep">
        <p>
          A 30-item, untimed multiple-choice assessment spanning four
          reasoning types — numerical, spatial, logical, and verbal. The
          spatial items use SVGs from <code>public/images/iq/</code>, which
          are <strong>deliberately excluded</strong> from the service-worker
          precache. Question <em>and</em> option order are shuffled per
          attempt (Fisher–Yates) for integrity, and <code>correctAnswer</code>
          is matched by value so shuffling is safe. A dev-only guard validates
          that every item's answer key exists among its options.
        </p>
        <DevCallout kind="security" title="Estimate, not a clinical score">
          Scoring derives entirely from the recorded answers (single source of
          truth). Proportion-correct is <strong>chance-corrected</strong> (a
          4-option item has a 25% floor) and mapped through a continuous,
          monotonic curve to a clamped 55–145 range — no discontinuities, so
          one answer never swings the score by a tier. Bands follow
          conventional ranges (&lt;85 / 85–114 / 115–129 / 130+). It is a
          self-assessment estimate; Mirror does not certify IQ and surfaces a
          disclaimer in the results. Answer keys live client-side — true
          anti-cheat would require server-side scoring.
        </DevCallout>
        <DevFieldList
          rows={[
            { name: 'iqAnswers',                 type: 'Record<string, string>', description: 'Per-item selected option value, keyed by question id.' },
            { name: 'iqResults.rawScore',        type: 'number',                 description: 'Number of correct answers.' },
            { name: 'iqResults.totalQuestions',  type: 'number',                 description: 'Total items presented (30).' },
            { name: 'iqResults.iqScore',         type: 'number',                 description: 'Chance-corrected estimate, clamped 55–145.' },
            { name: 'iqResults.category',        type: 'string',                 description: 'Very High / High / Average / Below Average.' },
            { name: 'iqResults.strengths',       type: 'string[]',               description: 'Reasoning types scored above 70%.' },
            { name: 'iqResults.categoryBreakdown', type: 'CategoryScore[]',      description: 'Per-type correct/total for transparency.' },
          ]}
        />
        <p>Next: <code>/intake/astrology</code>.</p>
      </DevSubsection>

      <DevSubsection id="intake-step-astrology" title="Step 4 — AstroLogicalStep">
        <p>
          Birth date is required; birth time and place are optional. All
          chart computation happens client-side — no third-party
          astrology API is called — so the user's birth data never leaves
          their device before submission. The output blends four
          traditions into a single synthesis object:
        </p>
        <DevCodeBlock
          language="ts"
          caption="AstrologicalResult shape"
          code={`
type AstrologicalResult = {
  western:    { sun: ZodiacSign; moon: ZodiacSign; rising?: ZodiacSign; houses?: HouseMap };
  chinese:    { sign: ChineseAnimal; element: Element };
  african:    { /* lineage-specific fields */ };
  numerology: { lifePath: number; expression?: number; soulUrge?: number };
  synthesis:  { /* unified narrative used by MyMirror */ };
};
          `}
        />
        <p>Next: <code>/intake/personality</code>.</p>
      </DevSubsection>

      <DevSubsection id="intake-step-personality" title="Step 5 — PersonalityStep">
        <p>
          ~50 Likert-scale items mapped to the Big-5 OCEAN factors. The
          MBTI type is inferred client-side from the Big-5 scores and the
          two outputs are stored side-by-side so MyMirror can render either
          framing the user prefers. Item order is randomized per session
          to discourage acquiescence bias.
        </p>
        <DevCodeBlock
          language="ts"
          caption="PersonalityResult shape"
          code={`
type PersonalityResult = {
  big5Profile: {
    openness:          number;  // 0..100
    conscientiousness: number;
    extraversion:      number;
    agreeableness:     number;
    neuroticism:       number;
  };
  mbtiType:       MBTIType;          // 'ENFP' | 'INTJ' | … 16 total
  dominantTraits: string[];          // top-3 trait labels
  description:    string;            // short human-readable summary
};
          `}
        />
        <p>Next: <code>/intake/submit</code>.</p>
      </DevSubsection>

      <DevSubsection id="intake-step-submit" title="Step 6 — SubmitStep">
        <p>
          The Submit step is the only step that crosses the network. It
          renders a summary card of every captured value (truncated where
          long), asks for one explicit confirmation, then{' '}
          <code>POST</code>s the consolidated payload to{' '}
          <code>/mirror/api/intake/store</code>. On 2xx, the user is
          marked <code>intakeCompleted = true</code>, local intake state
          is cleared, and the router transitions to{' '}
          <code>/intake/results</code>.
        </p>
        <p>Edge handling on submit:</p>
        <ul className="dt-bullets">
          <li>
            On 5xx the payload is kept in context, the user sees a retry
            CTA, and the client tries up to 3 times with exponential
            backoff (1s, 2s, 4s). localStorage is never cleared until 2xx.
          </li>
          <li>
            On 401 the client triggers a token refresh through
            <code> AuthContext</code> and resubmits transparently. If
            refresh also fails, the user is sent to <code>/login</code> and
            the intake survives for resumption.
          </li>
          <li>
            If the voice blob is missing (page reload between Vocal and
            Submit) the user is sent back to <code>/intake/vocal</code> to
            re-record.
          </li>
        </ul>
        <p>Next on 2xx: <code>/intake/results</code>.</p>
      </DevSubsection>

      <DevSubsection id="intake-step-results" title="Step 7 — ResultsStep">
        <p>
          The terminal step. Renders the intake summary — Big-5 bars, MBTI
          type, astrology sun/moon, IQ percentile, face-emotion
          distribution, and a short narrative pulled from the synthesis.
          A primary CTA returns the user to <code>/dashboard</code>; a
          secondary CTA links to <code>/mymirror</code> once the personal
          analysis job has completed.
        </p>
        <p>
          Note that <code>/intake/complete</code> is registered as an
          alias of this same component for backwards-compatible deep
          links from older emails.
        </p>
      </DevSubsection>

      <DevSubsection id="intake-persistence" title="Client-side persistence">
        <p>
          <code>IntakeContext</code> serializes its full state (minus the
          voice <code>Blob</code>) to <code>localStorage</code> under the
          key <code>mirror_intake_v1</code> on every update. The
          hydrate-on-mount pattern means a refresh in the middle of a step
          puts the user right back where they were.
        </p>
        <DevCodeBlock
          language="ts"
          caption="Persistence contract"
          code={`
// On any state change:
localStorage.setItem('mirror_intake_v1', JSON.stringify(stateMinusBlobs));

// On context mount:
const raw = localStorage.getItem('mirror_intake_v1');
if (raw) setState(JSON.parse(raw));

// On 2xx from /mirror/api/intake/store:
localStorage.removeItem('mirror_intake_v1');
          `}
        />
        <DevCallout kind="tip" title="Version the key, never overload it">
          The trailing <code>v1</code> in <code>mirror_intake_v1</code>{' '}
          exists so that if the shape ever changes incompatibly, the next
          version simply uses <code>mirror_intake_v2</code> instead of
          inventing a runtime migration. Old keys are detected on mount
          and cleared. This is cheaper, in both code and bugs, than a
          generic migrator.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-payload" title="Submission payload shape">
        <DevCodeBlock
          language="ts"
          caption="POST /mirror/api/intake/store body — multipart/form-data"
          code={`
// JSON fields (one form-data part each, stringified):
{
  visual: {
    hasPhoto:     boolean;
    qualityScore: number;
    analysis: {
      emotions:        Record<EmotionLabel, number>;   // probabilities
      landmarks:       number[];                       // 68×(x,y) flattened
      faceDescriptor:  number[];                       // 128-d embedding
    };
  };

  vocal: {
    mimeType:   string;
    durationMs: number;
    deviceInfo: { isMobile, platform, browser };
  };

  iq: {
    answers:   Record<string, unknown>;
    score:     number;
    percentile:number;
    timeSpent: number;
  };

  astrology: AstrologicalResult;

  personality: {
    answers: Record<string, number>;     // raw Likert
    result:  PersonalityResult;
  };

  name:  string;
  fears: string;
}

// Binary parts:
//   - "voice"  → Blob (audio/webm or audio/mp4, ~5–30s)
//   - "photo"  → omitted by default; only sent if the user explicitly
//                opts into "include raw photo" (off by default).
          `}
        />
        <DevCallout kind="security" title="Raw photo policy">
          By default the browser sends face <em>features</em> (landmarks,
          descriptor, emotion vector), not the raw photo, to mirror-server.
          The photo object lives in the client only for the duration of
          the submission UI and is dropped from memory on the next
          navigation. Any future feature requiring the raw image must be
          gated behind an explicit opt-in dialog and a separate column in
          the intake schema.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-edge-cases" title="Edge cases and recovery">
        <DevFieldList
          rows={[
            { name: 'Camera permission denied', description: <>Not applicable on mobile — <code>Take Photo</code> uses the native OS camera picker, which handles its own permission UI; if the user cancels, they simply fall back to <code>Upload</code>. Desktop is upload-only. The step refuses to advance without a photo and surfaces an inline explanation.</> },
            { name: 'Undecodable / HEIC image', description: <>The <code>&lt;img&gt;</code> <code>onError</code> handler catches images the browser cannot decode (HEIC/HEIF on Chrome/Firefox, truncated files) and surfaces an actionable message instead of silently stalling. Accepted upload types are aligned with the server (<code>jpeg/png/webp</code>); HEIC is rejected up-front with guidance.</> },
            { name: 'Analysis engine fails / no face', description: <>A 20s watchdog clears any stuck <code>Analyzing…</code> state. Face detection failures surface a <em>Try Again</em> action plus a tips panel; an engine-load failure offers <em>Retry</em> (<code>useFaceApi.reload()</code>). Analysis is required, so there is no skip — the user fixes the photo or retries until it succeeds.</> },
            { name: 'Microphone permission denied', description: <>VocalStep offers a "skip" affordance with a one-line explanation of how the missing data affects downstream analysis. <code>voicePayload</code> is set to a sentinel value so server-side aggregation knows the gap is intentional, not a bug.</> },
            { name: 'Mid-step page reload', description: <>Context rehydrates from localStorage; the router opens the last step that had not reported <code>markStepComplete</code>. Only the voice <code>Blob</code> is non-recoverable.</> },
            { name: 'Submit fails (5xx)', description: <>Client keeps the payload in context and shows a retry CTA. Up to 3 attempts with exponential backoff (1s / 2s / 4s). After the third failure, the user is told to try again later — localStorage is intentionally <strong>not</strong> cleared.</> },
            { name: 'Submit fails (401)', description: <>Session expired during submit. AuthContext refreshes the token and resubmits transparently. If refresh fails, the user is bounced to /login with the intake intact for resumption after re-auth.</> },
            { name: 'Token refresh in flight', description: <>AuthContext queues callers; multiple concurrent submits never trigger duplicate refresh requests. After refresh, queued submits proceed in order.</> },
            { name: 'IntakeErrorBoundary catches a thrown step', description: <>The user sees a recovery card with "Reload step" and "Return to dashboard" actions. The throw is logged through <code>console.error</code> so it appears in any client error collector configured downstream.</> },
            { name: 'User completes intake then registers in a different browser', description: <>The intake is associated with the user id at submit time, so a fresh device with the same login sees the completed flag immediately. No re-submission is required.</> },
          ]}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default Intake;