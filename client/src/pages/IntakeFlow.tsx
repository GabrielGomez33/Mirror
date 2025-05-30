// src/pages/IntakeFlow.tsx

import { Routes, Route } from 'react-router-dom'
import WelcomeStep from '../components/intake/WelcomeStep'
import VisualStep from '../components/intake/VisualStep'
import VocalStep from '../components/intake/VocalStep'
import PersonalityStep from '../components/intake/PersonalityStep'
import SubmitStep from '../components/intake/SubmitStep'

const IntakeFlow = () => {
  return (
    <Routes>
      <Route path="welcome" element={<WelcomeStep />} />
      <Route path="visual" element={<VisualStep />} />
      <Route path="vocal" element={<VocalStep />} />
      <Route path="personality" element={<PersonalityStep />} />
      <Route path="submit" element={<SubmitStep />} />
    </Routes>
  )
}

export default IntakeFlow
