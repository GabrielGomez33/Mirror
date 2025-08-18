// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { IntakeProvider } from './context/IntakeContext';
import { ProtectedRoute, ConditionalRender } from './components/auth/RouteProtection';
import { AccessLevel, SecurityLevel } from './context/AuthContext';

// Import your existing pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import IntakeFlow from './pages/IntakeFlow';
import Results from './pages/Results';
import Review from './pages/Review';
import LogUserIn from './components/Login';
import Landing from './pages/Landing';
import TestPage from './pages/TestPage';
import GlobalDashboard from './components/dashboard/GlobalDashboard';

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
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/home" replace />} />
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
                  <IntakeFlow />
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
                    <a href="/" className="glass-button px-6 py-2 rounded-lg text-white hover:bg-white/10 transition-all">
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
