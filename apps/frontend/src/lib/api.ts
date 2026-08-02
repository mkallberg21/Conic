import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Read the token from the store, falling back to persisted storage. The store
// rehydrates asynchronously on a fresh page load, so early requests (fired
// before hydration completes) would otherwise go out tokenless → 401 → logout →
// bounce to /login. The localStorage fallback closes that race.
function currentAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken;
  if (fromStore) return fromStore;
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('conic-auth') || '{}')?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = currentAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1/auth/refresh`, { refreshToken });
        useAuthStore.getState().setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);
