'use client';

import { useEffect, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuthStore } from './store';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.refresh();
        if (!cancelled) setSession(res.user, res.accessToken);
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status !== 401) {
          console.warn('auth hydration failed', err);
        }
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSession, setHydrated, clear]);

  return <>{children}</>;
}
