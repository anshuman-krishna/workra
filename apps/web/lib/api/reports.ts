import type { ReportResponse } from '@workra/shared';
import { apiFetch, ApiError, API_URL } from './client';
import { useAuthStore } from '../auth/store';

export interface ReportFilters {
  from: string;
  to: string;
  userId?: string;
}

function buildQuery(filters: ReportFilters, format: 'json' | 'pdf'): string {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  if (filters.userId) params.set('userId', filters.userId);
  params.set('format', format);
  return `?${params.toString()}`;
}

export const reportsApi = {
  getRoomReport: (roomId: string, filters: ReportFilters) =>
    apiFetch<{ report: ReportResponse }>(
      `/rooms/${roomId}/report${buildQuery(filters, 'json')}`,
    ),

  // downloads the pdf as a blob. apiFetch is json-only so this goes direct.
  // errors are parsed as json when the server sent one (our error middleware always does).
  downloadRoomReportPdf: async (roomId: string, filters: ReportFilters): Promise<Blob> => {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(
      `${API_URL}/rooms/${roomId}/report${buildQuery(filters, 'pdf')}`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const err = (payload as { error?: { code?: string; message?: string } }).error;
      throw new ApiError(
        res.status,
        err?.code ?? 'unknown_error',
        err?.message ?? 'could not download report',
      );
    }
    return res.blob();
  },
};
