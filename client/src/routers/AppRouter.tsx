// src/router/AppRouter.tsx

import { Routes, Route, Navigate } from 'react-router-dom';

import Landing from '../pages/Landing';
import IntakeFlow from '../pages/IntakeFlow';
import Home from '../pages/Home';
import Dashboard from '../pages/Dashboard';
import LogUserIn from '../components/Login';
import TestPage from '../pages/TestPage';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/home" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/login" element={<LogUserIn />} />
      <Route path="/intake/*" element={<IntakeFlow />} />
      <Route path="/test" element={<TestPage />} />
      {/* Add more routes as needed */}
    </Routes>
  );
};

export default AppRouter;
