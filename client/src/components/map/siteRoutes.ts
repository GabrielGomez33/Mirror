/**
 * Mirror site routes — the single source of truth for the /map page.
 *
 * Each node carries:
 *  - path      : the actual route (or a category placeholder).
 *  - title     : human-friendly label.
 *  - status    : 'live' (wired into App.tsx), 'planned' (mapped here for the
 *                  product roadmap but not yet implemented), or 'dev-only'
 *                  (testing routes, not part of production navigation).
 *  - category  : drives the color band in the tree visualization.
 *  - glyph     : single-char terminal icon shown inside the node card.
 *  - access    : what the route requires (anonymous, JWT, intake, premium).
 *  - description: one-line summary rendered on hover/focus and in the
 *                  mobile list view.
 *  - children  : sub-routes that hang off this node. For category nodes
 *                  the path is a label, not a real route.
 *
 * Order of children controls rendering order in both the desktop tree
 * and the mobile list.
 */

export type RouteStatus = 'live' | 'planned' | 'dev-only';

export type RouteCategory =
  | 'root'
  | 'public'
  | 'auth'
  | 'app'
  | 'personal'
  | 'meta';

export type RouteAccess =
  | 'anonymous'
  | 'token'
  | 'jwt'
  | 'jwt+intake'
  | 'jwt+tier2'
  | 'premium'
  | 'admin';

export interface RouteNode {
  path: string;
  title: string;
  status: RouteStatus;
  category: RouteCategory;
  glyph: string;
  access?: RouteAccess;
  description?: string;
  /** If true, the path is a label (e.g. "public/") rather than a navigable URL. */
  isCategory?: boolean;
  children?: RouteNode[];
}

export const SITE_ROOT: RouteNode = {
  path: '/',
  title: 'Mirror',
  status: 'live',
  category: 'root',
  glyph: '~',
  description: 'Application root. IntakeGate routes here based on auth + intake state.',
  children: [
    // ───── public/ ─────────────────────────────────────────────────────
    {
      path: 'public/',
      title: 'public',
      status: 'live',
      category: 'public',
      glyph: '#',
      isCategory: true,
      description: 'Unauthenticated routes. Marketing, sign-in, password reset.',
      children: [
        {
          path: '/home',
          title: 'Home',
          status: 'live',
          category: 'public',
          glyph: '*',
          access: 'anonymous',
          description: 'Public landing with rotating Three.js scene and CTAs to login/register.',
        },
        {
          path: '/landing',
          title: 'Landing',
          status: 'live',
          category: 'public',
          glyph: '*',
          access: 'anonymous',
          description: 'Alternate marketing landing variant.',
        },
        {
          path: '/test',
          title: 'Test playground',
          status: 'dev-only',
          category: 'public',
          glyph: '!',
          access: 'anonymous',
          description: 'Dev-only Three.js + UI playground. Not linked from production navigation.',
        },
      ],
    },

    // ───── auth/ ───────────────────────────────────────────────────────
    {
      path: 'auth/',
      title: 'auth',
      status: 'live',
      category: 'auth',
      glyph: '@',
      isCategory: true,
      description: 'Sign-in, registration, email verification, password reset.',
      children: [
        {
          path: '/login',
          title: 'Login',
          status: 'live',
          category: 'auth',
          glyph: '>',
          access: 'anonymous',
          description: 'Email + password sign-in. Redirects authenticated users to /dashboard.',
        },
        {
          path: '/register',
          title: 'Register',
          status: 'live',
          category: 'auth',
          glyph: '+',
          access: 'anonymous',
          description: 'Account creation. Wraps the RegistrationStep used inside intake.',
        },
        {
          path: '/forgot-password',
          title: 'Forgot password',
          status: 'live',
          category: 'auth',
          glyph: '?',
          access: 'anonymous',
          description: 'Request a reset email. Generic success copy avoids account enumeration.',
        },
        {
          path: '/reset-password',
          title: 'Reset password',
          status: 'live',
          category: 'auth',
          glyph: '~',
          access: 'token',
          description: 'Consume a reset token and set a new password. All sessions revoked on success.',
        },
        {
          path: '/verify-email',
          title: 'Verify email',
          status: 'live',
          category: 'auth',
          glyph: '=',
          access: 'token',
          description: 'Email verification landing. Reads token from query and POSTs to /auth/verify-email.',
        },
      ],
    },

    // ───── app/ — authenticated core ───────────────────────────────────
    {
      path: 'app/',
      title: 'app',
      status: 'live',
      category: 'app',
      glyph: '$',
      isCategory: true,
      description: 'Authenticated core. Dashboard hub, intake flow, journal, groups.',
      children: [
        {
          path: '/dashboard',
          title: 'Dashboard',
          status: 'live',
          category: 'app',
          glyph: '⌂',
          access: 'jwt',
          description: 'Magical-sphere navigation hub. Routes to journal, mymirror, groups, truthstream.',
        },
        {
          path: '/intake/*',
          title: 'Intake flow',
          status: 'live',
          category: 'app',
          glyph: '>',
          access: 'jwt',
          description: 'Multi-step intake. Real order: Visual → Vocal → IQ → Astrology → Personality → Submit → Results.',
          children: [
            {
              path: '/intake/visual',
              title: 'Visual',
              status: 'live',
              category: 'app',
              glyph: '1',
              access: 'jwt',
              description: 'Step 1 — camera / upload + face-api landmarks, emotions, descriptor.',
            },
            {
              path: '/intake/vocal',
              title: 'Vocal',
              status: 'live',
              category: 'app',
              glyph: '2',
              access: 'jwt',
              description: 'Step 2 — MediaRecorder audio capture with metadata.',
            },
            {
              path: '/intake/iq',
              title: 'IQ',
              status: 'live',
              category: 'app',
              glyph: '3',
              access: 'jwt',
              description: 'Step 3 — timed visual-reasoning puzzles, percentile against internal norm.',
            },
            {
              path: '/intake/astrology',
              title: 'Astrology',
              status: 'live',
              category: 'app',
              glyph: '4',
              access: 'jwt',
              description: 'Step 4 — western + chinese + african + numerology synthesis. Client-side computation.',
            },
            {
              path: '/intake/personality',
              title: 'Personality',
              status: 'live',
              category: 'app',
              glyph: '5',
              access: 'jwt',
              description: 'Step 5 — Big-5 Likert items; MBTI inferred from scores.',
            },
            {
              path: '/intake/submit',
              title: 'Submit',
              status: 'live',
              category: 'app',
              glyph: '6',
              access: 'jwt',
              description: 'Step 6 — review, POST /mirror/api/intake/store with retry/backoff.',
            },
            {
              path: '/intake/results',
              title: 'Results',
              status: 'live',
              category: 'app',
              glyph: '7',
              access: 'jwt',
              description: 'Step 7 — summary of the just-completed intake; primary CTA returns to /dashboard.',
            },
          ],
        },
        {
          path: '/journal',
          title: 'Journal',
          status: 'live',
          category: 'app',
          glyph: '✎',
          access: 'jwt',
          description: 'Dedicated journal editor + list. Auto-save with offline cache.',
        },
        {
          path: '/groups',
          title: 'Groups',
          status: 'live',
          category: 'app',
          glyph: '%',
          access: 'jwt',
          description: 'MirrorGroups directory, chat overlay, voting. End-to-end encrypted at rest.',
        },
      ],
    },

    // ───── personal/ — intake-required ─────────────────────────────────
    {
      path: 'personal/',
      title: 'personal',
      status: 'live',
      category: 'personal',
      glyph: '&',
      isCategory: true,
      description: 'Intake-required. Truth-mirror report, peer review pipeline.',
      children: [
        {
          path: '/mymirror',
          title: 'MyMirror',
          status: 'live',
          category: 'personal',
          glyph: '◉',
          access: 'jwt+intake',
          description: 'Personal truth-mirror report. Perception-gap visualization, growth narrative.',
        },
        {
          path: '/truthstream',
          title: 'TruthStream',
          status: 'live',
          category: 'personal',
          glyph: '◈',
          access: 'jwt+intake',
          description: 'Peer review hub. Supports ?view= and ?reviewId= deep links.',
        },
        {
          path: '/results',
          title: 'Results',
          status: 'live',
          category: 'personal',
          glyph: '◇',
          access: 'jwt+tier2',
          description: 'Detailed intake analysis (Tier-2 access).',
        },
        {
          path: '/review',
          title: 'Review',
          status: 'live',
          category: 'personal',
          glyph: '?',
          access: 'jwt+tier2',
          description: 'Reserved; minimal stub. Future review/feedback surface.',
        },
      ],
    },

    // ───── meta/ — documentation + legal ───────────────────────────────
    {
      path: 'meta/',
      title: 'meta',
      status: 'live',
      category: 'meta',
      glyph: '?',
      isCategory: true,
      description: 'Documentation, site map, legal. Same auth tier as the rest of the app.',
      children: [
        {
          path: '/dev',
          title: 'Dev docs',
          status: 'live',
          category: 'meta',
          glyph: '§',
          access: 'jwt',
          description: 'Developer documentation. A-to-Z reference for client, mirror-server, and dina-server.',
        },
        {
          path: '/map',
          title: 'Site map',
          status: 'live',
          category: 'meta',
          glyph: '☷',
          access: 'jwt',
          description: 'This page. Visual tree of every route in Mirror.',
        },
        {
          path: '/termsandconditions',
          title: 'Terms & conditions',
          status: 'live',
          category: 'meta',
          glyph: '¶',
          access: 'anonymous',
          description: 'Legal terms governing use of Mirror, MirrorGroups, and TruthStream. v1.0 — pending attorney review.',
        },
      ],
    },
  ],
};

/** Helper: collect every node (depth-first) for search / counters / a11y. */
export function flattenRoutes(node: RouteNode = SITE_ROOT): RouteNode[] {
  const out: RouteNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      out.push(...flattenRoutes(child));
    }
  }
  return out;
}

/** Tone classes — kept in this module so MapNode and SiteMap stay aligned. */
export const CATEGORY_ACCENT: Record<RouteCategory, string> = {
  root:     'var(--dt-amber)',
  public:   'var(--dt-green)',
  auth:     'var(--dt-cyan)',
  app:      'var(--dt-cyan)',
  personal: 'var(--dt-magenta)',
  meta:     'var(--dt-amber)',
};

export const CATEGORY_DIM: Record<RouteCategory, string> = {
  root:     'var(--dt-amber-dim)',
  public:   'var(--dt-green-dim)',
  auth:     'var(--dt-cyan-dim)',
  app:      'var(--dt-cyan-dim)',
  personal: 'var(--dt-magenta-dim)',
  meta:     'var(--dt-amber-dim)',
};