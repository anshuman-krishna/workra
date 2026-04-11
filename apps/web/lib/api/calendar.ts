import type {
  CreateEventInput,
  DashboardCalendarResponse,
  PublicEvent,
  RoomCalendarResponse,
} from '@workra/shared';
import { apiFetch } from './client';

export interface CalendarRange {
  from?: string;
  to?: string;
}

function buildRangeQuery(range: CalendarRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const calendarApi = {
  roomCalendar: (roomId: string, range: CalendarRange = {}) =>
    apiFetch<RoomCalendarResponse>(`/rooms/${roomId}/calendar${buildRangeQuery(range)}`),

  dashboardCalendar: (range: CalendarRange = {}) =>
    apiFetch<DashboardCalendarResponse>(`/users/me/calendar${buildRangeQuery(range)}`),
};

export const eventsApi = {
  listForRoom: (roomId: string, range: CalendarRange = {}) =>
    apiFetch<{ events: PublicEvent[] }>(`/rooms/${roomId}/events${buildRangeQuery(range)}`),

  create: (roomId: string, input: CreateEventInput) =>
    apiFetch<{ event: PublicEvent }>(`/rooms/${roomId}/events`, {
      method: 'POST',
      body: input,
    }),

  remove: (id: string) => apiFetch<void>(`/events/${id}`, { method: 'DELETE' }),
};
