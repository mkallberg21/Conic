import { api } from './api';

export interface LoginDto { email: string; password: string; }
export interface RegisterDto { email: string; password: string; name: string; role: string; }

export async function login(dto: LoginDto) {
  const { data } = await api.post('/v1/auth/login', dto);
  return data.data;
}

export async function register(dto: RegisterDto) {
  const { data } = await api.post('/v1/auth/register', dto);
  return data.data;
}

export async function logout(refreshToken: string) {
  await api.post('/v1/auth/logout', { refreshToken });
}
