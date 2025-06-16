// client/src/services/api.ts

import {setToken} from '../utils/token';

const BASE_URL = import.meta.env.VITE_API_URL

export async function registerUser(data: {username: string, email:string, password:string }){
	console.log('FUNCTION: registerUser');
	const res = await fetch(`${BASE_URL}/mirror/api/auth/register`,{
		method:'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(data),
		credentials: 'include'
	});


	if(!res.ok){
		throw new Error((await res.json()).error || 'Registration failed');
	}

	return res.json();
}

export async function loginUser(data:{email:string,password:string}){
	console.log('FUNCTION: loginUser');
	const res = await fetch(`${BASE_URL}/mirror/api/auth/login`,{
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(data),
		credentials: 'include'
	});

	

	if(!res.ok){
		throw new Error((await res.json()).error || 'Login FAILED');
	}
	const resJson = await res.json();
	console.log(resJson);	
	setToken(resJson.token);
	return resJson;
}
