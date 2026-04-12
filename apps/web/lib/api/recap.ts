import type { DailyRecapResponse } from '@workra/shared';
import { apiFetch } from './client';

export const recapApi = {
  // the backend keys everything off the caller's tz, so we pass the browser's
  // iana name along on every request.
  today: (tz?: string) => {
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    return apiFetch<{ recap: DailyRecapResponse }>(`/users/me/daily-recap${qs}`);
  },
};
