// src/services/userApi.ts
// User search and lookup API

import { getToken } from '../utils/token';

export interface SearchedUser {
  id: number;
  username: string;
}

export interface SearchUsersResponse {
  success: boolean;
  data?: {
    users: SearchedUser[];
    count: number;
    query: string;
  };
  error?: string;
}

export interface GetUserResponse {
  success: boolean;
  data?: {
    user: SearchedUser;
  };
  error?: string;
}

const API_BASE = '/mirror/api/users';

/**
 * Search users by username
 * Requires at least 2 characters
 */
export async function searchUsers(query: string, limit: number = 10): Promise<SearchUsersResponse> {
  if (!query || query.length < 2) {
    return { success: false, error: 'Query must be at least 2 characters' };
  }

  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });

    const response = await fetch(`${API_BASE}/search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Search failed: ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[UserAPI] Search error:', error);
    return {
      success: false,
      error: 'Failed to search users',
    };
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<GetUserResponse> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE}/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to get user: ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[UserAPI] Get user error:', error);
    return {
      success: false,
      error: 'Failed to get user',
    };
  }
}
