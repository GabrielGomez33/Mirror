// src/utils/token.ts

export type StoredUserInfo = {
  userId: number;
  username: string;
  email: string;
  lastLogin?: string;
};

export function setToken(token:string, typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
	    localStorage.setItem('mirror_jwt', token);
	}
	if(typeOfToken === 'refreshToken'){
		localStorage.setItem('refreshToken',token);
	}
	if(typeOfToken === 'userInfo'){
		localStorage.setItem('userInfo', token);
	}

}

export function getToken(typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
		return localStorage.getItem('mirror_jwt');
	}
	if(typeOfToken === 'refreshToken'){
		return localStorage.getItem('refreshToken');
	}
	if(typeOfToken === 'userInfo'){
		return localStorage.getItem('userInfo');
	}
}  


export function clearToken(typeOfToken:string = 'mirror_jwt'){
	if(typeOfToken === 'mirror_jwt'){
		localStorage.removeItem('mirror_jwt');
	}	
	if(typeOfToken === 'refreshToken'){
		localStorage.removeItem('refreshToken');
	}
	if(typeOfToken === 'userInfo'){
		localStorage.removeItem('userInfo');
	}
}

export function getUserInfo(): StoredUserInfo | null {
  const raw = getToken('userInfo'); // existing function that returns string | null
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Handle userId as either string or number from API
    const userId = Number(parsed?.userId);
    if (!isNaN(userId) && userId > 0) {
      return { ...parsed, userId } as StoredUserInfo;
    }
    return null;
  } catch {
    return null;
  }
}
