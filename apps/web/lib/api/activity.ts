import type { ActivityCategory, PublicActivity } from '@workra/shared';
import { apiFetch } from './client';

export interface ActivityFilters {
  category?: ActivityCategory;
  before?: string;
  limit?: number;
}

function buildQuery(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.before) params.set('before', filters.before);
  if (filters.limit) params.set('limit', String(filters.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const activityApi = {
  listForRoom: (roomId: string, filters: ActivityFilters = {}) =>
    apiFetch<{ activity: PublicActivity[] }>(`/rooms/${roomId}/activity${buildQuery(filters)}`),
};
