import { create } from 'zustand';
import type { PublicUser } from '@workra/shared';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  hydrated: boolean;
  setSession: (user: PublicUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setHydrated: (hydrated: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  setSession: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setHydrated: (hydrated) => set({ hydrated }),
  clear: () => set({ user: null, accessToken: null }),
}));
