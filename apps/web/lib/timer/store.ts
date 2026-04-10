import { create } from 'zustand';
import type { PublicSession } from '@workra/shared';

interface TimerState {
  active: PublicSession | null;
  hydrated: boolean;
  setActive: (session: PublicSession | null) => void;
  setHydrated: (hydrated: boolean) => void;
  clear: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  active: null,
  hydrated: false,
  setActive: (active) => set({ active }),
  setHydrated: (hydrated) => set({ hydrated }),
  clear: () => set({ active: null }),
}));
