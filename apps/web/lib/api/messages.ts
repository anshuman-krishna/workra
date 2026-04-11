import type { CreateMessageInput, PublicMessage } from '@workra/shared';
import { apiFetch } from './client';

export interface MessageFilters {
  before?: string;
  limit?: number;
}

function buildQuery(filters: MessageFilters): string {
  const params = new URLSearchParams();
  if (filters.before) params.set('before', filters.before);
  if (filters.limit) params.set('limit', String(filters.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const messagesApi = {
  listForRoom: (roomId: string, filters: MessageFilters = {}) =>
    apiFetch<{ messages: PublicMessage[] }>(`/rooms/${roomId}/messages${buildQuery(filters)}`),

  send: (roomId: string, input: CreateMessageInput) =>
    apiFetch<{ message: PublicMessage }>(`/rooms/${roomId}/messages`, {
      method: 'POST',
      body: input,
    }),

  remove: (id: string) => apiFetch<void>(`/messages/${id}`, { method: 'DELETE' }),
};
