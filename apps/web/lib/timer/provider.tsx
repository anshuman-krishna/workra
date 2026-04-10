'use client';

import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@/lib/api/sessions';
import { useAuthStore } from '@/lib/auth/store';
import { useTimerStore } from './store';

const POLL_INTERVAL_MS = 20_000;

export function TimerProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setActive = useTimerStore((s) => s.setActive);
  const setHydrated = useTimerStore((s) => s.setHydrated);

  const { data } = useQuery({
    queryKey: ['session', 'active'],
    queryFn: () => sessionsApi.active(),
    enabled: Boolean(user),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (data !== undefined) {
      setActive(data.session);
      setHydrated(true);
    }
  }, [data, setActive, setHydrated]);

  return <>{children}</>;
}
