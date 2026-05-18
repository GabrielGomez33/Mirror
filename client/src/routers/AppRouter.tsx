// src/router/AppRouter.tsx
//
// CHANGES (Phase 0.3 — auth pipeline):
//   - Registered `/verify-email` so the email verification link no longer 404s.
//   - Registered `/forgot-password` and `/reset-password` so the "Forgot
//     password?" link on the login page no longer 404s.
//   - All new routes are PUBLIC by intent — the controllers enforce their
//     own auth/token rules. The verify-email and reset-password tokens are
//     the credentials.

import { Routes, Route, Navigate } from 'react-router-dom';

import Landing from '../pages/Landing';
import IntakeFlow from '../pages/IntakeFlow';
import Home from '../pages/Home';
import Dashboard from '../pages/Dashboard';
import LogUserIn from '../components/Login';
import RegistrationStep from '../components/intake/RegistrationStep';
import TestPage from '../pages/TestPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/home" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/login" element={<LogUserIn />} />
      <Route path="/register" element={<RegistrationStep />} />
      <Route path="/intake/*" element={<IntakeFlow />} />
      <Route path="/test" element={<TestPage />} />

      {/* Auth — email verification + forgotten password */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Catch-all — keep this last */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

export default AppRouter;
