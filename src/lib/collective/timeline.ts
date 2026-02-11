import type { TimelineRun } from '@/lib/store/timeline-store';

const CITIES = [
  'San Francisco', 'New York', 'London', 'Tokyo', 'Berlin',
  'Sydney', 'Toronto', 'Singapore', 'Paris', 'Austin',
  'Portland', 'Chicago', 'Seattle', 'Boston', 'Denver',
];

const FIRST_NAMES = [
  'Sarah', 'Marcus', 'Yuki', 'Priya', 'Carlos', 'Emma', 'Liam', 'Aisha',
  'Noah', 'Mia', 'Jin', 'Sofia', 'Oliver', 'Luna', 'Leo', 'Ava',
  'Ethan', 'Chloe', 'Kai', 'Zara', 'Felix', 'Nora', 'Ravi', 'Elena',
];

const PERSONAS = ['hype', 'calm', 'data', 'storyteller'];

/**
 * Generate synthetic timeline runs for demo purposes.
 * Simulates a feed of recent community runs.
 */
export function generateTimelineRuns(count: number): TimelineRun[] {
  const runs: TimelineRun[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    // Distance: 2-21km
    const distanceMeters = 2000 + Math.random() * 19000;
    // Pace: 4:00 - 7:30/km
    const paceSeconds = 240 + Math.random() * 210;
    const elapsedSeconds = (distanceMeters / 1000) * paceSeconds;

    // Completed within the last 24 hours, spread out
    const minutesAgo = Math.random() * 1440;
    const completedAt = now - minutesAgo * 60_000;

    runs.push({
      id: `timeline-${i}-${Date.now()}`,
      userId: `user-${i}`,
      displayName: name,
      city,
      distanceMeters: Math.round(distanceMeters),
      elapsedSeconds: Math.round(elapsedSeconds),
      averagePaceSecondsPerKm: Math.round(paceSeconds),
      persona,
      completedAt,
      isSynthetic: true,
    });
  }

  // Sort by most recent first
  runs.sort((a, b) => b.completedAt - a.completedAt);
  return runs;
}

/**
 * Format "time ago" from a timestamp.
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}
