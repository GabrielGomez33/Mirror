// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import { IntakeProvider } from './context/IntakeContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import IntakeFlow from './pages/IntakeFlow'
import Results from './pages/Results'
import Review from './pages/Review'
import LogUserIn from './components/Login'
import GlobalDashboard from './components/dashboard/GlobalDashboard'

const App = () => {
  return (
    <IntakeProvider>
      <div className="App">
        {/* Global Dashboard - appears on every page */}
        <GlobalDashboard />
        
        {/* Main routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<LogUserIn />} />
          <Route path="/intake/*" element={<IntakeFlow />} />
          <Route path="/results" element={<Results />} />
          <Route path="/review" element={<Review />} />
        </Routes>
      </div>
    </IntakeProvider>
  )
}

export default App
