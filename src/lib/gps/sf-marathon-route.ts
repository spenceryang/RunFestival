import type { GpsPoint } from '@/types/run';

/**
 * SF Marathon 2026 Route (July 26, 2026)
 *
 * Key waypoints along the actual SF Marathon course:
 * Starts at Embarcadero/Market → Fisherman's Wharf → Marina Green → Crissy Field →
 * Golden Gate Bridge → Vista Point (Sausalito side) → back across GGB →
 * Presidio → Richmond District → Golden Gate Park → Haight → Mission →
 * Mission Bay (Chase Center / Oracle Park) → Embarcadero finish near Howard St.
 *
 * ~30 key waypoints, interpolated to 500+ smooth GPS points for a full 42.2km marathon route.
 */

// Key waypoints along the SF Marathon route [lat, lng]
const SF_MARATHON_WAYPOINTS: [number, number][] = [
  // START — Embarcadero at Market
  [37.7937, -122.3950],
  // North along Embarcadero
  [37.7985, -122.3970],
  // Ferry Building area
  [37.8024, -122.3975],
  // Pier 39 / Fisherman's Wharf
  [37.8087, -122.4098],
  // Aquatic Park
  [37.8068, -122.4218],
  // Fort Mason
  [37.8060, -122.4310],
  // Marina Green
  [37.8030, -122.4380],
  // Crissy Field East
  [37.8035, -122.4510],
  // Crissy Field West
  [37.8022, -122.4645],
  // Fort Point / GGB approach
  [37.8100, -122.4750],
  // Golden Gate Bridge — south tower
  [37.8190, -122.4783],
  // Golden Gate Bridge — mid span
  [37.8280, -122.4785],
  // Golden Gate Bridge — north tower
  [37.8320, -122.4788],
  // Vista Point Sausalito
  [37.8325, -122.4795],
  // Turn around — back on bridge
  [37.8280, -122.4785],
  // GGB south side return
  [37.8100, -122.4750],
  // Presidio — Lincoln Blvd
  [37.7985, -122.4720],
  // Presidio — West Pacific Ave
  [37.7895, -122.4685],
  // Richmond District — Clement St area
  [37.7830, -122.4620],
  // Golden Gate Park — north entrance
  [37.7750, -122.4570],
  // GGP — Conservatory of Flowers
  [37.7720, -122.4590],
  // GGP — de Young Museum
  [37.7715, -122.4685],
  // GGP — Stow Lake area
  [37.7690, -122.4750],
  // Haight Street exit
  [37.7695, -122.4530],
  // Haight-Ashbury
  [37.7695, -122.4470],
  // Mission Dolores
  [37.7610, -122.4270],
  // Mission — 16th & Valencia
  [37.7650, -122.4220],
  // Mission — 24th St
  [37.7530, -122.4190],
  // Potrero Hill
  [37.7560, -122.4000],
  // Mission Bay
  [37.7710, -122.3910],
  // Chase Center area
  [37.7680, -122.3870],
  // Oracle Park
  [37.7786, -122.3893],
  // South Beach
  [37.7840, -122.3900],
  // FINISH — Embarcadero near Howard
  [37.7910, -122.3935],
];

/**
 * Interpolate between two GPS coordinates.
 */
function interpolate(
  p1: [number, number],
  p2: [number, number],
  t: number
): [number, number] {
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
  ];
}

/**
 * Calculate approximate distance between two lat/lng points in meters.
 */
function approxDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1[0] * Math.PI / 180) *
      Math.cos(p2[0] * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate the full SF Marathon route as GPS points.
 * Interpolates between waypoints to produce a smooth, realistic route.
 * Points are spaced ~3 seconds apart at the given pace.
 */
export function generateSFMarathonRoute(): GpsPoint[] {
  const points: GpsPoint[] = [];
  const startTime = Date.now();

  // Calculate total route distance from waypoints
  let totalRouteDistance = 0;
  const segmentDistances: number[] = [];
  for (let i = 0; i < SF_MARATHON_WAYPOINTS.length - 1; i++) {
    const d = approxDistance(SF_MARATHON_WAYPOINTS[i], SF_MARATHON_WAYPOINTS[i + 1]);
    segmentDistances.push(d);
    totalRouteDistance += d;
  }

  // Marathon is 42,195m — scale interpolation to match
  const MARATHON_DISTANCE = 42195;
  const PACE_BASE = 300; // 5:00/km base pace in seconds
  const POINT_INTERVAL = 3; // 3 seconds between GPS points
  const metersPerPoint = (1000 / PACE_BASE) * POINT_INTERVAL; // ~10m per point

  const totalPoints = Math.ceil(MARATHON_DISTANCE / metersPerPoint);

  // Walk along the route, distributing points evenly by distance
  let accumulatedDistance = 0;
  let segmentIndex = 0;
  let segmentProgress = 0;

  for (let i = 0; i < totalPoints; i++) {
    const targetDistance = (i / totalPoints) * totalRouteDistance;

    // Find which segment we're on
    let cumDist = 0;
    for (let s = 0; s < segmentDistances.length; s++) {
      if (cumDist + segmentDistances[s] >= targetDistance) {
        segmentIndex = s;
        segmentProgress = (targetDistance - cumDist) / segmentDistances[s];
        break;
      }
      cumDist += segmentDistances[s];
    }

    const [lat, lng] = interpolate(
      SF_MARATHON_WAYPOINTS[segmentIndex],
      SF_MARATHON_WAYPOINTS[Math.min(segmentIndex + 1, SF_MARATHON_WAYPOINTS.length - 1)],
      segmentProgress
    );

    // Add natural GPS wobble (±2m)
    const wobbleLat = (Math.sin(i * 0.7) * 0.00002);
    const wobbleLng = (Math.cos(i * 0.5) * 0.00002);

    // Pace variation: 4:30 - 5:30/km (faster early, slower late — realistic marathon pacing)
    const fatigueRatio = i / totalPoints; // 0→1
    const fatiguePace = PACE_BASE - 30 + fatigueRatio * 60; // starts ~4:30, ends ~5:30
    const paceJitter = Math.sin(i * 0.1) * 10;
    const effectivePace = fatiguePace + paceJitter;

    // Speed in m/s from pace
    const speed = 1000 / effectivePace;

    // Gentle elevation profile (SF hills)
    const elevation =
      20 + // base
      Math.sin(i * 0.01) * 40 + // long rolling hills
      Math.sin(i * 0.05) * 15 + // shorter hills
      (segmentIndex >= 9 && segmentIndex <= 15 ? 70 : 0); // GGB bridge elevation ~70m

    points.push({
      lat: lat + wobbleLat,
      lng: lng + wobbleLng,
      altitude: Math.max(0, elevation),
      speed,
      timestamp: startTime + i * POINT_INTERVAL * 1000,
      accuracy: 4 + Math.random() * 6, // 4-10m accuracy
    });
  }

  return points;
}

let cachedRoute: GpsPoint[] | null = null;

export function getSFMarathonRoute(): GpsPoint[] {
  if (!cachedRoute) {
    cachedRoute = generateSFMarathonRoute();
  }
  return cachedRoute;
}

/**
 * Validate the dev mode password.
 */
export function validateDevPassword(password: string): boolean {
  return password === 'claude';
}

/**
 * Dev GPS tracker — replays the SF Marathon route at configurable speed.
 * Based on DemoGpsTracker but with dev-specific features.
 */
export class DevGpsTracker {
  private points: GpsPoint[];
  private currentIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onPoint: (point: GpsPoint) => void;
  private _speedMultiplier: number;

  constructor(
    onPoint: (point: GpsPoint) => void,
    speedMultiplier = 20 // 20x speed by default for dev
  ) {
    this.points = getSFMarathonRoute();
    this.onPoint = onPoint;
    this._speedMultiplier = speedMultiplier;
  }

  get speedMultiplier(): number {
    return this._speedMultiplier;
  }

  /**
   * Change speed while running. Restarts the interval at the new speed.
   */
  setSpeed(multiplier: number): void {
    this._speedMultiplier = multiplier;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    const intervalMs = 3000 / this._speedMultiplier;

    this.intervalId = setInterval(() => {
      if (this.currentIndex >= this.points.length) {
        this.stop();
        return;
      }

      const point = {
        ...this.points[this.currentIndex],
        timestamp: Date.now(),
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

  get pointCount(): number {
    return this.points.length;
  }

  get currentPointIndex(): number {
    return this.currentIndex;
  }

  getCurrentPoint(): GpsPoint | null {
    if (this.currentIndex > 0 && this.currentIndex <= this.points.length) {
      return this.points[this.currentIndex - 1];
    }
    return null;
  }
}
