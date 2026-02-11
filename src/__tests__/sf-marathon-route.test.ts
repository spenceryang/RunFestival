import { describe, it, expect } from 'vitest';
import {
  generateSFMarathonRoute,
  getSFMarathonRoute,
  validateDevPassword,
  DevGpsTracker,
} from '@/lib/gps/sf-marathon-route';

describe('generateSFMarathonRoute', () => {
  it('generates a large number of GPS points for a full marathon', () => {
    const route = generateSFMarathonRoute();
    // A marathon at ~5:00/km pace, 3s intervals → ~4,219 points
    expect(route.length).toBeGreaterThan(4000);
    expect(route.length).toBeLessThan(5000);
  });

  it('all points have required GPS fields', () => {
    const route = generateSFMarathonRoute();
    for (const point of route) {
      expect(point.lat).toBeDefined();
      expect(point.lng).toBeDefined();
      expect(point.altitude).toBeDefined();
      expect(point.speed).toBeGreaterThan(0);
      expect(point.timestamp).toBeGreaterThan(0);
      expect(point.accuracy).toBeGreaterThanOrEqual(4);
      expect(point.accuracy).toBeLessThanOrEqual(10);
    }
  });

  it('coordinates are within San Francisco / Marin area', () => {
    const route = generateSFMarathonRoute();
    for (const point of route) {
      // SF + Golden Gate Bridge + Sausalito bounds
      expect(point.lat).toBeGreaterThanOrEqual(37.74);
      expect(point.lat).toBeLessThanOrEqual(37.84);
      expect(point.lng).toBeGreaterThanOrEqual(-122.49);
      expect(point.lng).toBeLessThanOrEqual(-122.38);
    }
  });

  it('timestamps are sequential', () => {
    const route = generateSFMarathonRoute();
    for (let i = 1; i < route.length; i++) {
      expect(route[i].timestamp).toBeGreaterThan(route[i - 1].timestamp);
    }
  });

  it('timestamps are spaced ~3 seconds apart', () => {
    const route = generateSFMarathonRoute();
    for (let i = 1; i < Math.min(100, route.length); i++) {
      const diff = route[i].timestamp - route[i - 1].timestamp;
      expect(diff).toBe(3000);
    }
  });

  it('altitudes are non-negative', () => {
    const route = generateSFMarathonRoute();
    for (const point of route) {
      expect(point.altitude).toBeGreaterThanOrEqual(0);
    }
  });

  it('starts near Embarcadero/Market', () => {
    const route = generateSFMarathonRoute();
    const start = route[0];
    // Should be near 37.7937, -122.3950
    expect(Math.abs(start.lat - 37.7937)).toBeLessThan(0.001);
    expect(Math.abs(start.lng - (-122.3950))).toBeLessThan(0.001);
  });

  it('ends near Embarcadero/Howard', () => {
    const route = generateSFMarathonRoute();
    const end = route[route.length - 1];
    // Should be near 37.7910, -122.3935
    expect(Math.abs(end.lat - 37.7910)).toBeLessThan(0.002);
    expect(Math.abs(end.lng - (-122.3935))).toBeLessThan(0.002);
  });
});

describe('getSFMarathonRoute', () => {
  it('returns the same cached route on multiple calls', () => {
    const route1 = getSFMarathonRoute();
    const route2 = getSFMarathonRoute();
    expect(route1).toBe(route2); // Same reference (cached)
  });
});

describe('validateDevPassword', () => {
  it('accepts correct password', () => {
    expect(validateDevPassword('claude')).toBe(true);
  });

  it('rejects wrong passwords', () => {
    expect(validateDevPassword('')).toBe(false);
    expect(validateDevPassword('wrong')).toBe(false);
    expect(validateDevPassword('Claude')).toBe(false);
    expect(validateDevPassword('CLAUDE')).toBe(false);
  });
});

describe('DevGpsTracker', () => {
  it('creates tracker with default 20x speed', () => {
    const tracker = new DevGpsTracker(() => {});
    expect(tracker.speedMultiplier).toBe(20);
    expect(tracker.isTracking).toBe(false);
    expect(tracker.progress).toBe(0);
  });

  it('creates tracker with custom speed', () => {
    const tracker = new DevGpsTracker(() => {}, 50);
    expect(tracker.speedMultiplier).toBe(50);
  });

  it('reports point count from route', () => {
    const tracker = new DevGpsTracker(() => {});
    expect(tracker.pointCount).toBeGreaterThan(4000);
  });

  it('starts and stops tracking', () => {
    const points: unknown[] = [];
    const tracker = new DevGpsTracker((p) => points.push(p), 50);

    tracker.start();
    expect(tracker.isTracking).toBe(true);

    tracker.stop();
    expect(tracker.isTracking).toBe(false);
  });

  it('getCurrentPoint returns null before start', () => {
    const tracker = new DevGpsTracker(() => {});
    expect(tracker.getCurrentPoint()).toBeNull();
  });

  it('setSpeed changes speed multiplier', () => {
    const tracker = new DevGpsTracker(() => {}, 10);
    expect(tracker.speedMultiplier).toBe(10);
    tracker.setSpeed(50);
    expect(tracker.speedMultiplier).toBe(50);
  });
});
