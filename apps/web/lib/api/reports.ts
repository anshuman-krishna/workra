import type { AiSummaryResponse, ReportResponse } from '@workra/shared';
import { apiFetch, ApiError, API_URL } from './client';
import { useAuthStore } from '../auth/store';

export interface ReportFilters {
  from: string;
  to: string;
  userId?: string;
  // iana timezone the browser is currently in. sent so the server can align daily
  // buckets with the user's calendar instead of utc.
  tz?: string;
}

function buildQuery(filters: ReportFilters, format: 'json' | 'pdf'): string {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.tz) params.set('tz', filters.tz);
  params.set('format', format);
  return `?${params.toString()}`;
}

export const reportsApi = {
  getRoomReport: (roomId: string, filters: ReportFilters) =>
    apiFetch<{ report: ReportResponse }>(
      `/rooms/${roomId}/report${buildQuery(filters, 'json')}`,
    ),

  // ask the server to regenerate the narrative with the ai layer. the backend
  // still rebuilds the report server-side so the narrative can't drift from the
  // numbers. the response flag tells us whether the llm actually answered.
  enhanceNarrative: (roomId: string, filters: ReportFilters) =>
    apiFetch<AiSummaryResponse>(`/rooms/${roomId}/report/ai-summary`, {
      method: 'POST',
      body: {
        from: filters.from,
        to: filters.to,
        userId: filters.userId,
        tz: filters.tz,
      },
    }),

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

// tiny helper: current ianatz from the browser. guarded so ssr/prerender never
// crashes if Intl isn't available for some reason.
export function browserTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
