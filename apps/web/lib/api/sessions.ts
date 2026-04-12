import type {
  PublicSession,
  SessionStat,
  StartSessionInput,
  StopSessionInput,
  SuggestSessionSummaryResponse,
} from '@workra/shared';
import { apiFetch } from './client';

export interface SessionFilters {
  from?: string;
  to?: string;
  userId?: string;
  hasSummary?: boolean;
  limit?: number;
}

function buildQuery(filters: SessionFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.hasSummary !== undefined) params.set('hasSummary', String(filters.hasSummary));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const sessionsApi = {
  start: (input: StartSessionInput) =>
    apiFetch<{ session: PublicSession }>('/sessions/start', { method: 'POST', body: input }),

  stop: (input: StopSessionInput) =>
    apiFetch<{ session: PublicSession }>('/sessions/stop', { method: 'POST', body: input }),

  active: () => apiFetch<{ session: PublicSession | null }>('/sessions/active'),

  suggestSummary: (elapsedMs?: number) =>
    apiFetch<SuggestSessionSummaryResponse>('/sessions/active/suggest-summary', {
      method: 'POST',
      body: elapsedMs !== undefined ? { elapsedMs } : {},
    }),

  listForRoom: (roomId: string, filters: SessionFilters = {}) =>
    apiFetch<{ sessions: PublicSession[] }>(`/rooms/${roomId}/sessions${buildQuery(filters)}`),

  statsForRoom: (roomId: string) =>
    apiFetch<{ stats: SessionStat[] }>(`/rooms/${roomId}/session-stats`),
};
