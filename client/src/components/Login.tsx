// src/components/Login.tsx

import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useIntake} from '../context/IntakeContext';
import {loginUser} from '../services/api';

const LogUserIn = () =>{
	const navigate = useNavigate();
	const {updateIntake} = useIntake();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');
	const [loading, setLoading] = useState(false);
		
	
	const handleSubmit = async (e:React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage('');

		try {
			const result = await loginUser({email, password});
			console.log(result);			
			updateIntake({userLoggedIn:true});
			setMessage('LOGIN SUCCESSFUL: ');

			navigate('/home');

			
		}catch(err:any){
			setMessage('❌ ' + err.message);
			console.error('LOGIN FAILED: ', err);
		}finally{
			setLoading(false);
		}
		
		
	};

	return(
		<form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white/10 rounded-xl shadow-md max-w-md mx-auto">
		    <h2 className="text-xl font-bold text-white text-center">Log In</h2>		

		    <input
				type="text"
				placeholder="email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
				required
		     />

			 <input
				type="text"
				placeholder="password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				className="w-full p-2 rounded bg-gray-900 text-white border border-gray-600"
				required
			 />

			 <button
			    type="submit"
			    disabled={loading}
			    className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded w-full disabled:opacity-50"
			 >
				{loading ? 'Logging In': 'Log in'}
			 </button>

			 {message && <p className="text-white text-sm text-center">{message}</p>}	
		     
		</form>
	);
};



export default LogUserIn;
