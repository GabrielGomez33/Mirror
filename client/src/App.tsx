// src/App.tsx

import { Routes, Route } from 'react-router-dom'
import { IntakeProvider } from './context/IntakeContext'

import Home from './pages/Home'
import IntakeFlow from './pages/IntakeFlow'
import Results from './pages/Results'
import Review from './pages/Review'
import LogUserIn from './components/Login' // ✅ NEW

const App = () => {
  return (
    <IntakeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LogUserIn />} /> {/* ✅ Top-level route */}
        <Route path="/intake/*" element={<IntakeFlow />} />
        <Route path="/results" element={<Results />} />
        <Route path="/review" element={<Review />} />
      </Routes>
    </IntakeProvider>
  )
}

export default App
