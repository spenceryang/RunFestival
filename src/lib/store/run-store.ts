import { create } from 'zustand';
import type { GpsPoint, RunStatus, Split, CoachingPersona } from '@/types/run';
import { haversine } from '@/lib/gps/distance';
import { calculateCurrentPace, calculateAveragePace } from '@/lib/gps/pace';

interface RunStore {
  // Run state
  status: RunStatus;
  distanceMeters: number;
  elapsedSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  currentSplit: number;
  splits: Split[];
  startedAt: number | null;
  gpsPoints: GpsPoint[];

  // Run config
  persona: CoachingPersona;
  distanceUnit: 'km' | 'mi';

  // Actions
  setStatus: (status: RunStatus) => void;
  startRun: (config: {
    targetDistanceMeters: number | null;
    targetPaceSecondsPerKm: number | null;
    persona: CoachingPersona;
  }) => void;
  addGpsPoint: (point: GpsPoint) => void;
  updateElapsedTime: (seconds: number) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  finishRun: () => void;
  resetRun: () => void;
  setDistanceUnit: (unit: 'km' | 'mi') => void;
}

const SPLIT_DISTANCE_KM = 1000; // 1 km splits (in meters)

export const useRunStore = create<RunStore>((set, get) => ({
  status: 'idle',
  distanceMeters: 0,
  elapsedSeconds: 0,
  currentPaceSecondsPerKm: 0,
  averagePaceSecondsPerKm: 0,
  targetPaceSecondsPerKm: null,
  targetDistanceMeters: null,
  currentSplit: 0,
  splits: [],
  startedAt: null,
  gpsPoints: [],
  persona: 'hype',
  distanceUnit: 'km',

  setStatus: (status) => set({ status }),

  startRun: (config) =>
    set({
      status: 'running',
      distanceMeters: 0,
      elapsedSeconds: 0,
      currentPaceSecondsPerKm: 0,
      averagePaceSecondsPerKm: 0,
      targetPaceSecondsPerKm: config.targetPaceSecondsPerKm,
      targetDistanceMeters: config.targetDistanceMeters,
      currentSplit: 0,
      splits: [],
      startedAt: Date.now(),
      gpsPoints: [],
      persona: config.persona,
    }),

  addGpsPoint: (point) => {
    const state = get();
    const newPoints = [...state.gpsPoints, point];

    // Calculate distance increment
    let newDistance = state.distanceMeters;
    if (state.gpsPoints.length > 0) {
      const lastPoint = state.gpsPoints[state.gpsPoints.length - 1];
      const increment = haversine(
        lastPoint.lat,
        lastPoint.lng,
        point.lat,
        point.lng
      );
      newDistance += increment;
    }

    // Calculate paces
    const currentPace = calculateCurrentPace(newPoints);
    const avgPace = calculateAveragePace(newDistance, state.elapsedSeconds);

    // Check for split completion
    const newSplitNumber = Math.floor(newDistance / SPLIT_DISTANCE_KM);
    let newSplits = state.splits;
    if (newSplitNumber > state.currentSplit && state.currentSplit >= 0) {
      // A new split was completed
      const splitElapsed = state.elapsedSeconds;
      const prevSplitElapsed =
        state.splits.length > 0
          ? state.splits[state.splits.length - 1].elapsedSeconds
          : 0;
      const splitTime = splitElapsed - prevSplitElapsed;
      newSplits = [
        ...state.splits,
        {
          number: newSplitNumber,
          distanceMeters: SPLIT_DISTANCE_KM,
          paceSeconds: splitTime, // seconds for this km
          elapsedSeconds: splitElapsed,
        },
      ];
    }

    set({
      gpsPoints: newPoints,
      distanceMeters: newDistance,
      currentPaceSecondsPerKm: currentPace,
      averagePaceSecondsPerKm: avgPace,
      currentSplit: newSplitNumber,
      splits: newSplits,
    });
  },

  updateElapsedTime: (seconds) => set({ elapsedSeconds: seconds }),

  pauseRun: () => set({ status: 'paused' }),

  resumeRun: () => set({ status: 'running' }),

  finishRun: () => set({ status: 'finished' }),

  resetRun: () =>
    set({
      status: 'idle',
      distanceMeters: 0,
      elapsedSeconds: 0,
      currentPaceSecondsPerKm: 0,
      averagePaceSecondsPerKm: 0,
      targetPaceSecondsPerKm: null,
      targetDistanceMeters: null,
      currentSplit: 0,
      splits: [],
      startedAt: null,
      gpsPoints: [],
    }),

  setDistanceUnit: (unit) => set({ distanceUnit: unit }),
}));
