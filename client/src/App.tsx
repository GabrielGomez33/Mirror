// src/App.tsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { IntakeProvider } from './context/IntakeContext';
import IntakeErrorBoundary from './components/intake/IntakeErrorBoundary';
import { ProtectedRoute, ConditionalRender } from './components/auth/RouteProtection';
import { AccessLevel, SecurityLevel } from './context/AuthContext';

// Import your existing pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import IntakeFlow from './pages/IntakeFlow';
import Results from './pages/Results';
import Review from './pages/Review';
import LogUserIn from './components/Login';
import RegistrationStep from './components/intake/RegistrationStep';
import Landing from './pages/Landing';
import TestPage from './pages/TestPage';
import GlobalDashboard from './components/dashboard/GlobalDashboard';

// -----------------------------------------------------------------------------
// Config: prefer same-origin; honor VITE_API_URL if explicitly set
// -----------------------------------------------------------------------------
const ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = ROOT ? `${ROOT}/mirror/api` : '/mirror/api';

// -----------------------------------------------------------------------------
// IntakeGate: minimal, data-driven router at "/" using existing latest endpoint
//   - Success fetching latest intake -> /dashboard
//   - Any error (401/404/500/parse)  -> /intake
//   - No auth                        -> /login
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
        const userRaw = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');
        if (!userRaw || !token) {
          navigate('/login', { replace: true });
          return;
        }

        const user = JSON.parse(userRaw);
        const res = await fetch(`${API_BASE}/intake/latest/${user.id}`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // Any failure fetching latest -> send to intake to (re)start/continue
          navigate('/intake', { replace: true });
          return;
        }

        // Sanity parse; if empty/unexpected, treat as not-ready
        const json = await res.json().catch(() => null);
        if (json) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/intake', { replace: true });
        }
      } catch {
        navigate('/intake', { replace: true });
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <IntakeProvider>
        <div className="App min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          {/* Conditionally render Global Dashboard only for authenticated users */}
          <ConditionalRender condition="authenticated">
            <GlobalDashboard />
          </ConditionalRender>

          {/* Main Application Routes */}
          <Routes>
            {/* Root: let IntakeGate decide where to go */}
            <Route path="/" element={<IntakeGate />} />

            {/* Public Routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/test" element={<TestPage />} />

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
      </IntakeProvider>
    </AuthProvider>
  );
};

export default App;
