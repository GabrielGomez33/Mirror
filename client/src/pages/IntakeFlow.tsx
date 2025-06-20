// src/pages/IntakeFlow.tsx (or wherever this file is located)
import { Routes, Route, Navigate } from 'react-router-dom';
import { IntakeProvider } from '../context/IntakeContext'; // Fix the import path
import PersonalityStep from '../components/intake/PersonalityStep';
import AstrologicalStep from '../components/intake/AstroLogicalStep';
import ResultsStep from '../components/intake/ResultsStep';
// Import other steps as needed
import IQStep from '../components/intake/IQStep';
import VisualStep from '../components/intake/VisualStep';
import VocalStep from '../components/intake/VocalStep';
import SubmitStep from '../components/intake/SubmitStep';
import RegistrationStep from '../components/intake/RegistrationStep';

const IntakeFlow = () => {
  return (
    <IntakeProvider>
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
    </IntakeProvider>
  );
};

export default IntakeFlow;
