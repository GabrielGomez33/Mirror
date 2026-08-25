// src/App.tsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { IntakeProvider } from './context/IntakeContext';
import { GroupProvider } from './context/GroupContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import IntakeErrorBoundary from './components/intake/IntakeErrorBoundary';
import { ProtectedRoute, ConditionalRender } from './components/auth/RouteProtection';
import ConsentGate from './components/auth/ConsentGate';
import { AccessLevel, SecurityLevel } from './context/AuthContext';

// Paywall UI components (global)
import UpgradeModal from './components/paywall/UpgradeModal';
import TrialBanner from './components/paywall/TrialBanner';
import PaymentFailedBanner from './components/paywall/PaymentFailedBanner';

// PWA: shown when a new service worker is installed and waiting to activate.
import UpdateBanner from './components/UpdateBanner';
// PWA Phase 5: install nudges. InstallPrompt covers Android/desktop one-tap;
// IOSInstallTutorial covers iOS (any browser); SafariNudge nudges iOS users
// in non-Safari browsers toward Safari (push delivery requires Safari-
// installed PWAs on iOS). All three self-suppress when not applicable.
import InstallPrompt from './components/install/InstallPrompt';
import IOSInstallTutorial from './components/install/IOSInstallTutorial';
import SafariNudge from './components/install/SafariNudge';

// Import your existing pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import IntakeFlow from './pages/IntakeFlow';
import Results from './pages/Results';
import Review from './pages/Review';
import LogUserIn from './components/Login';
import RegistrationStep from './components/intake/RegistrationStep';
import EntryIntakeFlow from './components/intake/entry/EntryIntakeFlow';
import Landing from './pages/Landing';
import TestPage from './pages/TestPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import StudentsPage from './pages/StudentsPage';
import StudentVerifyPage from './components/paywall/StudentVerifyPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailBanner from './components/auth/VerifyEmailBanner';
import GlobalDashboard from './components/dashboard/GlobalDashboard';
import MirrorGroupsPage from './pages/MirrorGroupsPage';
import TruthStreamPage from './pages/TruthStreamPage';
import MyJournalPage from './pages/MyJournalPage';
import MyMirrorPage from './pages/MyMirrorPage';
import DevPage from './pages/DevPage';
import MapPage from './pages/MapPage';
import TermsPage from './pages/TermsPage';
import FeedbackPage from './pages/FeedbackPage';
import { getResolvedIntake } from './services/intakeResolver';
import { getToken, getUserInfo } from './utils/token';

// -----------------------------------------------------------------------------
// IntakeGate: minimal, data-driven router at "/" using the unified resolver
//   - Success fetching latest intake -> /dashboard
//   - Any error (401/404/500/parse)  -> /entry  (fast onboarding front door)
//   - No auth                        -> /register
//
// The failure fallback goes to the fast ENTRY intake, not the heavy Core intake:
// a user with no resolvable latest intake has not completed onboarding, and
// /entry is the ~4-min day-one path in the two-tier model. RouteProtection's
// access gate then keeps established (core-complete) users out of /entry.
// -----------------------------------------------------------------------------
const IntakeGate: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only gate at root to avoid fighting with deep links
    if (location.pathname !== '/') {
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const info = getUserInfo();
        const token = getToken();
        if (!info?.userId || !token) {
          // Cold, logged-out visitors go to signup (the front door), not the
          // returning-user "Welcome Back" login.
          navigate('/register', { replace: true });
          return;
        }

        // Single unified resolver: merged Entry⊕Core (Core precedence). An
        // Entry-only user now resolves to their data and reaches the dashboard
        // instead of being bounced back into onboarding.
        const resolved = await getResolvedIntake(info.userId);
        if (resolved && resolved.intakeData && Object.keys(resolved.intakeData).length > 0) {
          navigate('/dashboard', { replace: true });
        } else {
          // No resolvable intake (neither Entry nor Core) -> fast onboarding.
          navigate('/entry', { replace: true });
        }
      } catch {
        // Auth/transport failure — send to onboarding; RouteProtection routes
        // established users onward once their token re-hydrates.
        navigate('/entry', { replace: true });
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-panel p-6 rounded-xl text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-3" />
        <p className="text-white/90">Checking your intake…</p>
      </div>
    </div>
  );
};

/**
 * VisibilityReporter — Phase 6a.5
 *
 * Reports the page's Page Visibility state to the server over the
 * existing groups WebSocket. The server uses this to decide whether
 * to send Web Push for a given user — if the user is currently
 * foregrounded (visible+focused), it skips push and relies on the
 * in-app WS notification instead. Without this, users get buzzed on
 * their device while the app is open in front of them.
 *
 * Mounted once at the app root. No UI. Self-contained side-effect
 * component that listens for visibilitychange + window focus/blur and
 * pushes the state through the WS. Sends one initial state on mount.
 */
const VisibilityReporter: React.FC = () => {
  React.useEffect(() => {
    let mounted = true;

    const computeState = (): 'visible' | 'hidden' => {
      if (typeof document === 'undefined') return 'visible';
      // Treat tab-hidden OR window-blurred as "hidden" — both mean the
      // user isn't actively looking at Mirror right now.
      if (document.visibilityState !== 'visible') return 'hidden';
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) return 'hidden';
      return 'visible';
    };

    const send = () => {
      if (!mounted) return;
      // Lazy import to keep the bundle untouched in test environments
      // and to avoid pulling the WS service before the auth flow has
      // wired anything up. groupsWebSocket auto-queues if not yet open.
      import('./services/groupsWebSocket')
        .then((mod) => mod.sendVisibility(computeState()))
        .catch(() => undefined);
    };

    // Initial report.
    send();

    document.addEventListener('visibilitychange', send);
    window.addEventListener('focus', send);
    window.addEventListener('blur', send);
    // pageshow fires after BFCache restore — visibility may have changed
    // while the page was frozen.
    window.addEventListener('pageshow', send);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', send);
      window.removeEventListener('focus', send);
      window.removeEventListener('blur', send);
      window.removeEventListener('pageshow', send);
    };
  }, []);

  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <IntakeProvider>
        <GroupProvider>
          <ChatProvider>
          <NotificationProvider>
          <SubscriptionProvider>
          <div className="App min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">

          {/* Paywall banners — shown globally for authenticated users */}
          <ConditionalRender condition="authenticated">
            {/* Email verification banner. Self-hides once verified, dismissible per-session. */}
            <VerifyEmailBanner />
            <TrialBanner />
            <PaymentFailedBanner />
          </ConditionalRender>

          {/* Conditionally render Global Dashboard only for authenticated users */}
          <ConditionalRender condition="authenticated">
            <GlobalDashboard />
          </ConditionalRender>

          {/* Terms re-acceptance backstop. Self-suppresses for unauthenticated
              users, on the Terms page, and when the consent endpoint is
              unavailable (fail-open). */}
          <ConsentGate />

          {/* Upgrade modal — rendered globally, triggered by FeatureGate or openUpgradeModal() */}
          <UpgradeModal />

          {/* PWA update banner — appears when a new SW has finished installing. */}
          <UpdateBanner />

          {/* PWA install nudges. Each component self-suppresses when its
              platform / install-state isn't applicable (already installed,
              wrong browser, dismissed-forever, etc.) so it's safe to mount
              all three globally. SafariNudge specifically targets non-Safari
              iOS users (the path-of-least-resistance to working push). */}
          <InstallPrompt />
          <IOSInstallTutorial />
          <SafariNudge />

          {/* Phase 6a.5: reports Page Visibility to the server so push
              delivery can skip foregrounded users. No UI. */}
          <VisibilityReporter />

          {/* Main Application Routes */}
          <Routes>
            {/* Root: let IntakeGate decide where to go */}
            <Route path="/" element={<IntakeGate />} />

            {/* Public Routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Student campus-email confirmation (public — emailed token is the credential) */}
            <Route path="/students/verify" element={<StudentVerifyPage />} />

            {/* Forgotten-password flow (public — token is the credential) */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Terms & Conditions — public; the registration checkbox links here. */}
            <Route path="/termsandconditions" element={<TermsPage />} />

            {/* Authentication Routes */}
            <Route
              path="/login"
              element={
                <ConditionalRender
                  condition="unauthenticated"
                  fallback={<Navigate to="/dashboard" replace />}
                >
                  <LogUserIn />
                </ConditionalRender>
              }
            />

            <Route
              path="/register"
              element={
                <ConditionalRender
                  condition="unauthenticated"
                  fallback={<Navigate to="/dashboard" replace />}
                >
                  <RegistrationStep />
                </ConditionalRender>
              }
            />

            {/* Protected Routes - Basic Authentication Required */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Students — claim/reverify free Premium (auth required; the claim
                turns a free user into premium, so it must NOT be premium-gated) */}
            <Route
              path="/students"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <StudentsPage />
                </ProtectedRoute>
              }
            />

            {/* Intake Flow - Requires Authentication */}
            <Route
              path="/intake/*"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <IntakeErrorBoundary>
                    <IntakeFlow />
                  </IntakeErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Entry ("initial") intake — the fast onboarding after signup */}
            <Route
              path="/entry"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <IntakeErrorBoundary>
                    <EntryIntakeFlow />
                  </IntakeErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Results - Requires Completed Intake */}
            <Route
              path="/results"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.INTAKE_REQUIRED}
                  securityLevel={SecurityLevel.TIER2_ACCESS}
                  customCheck={(user) => user?.intakeCompleted === true}
                  redirectTo="/intake"
                  errorMessage="Please complete the intake process to view results."
                >
                  <Results />
                </ProtectedRoute>
              }
            />

            {/* Review - Requires Completed Intake and Tier 2 Access */}
            <Route
              path="/review"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.INTAKE_REQUIRED}
                  securityLevel={SecurityLevel.TIER2_ACCESS}
                  customCheck={(user) => user?.intakeCompleted === true}
                  redirectTo="/intake"
                >
                  <Review />
                </ProtectedRoute>
              }
            />

            {/* MyJournal - Requires Authentication */}
            <Route
              path="/journal"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <MyJournalPage />
                </ProtectedRoute>
              }
            />

            {/* MyMirror — the self-reflection surface. Reachable after the fast
                ENTRY intake (not the full Core intake): its data comes from the
                merged read-model (Entry⊕Core), so an Entry-only user sees their
                preliminary Mirror and deepens Core at their own pace from here.
                Core-complete users trivially satisfy ENTRY_REQUIRED too. */}
            <Route
              path="/mymirror"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.ENTRY_REQUIRED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/entry"
                  errorMessage="Complete your quick intro to view your Mirror."
                >
                  <MyMirrorPage />
                </ProtectedRoute>
              }
            />

            {/* MirrorGroups - Requires Authentication */}
            <Route
              path="/groups"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <MirrorGroupsPage />
                </ProtectedRoute>
              }
            />

            {/* Developer documentation — authenticated, no intake required. */}
            <Route
              path="/dev"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <DevPage />
                </ProtectedRoute>
              }
            />

            {/* Site map — authenticated, no intake required. */}
            <Route
              path="/map"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <MapPage />
                </ProtectedRoute>
              }
            />

            {/* Feedback & Support — Requires Authentication only.
                Intentionally NOT gated by intake or subscription: a user must
                always be able to reach customer service. */}
            <Route
              path="/feedback"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.AUTHENTICATED}
                  securityLevel={SecurityLevel.BASIC}
                  redirectTo="/login"
                >
                  <FeedbackPage />
                </ProtectedRoute>
              }
            />

            {/* TruthStream - Requires Completed Intake */}
            <Route
              path="/truthstream"
              element={
                <ProtectedRoute
                  accessLevel={AccessLevel.INTAKE_REQUIRED}
                  securityLevel={SecurityLevel.BASIC}
                  customCheck={(user) => user?.intakeCompleted === true}
                  redirectTo="/intake"
                >
                  <TruthStreamPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all route */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="glass-panel p-8 rounded-xl text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">404 - Page Not Found</h1>
                    <p className="text-white/80 mb-4">The page you're looking for doesn't exist.</p>
                    <a
                      href="/"
                      className="glass-button px-6 py-2 rounded-lg text-white hover:bg-white/10 transition-all"
                    >
                      Go Home
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
          </div>
          </SubscriptionProvider>
          </NotificationProvider>
          </ChatProvider>
        </GroupProvider>
      </IntakeProvider>
    </AuthProvider>
  );
};

export default App;