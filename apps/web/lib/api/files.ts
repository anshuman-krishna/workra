import type { FileWithUrl, PublicFile } from '@workra/shared';
import { apiFetch } from './client';

export const filesApi = {
  listForRoom: (roomId: string) =>
    apiFetch<{ files: PublicFile[] }>(`/rooms/${roomId}/files`),

  upload: (roomId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<{ file: PublicFile }>(`/rooms/${roomId}/files`, {
      method: 'POST',
      body: form,
    });
  },

  get: (id: string) => apiFetch<{ file: FileWithUrl }>(`/files/${id}`),

  versions: (id: string) =>
    apiFetch<{ versions: PublicFile[] }>(`/files/${id}/versions`),

  remove: (id: string) => apiFetch<void>(`/files/${id}`, { method: 'DELETE' }),
};
