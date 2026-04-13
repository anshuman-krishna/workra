import { apiFetch } from './client';

interface AdminStats {
  userCount: number;
  roomCount: number;
  sessionCount: number;
  membershipCount: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AdminRoom {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
}

export const adminApi = {
  stats: () => apiFetch<{ stats: AdminStats }>('/admin/stats'),
  users: (page = 1) => apiFetch<{ users: AdminUser[]; total: number; page: number; pages: number }>(`/admin/users?page=${page}`),
  rooms: (page = 1) => apiFetch<{ rooms: AdminRoom[]; total: number; page: number; pages: number }>(`/admin/rooms?page=${page}`),
};
