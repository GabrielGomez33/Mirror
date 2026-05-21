import React from 'react';
import DevSection from '../DevSection';
import DevSubsection from '../DevSubsection';
import DevCodeBlock from '../DevCodeBlock';
import DevCallout from '../DevCallout';
import DevFieldList from '../DevField';
import DevEndpointTable from '../DevEndpointTable';

const Frontend: React.FC = () => {
  return (
    <DevSection id="frontend" title="Frontend — Mirror client" eyebrow="Mirror client">
      <DevSubsection id="frontend-stack" title="Stack">
        <p>
          The client is a React 19 + Vite 6 PWA written in TypeScript and
          styled with Tailwind 4 over a hand-written glass-morphism design
          system. Key runtime dependencies:
        </p>
        <DevFieldList
          caption="Runtime dependencies"
          rows={[
            { name: 'react / react-dom', type: '^19.1.0', description: 'React 19 with concurrent features. The root is wrapped in six providers (Auth, Intake, Group, Chat, Notification, Subscription).' },
            { name: 'react-router-dom', type: '^7.6.1', description: 'Routing. Mounted under basename "/Mirror". All protected routes are wrapped in a custom ProtectedRoute HOC.' },
            { name: '@react-three/fiber + @react-three/drei + three', type: '^0.177', description: 'Three.js scenes for Dashboard, MyJournal, MyMirror, Groups, TruthStream. Each page has its own zen scene.' },
            { name: '@vladmandic/face-api + @tensorflow/tfjs(-backend-webgl/cpu)', type: '^1.7.15 / ^4.22', description: 'Face detection during the Visual intake step. Models ship in /public/models/faceapi and are not precached.' },
            { name: 'framer-motion', type: '^12', description: 'Page transitions, banner animations, intake step transitions.' },
            { name: '@radix-ui/react-dialog + react-tooltip', type: '^1', description: 'Accessible dialog and tooltip primitives.' },
            { name: 'zustand', type: '^5', description: 'Available but largely unused — contexts dominate. Reserved for performance-sensitive stores.' },
            { name: 'vite-plugin-pwa + workbox-window', type: '^1.2 / ^7.4', description: 'PWA build, service worker injectManifest, manual update prompt flow.' },
            { name: 'html2pdf.js', type: '^0.14', description: 'PDF export of MyMirror reports and TruthStream analyses.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-routing" title="Routing map">
        <p>
          All routes live in <code>src/App.tsx</code>. The root (<code>/</code>)
          is gated by <code>IntakeGate</code>, which checks the latest intake
          for the current user and redirects to one of three destinations:
        </p>
        <ul className="ml-6 list-disc space-y-1 text-white/85">
          <li>Not authenticated → <code>/login</code></li>
          <li>Authenticated, no intake found → <code>/intake</code></li>
          <li>Authenticated, intake exists → <code>/dashboard</code></li>
        </ul>
        <DevEndpointTable
          caption="Public routes (no auth required)"
          hideAccess
          rows={[
            { method: 'GET', path: '/home', description: 'Marketing/landing page with rotating Three.js scene.' },
            { method: 'GET', path: '/landing', description: 'Alternate landing variant.' },
            { method: 'GET', path: '/login', description: 'Email + password sign-in. Redirects authenticated users.' },
            { method: 'GET', path: '/register', description: 'Registration. Wraps the RegistrationStep used inside intake.' },
            { method: 'GET', path: '/forgot-password', description: 'Request a password reset email.' },
            { method: 'GET', path: '/reset-password', description: 'Consume a reset token and set a new password.' },
            { method: 'GET', path: '/verify-email', description: 'Email verification landing (token in query string).' },
            { method: 'GET', path: '/test', description: 'Dev-only playground for Three.js + glass components.' },
          ]}
        />
        <DevEndpointTable
          caption="Authenticated routes"
          rows={[
            { method: 'GET', path: '/dashboard', description: 'Magical-sphere navigation hub.', access: 'JWT' },
            { method: 'GET', path: '/intake/*', description: 'The multi-step intake flow (Personality → Astrology → IQ → Visual → Vocal → Submit → Results).', access: 'JWT' },
            { method: 'GET', path: '/journal', description: 'Dedicated journal editor and list.', access: 'JWT' },
            { method: 'GET', path: '/groups', description: 'MirrorGroups directory + chat + voting.', access: 'JWT' },
            { method: 'GET', path: '/dev', description: 'This developer documentation.', access: 'JWT', notes: 'Added in this branch.' },
          ]}
        />
        <DevEndpointTable
          caption="Routes requiring completed intake"
          rows={[
            { method: 'GET', path: '/mymirror', description: 'Personal truth-mirror report.', access: 'JWT + intake' },
            { method: 'GET', path: '/truthstream', description: 'Peer review hub. Supports ?view= and ?reviewId= deep links.', access: 'JWT + intake' },
            { method: 'GET', path: '/results', description: 'Detailed intake analysis.', access: 'JWT + Tier2' },
            { method: 'GET', path: '/review', description: 'Review interface (placeholder).', access: 'JWT + Tier2' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-pages" title="Pages, page by page">
        <p>
          Every file under <code>src/pages/</code>. Each page mounts inside the
          provider stack defined in <code>App.tsx</code>, so contexts (auth,
          intake, groups, chat, notifications, subscription) are available
          everywhere.
        </p>
        <DevFieldList
          caption="src/pages"
          rows={[
            { name: 'Home.tsx', type: 'public', description: 'Public landing with Three.js cube and login/register CTAs.' },
            { name: 'Landing.tsx', type: 'public', description: 'Alternate marketing landing.' },
            { name: 'TestPage.tsx', type: 'dev', description: 'Three.js + UI playground; not linked from production navigation.' },
            { name: 'VerifyEmailPage.tsx', type: 'public', description: 'Reads token from query string and POSTs to /auth/verify-email. Auto-redirects to /dashboard on success.' },
            { name: 'ForgotPasswordPage.tsx', type: 'public', description: 'Email submission; generic success copy to avoid account enumeration.' },
            { name: 'ResetPasswordPage.tsx', type: 'public', description: 'Two-phase: GET /auth/reset-password/validate then POST /auth/reset-password.' },
            { name: 'Dashboard.tsx', type: 'auth', description: 'Magical-sphere navigation: Journal, MyMirror, Groups, TruthStream. Renders ZenGardenScene as background.' },
            { name: 'IntakeFlow.tsx', type: 'auth', description: 'Nested router for the intake steps; see "Intake pipeline".' },
            { name: 'Results.tsx', type: 'auth+intake', description: 'Full intake analysis (Tier2 access).' },
            { name: 'Review.tsx', type: 'auth+intake', description: 'Reserved; minimal stub.' },
            { name: 'MyJournalPage.tsx', type: 'auth', description: 'Journal CRUD with ZenPondScene; auto-save and offline cache.' },
            { name: 'MyMirrorPage.tsx', type: 'auth+intake', description: 'Perception-gap report with SakuraForestScene.' },
            { name: 'MirrorGroupsPage.tsx', type: 'auth', description: 'Groups directory, chat overlay, voting, with ZenPondScene2.' },
            { name: 'TruthStreamPage.tsx', type: 'auth+intake', description: 'Tabbed view of the peer-review pipeline with ZenBridgeScene.' },
            { name: 'Intake.tsx, Registration.tsx', type: 'legacy', description: 'Unused; superseded by IntakeFlow + RegistrationStep.' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-contexts" title="Contexts and global state">
        <p>
          Each provider owns one slice of global state. They are mounted in a
          specific order in <code>App.tsx</code> because some depend on others:
        </p>
        <DevCodeBlock
          language="tsx"
          caption="src/App.tsx — provider stack (abridged)"
          code={`
<AuthProvider>
  <IntakeProvider>
    <GroupProvider>
      <ChatProvider>
        <NotificationProvider>
          <SubscriptionProvider>
            <Routes>{/* ... */}</Routes>
          </SubscriptionProvider>
        </NotificationProvider>
      </ChatProvider>
    </GroupProvider>
  </IntakeProvider>
</AuthProvider>
          `}
        />
        <DevFieldList
          caption="src/context"
          rows={[
            { name: 'AuthContext', type: '848 LOC', description: <>The largest. Owns JWT lifecycle (verify, refresh every 30s, expire-soon refresh at T-5min), <code>AccessLevel</code> / <code>SecurityLevel</code> / <code>UserTier</code> enums, and a route-permission cache (5 min TTL). Token storage in localStorage under <code>mirror_jwt</code>, <code>refreshToken</code>, <code>userInfo</code>.</> },
            { name: 'IntakeContext', description: <>In-flight intake state across all six steps. Auto-persists to localStorage under <code>mirror_intake_v1</code> on every update. Cleared after a successful submission.</> },
            { name: 'GroupContext', description: <>My groups, suggested groups, current group, members, active votes, group insights. Connects <code>groupsWebSocket</code> on mount.</> },
            { name: 'ChatContext', description: <>Per-group message list, typing users, presence map, optimistic send queue, pinned/threaded messages, plus a <code>dinaProcessing</code>/<code>dinaStreamingMessage</code> slice for @Dina answers.</> },
            { name: 'NotificationContext', description: <>In-app inbox (max 50 entries), unread count, group invitation accept/decline. Subscribes to the groups WS.</> },
            { name: 'SubscriptionContext', description: <>Tier, status, plans, usage, trial countdown, upgrade modal control. <code>canAccess(feature)</code> is the consumer-facing predicate.</> },
            { name: 'TruthStreamContext', description: <>Local to the TruthStream page (mounted inside it). Owns view state (overview / queue / review / analysis / received / given) and deep-link sync.</> },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-services" title="Service layer (REST + WS)">
        <p>
          All network access goes through <code>src/services/</code>. Contexts
          and pages never call <code>fetch</code> directly. Most services
          implement: bearer-token auth, retry with exponential backoff (3
          attempts), input sanitization, and a small in-memory rate limiter
          for the noisy ones (journal: 20/min, TruthStream: 25/min).
        </p>
        <DevFieldList
          caption="src/services"
          rows={[
            { name: 'api.ts', description: 'Legacy auth endpoints (register/login). Some duplication with authApi.ts.' },
            { name: 'authApi.ts', description: 'verifyToken, refreshToken, logout. Retries with 500/1000/2000ms backoff.' },
            { name: 'journalApi.ts', description: 'Journal CRUD + search + analytics (premium). In-memory 5min cache.' },
            { name: 'truthStreamApi.ts', description: 'Profile, queue, reviews (received/given), analysis report, dialogue, milestones, questionnaire.' },
            { name: 'groupsApi.ts', description: 'Group CRUD, members, presence, insights, voting, data sharing, analysis trigger, public search.' },
            { name: 'chatApi.ts', description: 'Group chat REST counterpart to chatWebSocket — paginated fetch, pinned, search, presence.' },
            { name: 'chatCache.ts', description: 'Per-group in-memory message cache with 5-min staleness check.' },
            { name: 'groupsWebSocket.ts', description: 'Enterprise WS client: auto-reconnect with jitter, heartbeat, dead-conn detection, mobile lifecycle (pause on backgrounding), Phase 6a.5 visibility reporting via sendVisibility().' },
            { name: 'chatWebSocket.ts', description: 'Group-chat WS: messages, edits, deletes, reactions, typing, presence, mentions, plus @Dina events.' },
            { name: 'dinaService.ts / dinaStreamingService.ts', description: '@Dina chat helpers used inside group chat.' },
            { name: 'userApi.ts / userSearchApi.ts', description: 'Profile fetch/update and user search.' },
            { name: 'subscriptionApi.ts', description: 'Subscription status, plans, create (returns PayPal URL), approve, cancel, trial, usage.' },
            { name: 'pushApi.ts / notificationPreferencesApi.ts', description: 'Web Push subscribe/unsubscribe and per-channel preferences.' },
            { name: 'emailVerificationApi.ts', description: 'send/verify/resend verification email.' },
            { name: 'mirrorDashboard.ts', description: 'Dashboard aggregate (unread count, pending reviews, recent activity).' },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-components" title="Components">
        <p>
          Components live under <code>src/components/</code>, grouped by
          feature: <code>auth/</code>, <code>chat/</code>, <code>dashboard/</code>,
          <code>home/</code>, <code>install/</code>, <code>intake/</code>,
          <code>journal/</code>, <code>mirrorgroups/</code>, <code>notifications/</code>,
          <code>paywall/</code>, <code>three/</code>, <code>truthstream/</code>,
          <code>ui/</code>, <code>visualizers/</code>, and this branch's
          <code>dev/</code> tree.
        </p>
        <DevCallout kind="info" title="Routing protection lives in components/auth/">
          <code>RouteProtection.tsx</code> exports both{' '}
          <code>ProtectedRoute</code> (a route guard that redirects on
          failure) and <code>ConditionalRender</code> (a visibility gate
          that renders one of two children based on auth state). Use the
          right tool: routes get <code>ProtectedRoute</code>, UI fragments
          (banners, modals) get <code>ConditionalRender</code>.
        </DevCallout>
        <p>
          Three.js scenes under <code>components/three/</code> are the visual
          identity: <code>ZenGardenScene</code>, <code>ZenPondScene</code>,{' '}
          <code>ZenPondScene2</code>, <code>ZenBridgeScene</code>,{' '}
          <code>SakuraForestScene</code>, and the simple{' '}
          <code>BasicScene</code> for public pages.
        </p>
      </DevSubsection>

      <DevSubsection id="frontend-hooks" title="Hooks">
        <DevFieldList
          caption="src/hooks"
          rows={[
            { name: 'useFaceApi', description: <>Loads face-api models lazily, caches them in IndexedDB, exposes a <code>detectAll()</code> function. Returns <code>{`{ ready, error, detectAll }`}</code>.</> },
            { name: 'useInstallState', description: <>PWA install state: <code>canInstall</code>, <code>isInstalled</code>, <code>promptInstall()</code>. Drives the InstallPrompt / IOSInstallTutorial / SafariNudge components.</> },
            { name: 'usePushSubscription', description: <>Manages browser Web Push registration. Listens for <code>pushsubscriptionchange</code> from the SW so the app can re-subscribe transparently.</> },
          ]}
        />
      </DevSubsection>

      <DevSubsection id="frontend-styling" title="Design system & styling">
        <p>
          Tailwind 4 + a custom glass-morphism layer. The visual identity is
          consistent across pages: a dark purple→blue→indigo gradient body
          with frosted glass cards over Three.js zen scenes.
        </p>
        <DevFieldList
          caption="Stylesheets"
          rows={[
            { name: 'tailwind.config.ts', description: <>Extends colors with a <code>glass.[5|10|20|30|40]</code> ramp for repeatable transparency tokens.</> },
            { name: 'styles/glass.css', description: '.glass-card, .glass-button, breathing animation, sakura gradient, basic glass tokens.' },
            { name: 'styles/enhanced-glass.css', description: 'Heavier blur, stronger borders for hero cards. Imports Poppins + Inter from Google Fonts.' },
            { name: 'styles/chat-glass.css', description: '1100+ lines of chat-specific styles (bubbles, reactions, DINA indicators).' },
            { name: 'styles/auth-glass.css', description: 'Auth-flow specific styles (login, register, verify, reset).' },
            { name: 'styles/pwa-shell.css', description: 'Safe-area insets, iOS quirks, a11y baseline, reduced-motion guards, print sanity.' },
          ]}
        />
        <DevCodeBlock
          language="css"
          caption="The canonical glass card recipe"
          code={`
background: rgba(255, 255, 255, 0.08-0.12);
backdrop-filter: blur(20-30px);
-webkit-backdrop-filter: blur(20-30px);
border: 1px solid rgba(255, 255, 255, 0.06-0.18);
border-radius: 12-24px;
box-shadow:
  0 8px 40px rgba(0, 0, 0, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.18);
          `}
        />
        <p>
          Typography pairs Poppins (headings, 600–700) with Inter (body,
          400–500). The app root applies the gradient:
        </p>
        <DevCodeBlock
          language="tsx"
          code={`
<div className="App min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
  {/* providers + routes */}
</div>
          `}
        />
      </DevSubsection>

      <DevSubsection id="frontend-pwa" title="PWA & service worker">
        <p>
          The PWA layer is intentionally non-aggressive: it does not
          auto-update, it does not precache models or asset blobs, and it
          will fall back to the network on every navigation if needed. All
          PWA assets live under the <code>/Mirror/</code> path.
        </p>
        <DevFieldList
          caption="PWA pipeline"
          rows={[
            { name: 'vite.config.ts → VitePWA', description: <>Strategy <code>injectManifest</code> (custom SW), <code>registerType: "prompt"</code>, manifest fields (name, theme #0d0c1f, icons, shortcuts to Journal/MyMirror/Groups/TruthStream). Precache excludes <code>/models/**</code>, <code>/images/iq/**</code>, <code>/assets/**</code>.</> },
            { name: 'src/sw.ts', description: <>Workbox precacheAndRoute + runtime caches (Assets/Models/IQ images as CacheFirst, Fonts as StaleWhileRevalidate, Mirror API GETs as NetworkFirst with 3s timeout). Push handler with smart suppression — if the user has the app foregrounded, the SW posts a message to the client instead of showing an OS notification.</> },
            { name: 'src/pwa.ts', description: <>Registration + manual update flow: listens for <code>updatefound</code>, dispatches <code>pwa:update-available</code>, UpdateBanner shows "Reload", banner posts <code>SKIP_WAITING</code>, SW calls skipWaiting, page reloads (one-time guard).</> },
            { name: 'components/UpdateBanner.tsx', description: 'The "new version ready — Reload" banner.' },
            { name: 'components/install/{InstallPrompt,IOSInstallTutorial,SafariNudge}', description: 'Platform-aware install nudges. Each self-suppresses when not applicable.' },
          ]}
        />
        <DevCallout kind="warning" title="Notification click URLs are sanitized">
          The service worker only honors same-origin URLs under{' '}
          <code>/Mirror/*</code> when a notification is clicked. Malicious
          payload URLs are dropped silently — the click falls back to{' '}
          <code>/Mirror/</code>. This is defense against a compromised push
          provider.
        </DevCallout>
      </DevSubsection>

      <DevSubsection id="frontend-build" title="Build, deploy, .htaccess">
        <DevCodeBlock
          language="bash"
          caption="package.json scripts"
          code={`
npm run dev       # vite (HTTPS proxy to mirror-server in dev)
npm run build     # tsc -b && vite build && cp .htaccess.template dist/.htaccess
npm run preview   # vite preview (production build, local)
npm run lint      # eslint .
npm run clean     # rm -rf dist
          `}
        />
        <p>
          <code>.htaccess.template</code> sets correct MIME for{' '}
          <code>.webmanifest</code>, marks hashed assets immutable, marks
          the service worker and <code>index.html</code> as{' '}
          <code>no-cache</code>, and rewrites unknown paths back to{' '}
          <code>index.html</code> for the SPA router. The base is{' '}
          <code>/Mirror/</code>.
        </p>
      </DevSubsection>
    </DevSection>
  );
};

export default Frontend;
