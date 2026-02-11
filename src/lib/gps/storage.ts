import { get, set, del } from 'idb-keyval';
import type { GpsPoint, Split } from '@/types/run';

const KEYS = {
  GPS_BUFFER: 'runfestival_gps_buffer',
  RUN_STATE: 'runfestival_run_state',
} as const;

interface StoredRunState {
  distanceMeters: number;
  elapsedSeconds: number;
  splits: Split[];
  startedAt: number;
  gpsPoints: GpsPoint[];
}

export async function saveGpsBuffer(points: GpsPoint[]): Promise<void> {
  try {
    await set(KEYS.GPS_BUFFER, points);
  } catch {
    // IndexedDB write failed — silent fallback
  }
}

export async function loadGpsBuffer(): Promise<GpsPoint[]> {
  try {
    return (await get<GpsPoint[]>(KEYS.GPS_BUFFER)) ?? [];
  } catch {
    return [];
  }
}

export async function saveRunState(state: StoredRunState): Promise<void> {
  try {
    await set(KEYS.RUN_STATE, state);
  } catch {
    // Silent fallback
  }
}

export async function loadRunState(): Promise<StoredRunState | null> {
  try {
    return (await get<StoredRunState>(KEYS.RUN_STATE)) ?? null;
  } catch {
    return null;
  }
}

export async function clearRunData(): Promise<void> {
  try {
    await del(KEYS.GPS_BUFFER);
    await del(KEYS.RUN_STATE);
  } catch {
    // Silent fallback
  }
}
