export interface ActiveRunner {
  userId: string;
  displayName: string;
  city: string;
  startedAt: string;
  distanceMeters: number;
  currentPaceSecondsPerKm: number;
  isSynthetic: boolean;
}

export interface CollectiveEvent {
  type: 'milestone' | 'collective_stat' | 'hype_moment';
  text: string;
  timestamp: number;
}

export interface CollectiveState {
  runnerCount: number;
  recentEvents: CollectiveEvent[];
  averagePaceSecondsPerKm: number;
  totalDistanceToday: number;
}
