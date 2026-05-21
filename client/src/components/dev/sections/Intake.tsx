import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';

const Intake: React.FC = () => {
  return (
    <DevSection id="intake" title="The intake pipeline" eyebrow="Deep dive">
      <DevSubsection id="intake-overview" title="Overview">
        <p>
          Intake is Mirror's onboarding ceremony: a six-step capture of
          personality, astrology, cognitive ability, facial signal, and vocal
          signal. The flow is fully resumable — the state persists locally
          after every step, so a closed tab or a dropped connection does not
          erase progress.
        </p>
        <DevCodeBlock
          language="ascii"
          caption="Intake flow"
          noLineNumbers
          code={`
   /intake/personality  →  Big-5 + MBTI questionnaire
        │
        ▼
   /intake/astrology    →  Western + Chinese + African + Numerology
        │
        ▼
   /intake/iq           →  Timed SVG visual-reasoning puzzles
        │
        ▼
   /intake/visual       →  Camera or upload → face-api landmarks + emotions
        │
        ▼
   /intake/vocal        →  Audio recording with metadata
        │
        ▼
   /intake/register     →  Display name (skipped if already collected)
        │
        ▼
   /intake/submit       →  Review → POST /mirror/api/intake → server analysis
        │
        ▼
   /intake/results      →  Summary page → /dashboard
          `}
        />
        <p>
          The router lives in <code>src/pages/IntakeFlow.tsx</code>, the
          state in <code>src/context/IntakeContext.tsx</code>, and the step
          UIs in <code>src/components/intake/*Step.tsx</code>. An{' '}
          <code>IntakeErrorBoundary</code> wraps the entire flow so a thrown
          step never breaks the parent shell.
        </p>
      </DevSubsection>

      <DevSubsection id="intake-step-personality" title="Step 1 — Personality (Big-5 / MBTI)">
        <p>
          ~50 Likert-scale items mapped to the five OCEAN factors. The MBTI
          type is inferred client-side from the Big-5 scores, not asked
          directly. The output is a structured profile, not a vector dump:
        </p>
        <DevCodeBlock
          language="ts"
          caption="PersonalityResult shape"
          code={`
type PersonalityResult = {
  big5Profile: {
    openness:           number; // 0..100
    conscientiousness:  number;
    extraversion:       number;
    agreeableness:      number;
    neuroticism:        number;
  };
  mbtiType: 'ENFP' | 'INTJ' | /* ... 14 more */;
  dominantTraits: string[];     // top-3 trait labels
  description: string;          // short human-readable summary
};
          `}
        />
      </DevSubsection>

      <DevSubsection id="intake-step-astrology" title="Step 2 — Astrology">
        <p>
          Birth date is required; birth time and location are optional. The
          result blends four traditions (Western zodiac with houses, Chinese
          zodiac + element, African zodiac, numerology) into a single
          synthesis object. Computation happens client-side; nothing is sent
          to a third party for chart casting.
        </p>
      </DevSubsection>

      <DevSubsection id="intake-step-iq" title="Step 3 — IQ assessment">
        <p>
          A timed sequence of visual-reasoning puzzles served from{' '}
          <code>/Mirror/images/iq/</code>. The score is a relative percentile,
          not a normed IQ — Mirror does not certify clinical IQ. The image
          set is deliberately excluded from the service worker precache to
          keep the install footprint small; first run downloads only the
          puzzles needed for the user's session.
        </p>
      </DevSubsection>

      <DevSubsection id="intake-step-visual" title="Step 4 — Visual (face-api)">
        <p>
          The user grants camera access or uploads a still. The image is
          processed in-browser by <code>@vladmandic/face-api</code>:
          landmarks, expression vector, and a face descriptor (a 128-d
          embedding) are computed locally, then sent up with the rest of
          the intake.
        </p>
        <DevCallout kind="security" title="Models load lazily">
          The face-api model shards weigh ~216 MB total and live in{' '}
          <code>public/models/faceapi</code>. They are{' '}
          <strong>not precached</strong> by the service worker; the{' '}
          <code>useFaceApi</code> hook lazy-loads them on first use and
          caches them in IndexedDB so subsequent visits are instant. The
          raw image bytes never leave the browser; only the derived
          features (landmarks + descriptors + emotion vector) are sent
          along with the intake payload.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-step-vocal" title="Step 5 — Vocal">
        <p>
          A short recording captured via <code>MediaRecorder</code>. The
          captured Blob is shipped as-is together with metadata so future
          server-side vocal analysis can be added without breaking the
          contract:
        </p>
        <DevCodeBlock
          language="ts"
          caption="VoicePayload shape"
          code={`
type VoicePayload = {
  blobUrl:    string;     // local object URL, used for in-step playback only
  mimeType:   string;     // typically 'audio/webm;codecs=opus' or 'audio/mp4'
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
      </DevSubsection>

      <DevSubsection id="intake-step-submit" title="Step 6 — Review & submit">
        <p>
          The Submit step shows a summary card of every captured value
          (truncated where appropriate) and gives the user one explicit
          confirmation. On submit, the client POSTs to{' '}
          <code>/mirror/api/intake/store</code>; on success the user is
          marked <code>intakeCompleted = true</code>, local intake state is
          cleared, and the router transitions to the Results step.
        </p>
      </DevSubsection>

      <DevSubsection id="intake-persistence" title="Client-side persistence">
        <p>
          <code>IntakeContext</code> serializes its full state to localStorage
          under the key <code>mirror_intake_v1</code> on every update. The
          hydrate-on-mount pattern means refreshing the page in the middle
          of a step puts the user right back where they were.
        </p>
        <DevCodeBlock
          language="ts"
          caption="Persistence contract"
          code={`
// On any state change:
localStorage.setItem('mirror_intake_v1', JSON.stringify(state));

// On context mount:
const raw = localStorage.getItem('mirror_intake_v1');
if (raw) setState(JSON.parse(raw));

// On successful submission:
localStorage.removeItem('mirror_intake_v1');
          `}
        />
        <DevCallout kind="warning" title="The voice Blob is the exception">
          A <code>Blob</code> cannot survive a page reload via{' '}
          localStorage. If the user refreshes after the vocal step but
          before submit, they will be prompted to re-record. This is a
          deliberate trade — IndexedDB persistence for one short audio
          recording was judged not worth the added complexity.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-payload" title="Submission payload shape">
        <DevCodeBlock
          language="ts"
          caption="POST /mirror/api/intake/store body"
          code={`
{
  personalityAnswers:   Record<string, number>;    // raw Likert responses
  personalityResult:    PersonalityResult;         // see Step 1
  astrologicalResult:   {
    western:    { sun, moon, rising, houses };
    chinese:    { sign, element };
    african:    { /* ... */ };
    numerology: { /* ... */ };
    synthesis:  { /* ... */ };
  };
  photo:                File;                       // raw stills NOT sent — see note
  faceAnalysis:         {
    emotions:        Record<EmotionLabel, number>;  // probabilities
    landmarks:       number[];                      // 68×(x,y) flattened
    faceDescriptor:  number[];                      // 128-d embedding
  };
  iqAnswers:            Record<string, unknown>;
  iqResults:            { score, percentile, timeSpent };
  voice:                Blob;                       // multipart upload
  voicePayload:         VoicePayload;
  name:                 string;
  fears:                string;
}
          `}
        />
        <DevCallout kind="security" title="Raw face image policy">
          The browser sends face <em>features</em> (landmarks, descriptor,
          emotion vector), not the raw photo, to mirror-server. The photo
          object is kept in the client only for the duration of the
          submission UI and is dropped from memory after navigation. If a
          future feature requires the raw image, it should be discussed
          and gated behind explicit consent before the contract changes.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="intake-edge-cases" title="Edge cases and recovery">
        <DevFieldList
          rows={[
            { name: 'Camera permission denied', description: <>Visual step shows a file-upload fallback. If neither is available, the step is marked complete with a null face analysis (subsequent reports note "facial data not available").</> },
            { name: 'Microphone permission denied', description: 'Vocal step shows a "skip" affordance with a one-line explanation of how the missing data affects downstream analysis.' },
            { name: 'Mid-step page reload', description: <>Context rehydrates from localStorage; the router resumes at the last completed step + 1. Voice recording is the only re-do; everything else survives.</> },
            { name: 'Submit fails (5xx)', description: 'Client keeps the full payload in context and shows a retry CTA. Up to 3 attempts with backoff. After the third failure, the user is told to try again later — localStorage is intentionally NOT cleared.' },
            { name: 'Submit fails (401)', description: <>Session expired during submit. The client triggers a token refresh through AuthContext and re-submits transparently. If refresh also fails, the user is bounced to /login and the intake persists for resumption after re-auth.</> },
            { name: 'Token refresh in flight', description: 'AuthContext queues callers; nothing fires duplicate refresh requests. After refresh, all queued submits proceed.' },
            { name: 'IntakeErrorBoundary catches a thrown step', description: 'The user sees a recovery card with "Reload step" and "Return to dashboard" actions. The throw is logged via console.error so it appears in the bug reports the team collects.' },
          ]}
        />
      </DevSubsection>
    </DevSection>
  );
};

export default Intake;
