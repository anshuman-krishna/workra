import type { PublicRoom, CreateRoomInput, JoinRoomInput, RoomInvite } from '@workra/shared';
import { apiFetch } from './client';

export const roomsApi = {
  list: () => apiFetch<{ rooms: PublicRoom[] }>('/rooms'),

  create: (input: CreateRoomInput) =>
    apiFetch<{ room: PublicRoom }>('/rooms', { method: 'POST', body: input }),

  join: (input: JoinRoomInput) =>
    apiFetch<{ room: PublicRoom }>('/rooms/join', { method: 'POST', body: input }),

  get: (id: string) => apiFetch<{ room: PublicRoom }>(`/rooms/${id}`),

  getInvite: (id: string) => apiFetch<{ invite: RoomInvite }>(`/rooms/${id}/invite`),
};
