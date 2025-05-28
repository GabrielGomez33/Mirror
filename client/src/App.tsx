// src/App.tsx

import React from 'react'
import {BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Home from './pages/Home'
import Intake from './pages/Intake'
import Results from './pages/Results'
import Review from './pages/Review'

const App = () => {
  return(
  	<Router>
  	    <Routes>
  	    	<Route path="/" element={<Home /> } />
  	    	<Route path="/intake" element={<Intake /> } />
  	    	<Route path="/results" element={<Results /> } />
  	    	<Route path="/review" element={<Review /> } />
  	    </Routes>
  	</Router>
  )
}

export default App

