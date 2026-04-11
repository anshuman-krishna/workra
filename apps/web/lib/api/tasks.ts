import type {
  CreateTaskInput,
  PublicSession,
  PublicTask,
  UpdateTaskInput,
  TaskStatus,
} from '@workra/shared';
import { apiFetch } from './client';

export interface TaskFilters {
  status?: TaskStatus;
  assignedTo?: string;
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const tasksApi = {
  listForRoom: (roomId: string, filters: TaskFilters = {}) =>
    apiFetch<{ tasks: PublicTask[] }>(`/rooms/${roomId}/tasks${buildQuery(filters)}`),

  create: (roomId: string, input: CreateTaskInput) =>
    apiFetch<{ task: PublicTask }>(`/rooms/${roomId}/tasks`, { method: 'POST', body: input }),

  get: (id: string) => apiFetch<{ task: PublicTask }>(`/tasks/${id}`),

  update: (id: string, input: UpdateTaskInput) =>
    apiFetch<{ task: PublicTask }>(`/tasks/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),

  sessionsForTask: (id: string) =>
    apiFetch<{ sessions: PublicSession[] }>(`/tasks/${id}/sessions`),
};
