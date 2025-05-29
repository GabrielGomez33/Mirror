// src/pages/IntakeFlow.tsx

import { Routes, Route } from 'react-router-dom'
import WelcomeStep from '../components/intake/WelcomeStep'
import VisualStep from '../components/intake/VisualStep'
import VocalStep from '../components/intake/VocalStep'
// Add future steps here...

const IntakeFlow = () => {
  return (
    <Routes>
      <Route path="welcome" element={<WelcomeStep />} />
      <Route path="visual" element={<VisualStep />} />
      <Route path="vocal" element={<VocalStep />} />
      {/* Add more steps: vocal, personality, emotional, etc */}
    </Routes>
  )
}

export default IntakeFlow
