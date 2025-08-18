// src/pages/IntakeFlow.tsx - CORRECTED VERSION
import { Routes, Route, Navigate } from 'react-router-dom';
// Remove this line: import { IntakeProvider } from '../context/IntakeContext';
import PersonalityStep from '../components/intake/PersonalityStep';
import AstrologicalStep from '../components/intake/AstroLogicalStep';
import ResultsStep from '../components/intake/ResultsStep';
import IQStep from '../components/intake/IQStep';
import VisualStep from '../components/intake/VisualStep';
import VocalStep from '../components/intake/VocalStep';
import SubmitStep from '../components/intake/SubmitStep';
import RegistrationStep from '../components/intake/RegistrationStep';

const IntakeFlow = () => {
  return (
    // Remove IntakeProvider wrapper - it's already in App.tsx
    <Routes>
      <Route path="/" element={<Navigate to="/intake/personality" replace />} />
      <Route path="/personality" element={<PersonalityStep />} />
      <Route path="/astrology" element={<AstrologicalStep />} />
      <Route path="/iq" element={<IQStep />} />
      <Route path="/visual" element={<VisualStep />} />
      <Route path="/vocal" element={<VocalStep />} />
      <Route path="/register" element={<RegistrationStep />} />
      <Route path="/submit" element={<SubmitStep />} />
      <Route path="/results" element={<ResultsStep />} />
      <Route path="/complete" element={<ResultsStep />} />
    </Routes>
  );
};

export default IntakeFlow;
