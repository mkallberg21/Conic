import { useAuthStore } from '@/store/auth.store';
import { logout as apiLogout } from '@/lib/auth';

export function useAuth() {
  const { user, accessToken, setAuth, logout, refreshToken } = useAuthStore();

  const signOut = async () => {
    if (refreshToken) {
      try { await apiLogout(refreshToken); } catch { /* ignore */ }
    }
    logout();
  };

  return {
    user,
    isAuthenticated: !!accessToken,
    isLoading: false,
    setAuth,
    logout: signOut,
  };
}
