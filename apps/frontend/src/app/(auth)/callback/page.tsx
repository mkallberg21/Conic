'use client';

/**
 * OAuth Callback Page
 *
 * The backend redirects here after a successful Google OAuth login.
 * Tokens are delivered in the URL FRAGMENT (#accessToken=...&refreshToken=...)
 * — NOT query params — so they are never sent to a server in Referer headers
 * and are not recorded in access logs.
 *
 * This page:
 *  1. Reads window.location.hash on mount
 *  2. Parses the token pair
 *  3. Stores them in Zustand (persisted to localStorage)
 *  4. Replaces history to clear the hash
 *  5. Redirects to the dashboard
 *
 * On any error it redirects to /login with a descriptive message.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const processed = useRef(false); // prevent double-invocation in React StrictMode

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      const hash = window.location.hash.slice(1); // strip leading '#'

      if (!hash) {
        router.replace('/login?error=oauth_missing_tokens');
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      // Immediately clear the fragment — tokens must not sit in the address bar
      window.history.replaceState(null, '', window.location.pathname);

      if (!accessToken || !refreshToken) {
        router.replace('/login?error=oauth_invalid_tokens');
        return;
      }

      try {
        // Fetch the authenticated user profile using the new access token
        const { data } = await api.get('/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        setAuth(data.data, accessToken, refreshToken);
        router.replace('/');
      } catch {
        // Token may be malformed or expired — force a fresh login
        router.replace('/login?error=oauth_fetch_failed');
      }
    };

    void handleCallback();
  }, [router, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
