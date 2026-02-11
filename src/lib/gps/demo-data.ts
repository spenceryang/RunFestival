import type { GpsPoint } from '@/types/run';

/**
 * Pre-recorded GPS route for demo mode.
 * Simulates a ~5K run around a park.
 * Points are 3 seconds apart at roughly 5:00/km pace.
 */

// San Francisco Golden Gate Park loop (approximate)
const BASE_LAT = 37.7694;
const BASE_LNG = -122.4862;

function generateDemoRoute(): GpsPoint[] {
  const points: GpsPoint[] = [];
  const totalPoints = 350; // ~17.5 minutes of running
  const startTime = Date.now();

  for (let i = 0; i < totalPoints; i++) {
    const t = i / totalPoints;
    const angle = t * 2 * Math.PI;

    // Create a roughly oval route
    const radiusLat = 0.008 + Math.sin(angle * 2) * 0.002;
    const radiusLng = 0.012 + Math.cos(angle * 3) * 0.003;

    // Add some natural wobble
    const wobbleLat = (Math.sin(i * 0.7) * 0.0001);
    const wobbleLng = (Math.cos(i * 0.5) * 0.0001);

    const lat = BASE_LAT + Math.sin(angle) * radiusLat + wobbleLat;
    const lng = BASE_LNG + Math.cos(angle) * radiusLng + wobbleLng;

    // Simulate varying speed (pace between 4:30 - 5:30 /km)
    const speedVariation = 1 + Math.sin(i * 0.1) * 0.15;
    const baseSpeed = 3.33; // ~5:00/km in m/s
    const speed = baseSpeed * speedVariation;

    points.push({
      lat,
      lng,
      altitude: 50 + Math.sin(i * 0.05) * 15, // gentle hills
      speed,
      timestamp: startTime + i * 3000, // 3 seconds apart
      accuracy: 5 + Math.random() * 8, // 5-13m accuracy (good GPS)
    });
  }

  return points;
}

let cachedRoute: GpsPoint[] | null = null;

export function getDemoRoute(): GpsPoint[] {
  if (!cachedRoute) {
    cachedRoute = generateDemoRoute();
  }
  return cachedRoute;
}

/**
 * Demo GPS tracker that replays pre-recorded data at accelerated speed.
 */
export class DemoGpsTracker {
  private points: GpsPoint[];
  private currentIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onPoint: (point: GpsPoint) => void;
  private speedMultiplier: number;

  constructor(
    onPoint: (point: GpsPoint) => void,
    speedMultiplier = 10 // 10x speed by default
  ) {
    this.points = getDemoRoute();
    this.onPoint = onPoint;
    this.speedMultiplier = speedMultiplier;
  }

  start(): void {
    const intervalMs = 3000 / this.speedMultiplier; // 300ms at 10x

    this.intervalId = setInterval(() => {
      if (this.currentIndex >= this.points.length) {
        this.stop();
        return;
      }

      const point = {
        ...this.points[this.currentIndex],
        timestamp: Date.now(), // Use real timestamps
      };
      this.onPoint(point);
      this.currentIndex++;
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isTracking(): boolean {
    return this.intervalId !== null;
  }

  get progress(): number {
    return this.currentIndex / this.points.length;
  }
}
