import type { PublicUser, SignupInput, LoginInput } from '@workra/shared';
import { apiFetch } from './client';

interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export const authApi = {
  signup: (input: SignupInput) =>
    apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body: input, auth: false }),

  login: (input: LoginInput) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false }),

  refresh: () =>
    apiFetch<AuthResponse>('/auth/refresh', { method: 'POST', auth: false, skipRefresh: true }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST', auth: false }),

  me: () => apiFetch<{ user: PublicUser }>('/users/me'),
};
