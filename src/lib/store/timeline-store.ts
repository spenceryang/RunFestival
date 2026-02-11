import { create } from 'zustand';

export interface TimelineRun {
  id: string;
  userId: string;
  displayName: string;
  city: string;
  distanceMeters: number;
  elapsedSeconds: number;
  averagePaceSecondsPerKm: number;
  persona: string;
  completedAt: number; // timestamp
  isSynthetic: boolean;
}

interface TimelineStore {
  runs: TimelineRun[];
  isLoading: boolean;

  addRun: (run: TimelineRun) => void;
  setRuns: (runs: TimelineRun[]) => void;
  setLoading: (loading: boolean) => void;
  updateRunDisplayName: (runId: string, displayName: string) => void;
  clear: () => void;
}

const MAX_TIMELINE_RUNS = 50;

export const useTimelineStore = create<TimelineStore>((set) => ({
  runs: [],
  isLoading: false,

  addRun: (run) =>
    set((state) => ({
      runs: [run, ...state.runs].slice(0, MAX_TIMELINE_RUNS),
    })),

  setRuns: (runs) => set({ runs: runs.slice(0, MAX_TIMELINE_RUNS) }),

  setLoading: (loading) => set({ isLoading: loading }),

  updateRunDisplayName: (runId, displayName) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId ? { ...r, displayName } : r
      ),
    })),

  clear: () => set({ runs: [], isLoading: false }),
}));
