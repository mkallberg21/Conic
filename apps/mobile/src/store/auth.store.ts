import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthUser } from '@/api/auth.api';
import { apiClient } from '@/api/client';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** True once the store has been hydrated from SecureStore on startup. */
  hydrated: boolean;
  setAuth: (payload: { accessToken: string; user: AuthUser }) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,

  setAuth({ accessToken, user }) {
    set({ accessToken, user });
  },

  setAccessToken(token) {
    set({ accessToken: token });
  },

  clearAuth() {
    set({ accessToken: null, user: null });
  },

  /**
   * Called once at app start — attempts a silent refresh using the persisted
   * refresh token so returning users are logged in automatically.
   */
  async hydrate() {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
      if (storedRefreshToken) {
        const res = await apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/refresh', {
          refreshToken: storedRefreshToken,
        });
        const { accessToken, user } = res.data;
        // Persist new refresh token if rotation occurred.
        if ((res.data as any).refreshToken) {
          await SecureStore.setItemAsync('refreshToken', (res.data as any).refreshToken);
        }
        set({ accessToken, user });
      }
    } catch {
      // Token expired or invalid — user will be shown the login screen.
      await SecureStore.deleteItemAsync('refreshToken').catch(() => {});
    } finally {
      set({ hydrated: true });
    }
  },
}));

// Hydrate on module load so the root layout can gate rendering.
useAuthStore.getState().hydrate();
