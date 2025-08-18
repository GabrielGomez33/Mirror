// src/utils/token.ts

export function setToken(token:string, typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
	    localStorage.setItem('mirror_jwt', token);
	}
	if(typeOfToken === 'refreshToken'){
		localStorage.setItem('refreshToken',token);
	}

}

export function getToken(typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
		return localStorage.getItem('mirror_jwt');
	}
	if(typeOfToken === 'refreshToken'){
		return localStorage.getItem('refreshToken');
	}
}  


export function clearToken(typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
		localStorage.removeItem('mirror_jwt');
	}	
	if(typeOfToken === 'refreshToken'){
		localStorage.removeItem('refreshToken');
	}
}
