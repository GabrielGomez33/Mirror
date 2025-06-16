// src/utils/token.ts

export function setToken(token:string){
	localStorage.setItem('mirror_jwt', token);
}

export function getToken(){
	return localStorage.getItem('mirror_jwt');
}

export function clearToken(){
	localStorage.removeItem('mirror_jwt');
}
