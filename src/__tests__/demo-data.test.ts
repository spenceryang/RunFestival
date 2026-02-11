import { describe, it, expect } from 'vitest';
import { getDemoRoute, DemoGpsTracker } from '@/lib/gps/demo-data';

describe('getDemoRoute', () => {
  it('returns array of GPS points', () => {
    const route = getDemoRoute();
    expect(Array.isArray(route)).toBe(true);
    expect(route.length).toBeGreaterThan(100);
  });

  it('each point has required fields', () => {
    const route = getDemoRoute();
    for (const point of route.slice(0, 10)) {
      expect(point.lat).toBeDefined();
      expect(point.lng).toBeDefined();
      expect(point.timestamp).toBeDefined();
      expect(point.accuracy).toBeDefined();
      expect(point.accuracy).toBeLessThan(30);
    }
  });

  it('points are in San Francisco area', () => {
    const route = getDemoRoute();
    for (const point of route) {
      expect(point.lat).toBeGreaterThan(37.5);
      expect(point.lat).toBeLessThan(38.0);
      expect(point.lng).toBeGreaterThan(-123);
      expect(point.lng).toBeLessThan(-122);
    }
  });

  it('timestamps are sequential', () => {
    const route = getDemoRoute();
    for (let i = 1; i < route.length; i++) {
      expect(route[i].timestamp).toBeGreaterThan(route[i - 1].timestamp);
    }
  });

  it('returns same cached instance on multiple calls', () => {
    const route1 = getDemoRoute();
    const route2 = getDemoRoute();
    expect(route1).toBe(route2);
  });
});

describe('DemoGpsTracker', () => {
  it('creates tracker with callback', () => {
    const tracker = new DemoGpsTracker(() => {}, 100);
    expect(tracker.isTracking).toBe(false);
  });

  it('starts and stops tracking', () => {
    const tracker = new DemoGpsTracker(() => {}, 100);
    tracker.start();
    expect(tracker.isTracking).toBe(true);
    tracker.stop();
    expect(tracker.isTracking).toBe(false);
  });

  it('progress starts at 0', () => {
    const tracker = new DemoGpsTracker(() => {}, 100);
    expect(tracker.progress).toBe(0);
  });

  it('fires callback with GPS points', async () => {
    const points: unknown[] = [];
    const tracker = new DemoGpsTracker((point) => {
      points.push(point);
    }, 1000); // 1000x speed = very fast

    tracker.start();

    // Wait a bit for some points to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    tracker.stop();
    expect(points.length).toBeGreaterThan(0);
  });
});
