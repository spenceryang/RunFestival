import { create } from 'zustand';
import type { CollectiveEvent } from '@/types/collective';

interface CollectiveStore {
  runnerCount: number;
  recentEvents: CollectiveEvent[];
  averagePaceSecondsPerKm: number;
  totalDistanceToday: number;

  setRunnerCount: (count: number) => void;
  addEvent: (event: CollectiveEvent) => void;
  setAveragePace: (pace: number) => void;
  setTotalDistance: (distance: number) => void;
  reset: () => void;
}

const MAX_RECENT_EVENTS = 10;

export const useCollectiveStore = create<CollectiveStore>((set) => ({
  runnerCount: 0,
  recentEvents: [],
  averagePaceSecondsPerKm: 0,
  totalDistanceToday: 0,

  setRunnerCount: (count) => set({ runnerCount: count }),

  addEvent: (event) =>
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, MAX_RECENT_EVENTS),
    })),

  setAveragePace: (pace) => set({ averagePaceSecondsPerKm: pace }),

  setTotalDistance: (distance) => set({ totalDistanceToday: distance }),

  reset: () =>
    set({
      runnerCount: 0,
      recentEvents: [],
      averagePaceSecondsPerKm: 0,
      totalDistanceToday: 0,
    }),
}));
