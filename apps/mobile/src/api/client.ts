import axios, { AxiosError, AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/auth.store';

const BASE_URL =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.['apiUrl'] ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:4000';

/** Shared Axios instance with JWT + auto-refresh interceptors. */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — silent token refresh on 401 ──────────────────────
let refreshing: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshing) {
      refreshing = (async () => {
        const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!storedRefreshToken) throw new Error('No refresh token');

        const res = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
        );
        const { accessToken, refreshToken: newRefreshToken } = res.data;
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        useAuthStore.getState().setAccessToken(accessToken);
        return accessToken;
      })().finally(() => {
        refreshing = null;
      });
    }

    try {
      const newToken = await refreshing;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      const { clearAuth } = useAuthStore.getState();
      await SecureStore.deleteItemAsync('refreshToken');
      clearAuth();
      return Promise.reject(error);
    }
  },
);
