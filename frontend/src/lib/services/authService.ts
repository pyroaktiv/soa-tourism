import { apiClient } from '../api';
import { setAuthData, clearAuthData } from '../auth';
import type { LoginRequest, RegisterRequest, AuthResponse, ListUsersResponse } from '@/types/tourism/auth/v1/auth';

export async function loginUser(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  const authData = response.data;
  
  if (authData.tokens && authData.user) {
    setAuthData(authData.tokens.accessToken, authData.tokens.refreshToken, authData.user);
  }
  return authData;
}

export async function registerUser(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data);
  const authData = response.data;
  
  if (authData.tokens && authData.user) {
    setAuthData(authData.tokens.accessToken, authData.tokens.refreshToken, authData.user);
  }
  return authData;
}

export async function logoutUser(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (e) {
      console.error("Logout error", e);
    }
  }
  clearAuthData();
  window.location.href = '/login';
}

export async function listUsers(pageSize: number, pageNumber: number): Promise<ListUsersResponse> {
  // Napomena: gRPC gateway obično konvertuje snake_case u camelCase za query parametre, 
  // ali parsira i jedno i drugo. Koristićemo pageSize i pageNumber.
  const response = await apiClient.get<ListUsersResponse>('/auth/users', {
    params: { pageSize, pageNumber }
  });
  return response.data;
}

export async function blockUser(userId: string): Promise<void> {
  await apiClient.post('/auth/block', { userId });
}