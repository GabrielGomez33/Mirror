// src/App.tsx

//import React from 'react'
import {Routes, Route } from 'react-router-dom'
import {IntakeProvider} from './context/IntakeContext'

import Home from './pages/Home'
import IntakeFlow from './pages/IntakeFlow'
import Results from './pages/Results'
import Review from './pages/Review'


const App = () => {
  return(
  	
  		<IntakeProvider>
  	    <Routes>
  	    	<Route path="/" element={<Home /> } />
  	    	<Route path="/intake/*" element={<IntakeFlow /> } />
  	    	<Route path="/results" element={<Results /> } />
  	    	<Route path="/review" element={<Review /> } />
  	    </Routes>
  	    </IntakeProvider>
  	
  )
}

export default App

