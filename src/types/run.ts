export type RunStatus = 'idle' | 'setup' | 'running' | 'paused' | 'finished';

export interface GpsPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
  accuracy: number;
}

export interface Split {
  number: number;
  distanceMeters: number;
  paceSeconds: number;
  elapsedSeconds: number;
}

export interface RunState {
  status: RunStatus;
  distanceMeters: number;
  elapsedSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  currentSplit: number;
  splits: Split[];
  isPaused: boolean;
  startedAt: number | null;
  gpsPoints: GpsPoint[];
}

export interface RunConfig {
  targetDistanceMeters: number | null;
  targetPaceSecondsPerKm: number | null;
  persona: CoachingPersona;
  distanceUnit: 'km' | 'mi';
}

export type CoachingPersona = 'hype' | 'calm' | 'data' | 'storyteller';
