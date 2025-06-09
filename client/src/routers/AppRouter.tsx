// src/router/AppRouter.tsx

import {Routes, Route, Navigate} from 'react-router-dom';
import IntakeFlow from '../pages/IntakeFlow';
import Home from '../pages/Home';
import LogUserIn from '../components/Login';

const AppRouter = () => {
	return(
	
	  <Routes>
      	<Route path="/" element={<Navigate to="/home" />} />
      	<Route path="/home" element={<Home />} />
      	<Route path="/login" element={<LogUserIn />} />
      	<Route path="/intake/*" element={<IntakeFlow />} />
      	{/* Add more routes as needed */}
      </Routes>
		
	)
}

export default AppRouter
