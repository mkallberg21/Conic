import { apiClient } from './client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'BRAND' | 'CREATOR' | 'AGENCY' | 'ADMIN' | 'ATHLETE' | 'GUARDIAN' | 'AGENT';
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>('/auth/login', { email, password });
    return data;
  },

  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'BRAND' | 'CREATOR';
  }): Promise<void> {
    await apiClient.post('/auth/register', payload);
  },

  async refreshToken(refreshToken: string): Promise<Pick<AuthTokens, 'accessToken' | 'user'>> {
    const { data } = await apiClient.post<Pick<AuthTokens, 'accessToken' | 'user'>>(
      '/auth/refresh',
      { refreshToken },
    );
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  },
};
