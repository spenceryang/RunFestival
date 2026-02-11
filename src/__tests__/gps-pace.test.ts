import { describe, it, expect } from 'vitest';
import {
  calculateCurrentPace,
  calculateAveragePace,
  formatPace,
  formatTime,
  formatDistance,
} from '@/lib/gps/pace';
import type { GpsPoint } from '@/types/run';

function makePoint(
  lat: number,
  lng: number,
  timestamp: number,
  accuracy = 10
): GpsPoint {
  return { lat, lng, altitude: null, speed: null, timestamp, accuracy };
}

describe('calculateCurrentPace', () => {
  it('returns 0 for empty array', () => {
    expect(calculateCurrentPace([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(calculateCurrentPace([makePoint(37.77, -122.41, 1000)])).toBe(0);
  });

  it('returns 0 if all points have bad accuracy', () => {
    const points = [
      makePoint(37.77, -122.41, 1000, 50),
      makePoint(37.78, -122.41, 4000, 50),
    ];
    expect(calculateCurrentPace(points)).toBe(0);
  });

  it('calculates pace for points within 30s window', () => {
    const now = Date.now();
    // Points roughly 100m apart, 10 seconds gap = ~10s/100m = 100s/km
    const points = [
      makePoint(37.7749, -122.4194, now - 20000),
      makePoint(37.7753, -122.4194, now - 10000), // ~44m north
      makePoint(37.7758, -122.4194, now), // ~55m north
    ];
    const pace = calculateCurrentPace(points);
    expect(pace).toBeGreaterThan(0);
    expect(pace).toBeLessThan(1000); // Less than 16:40/km (walking)
  });

  it('ignores points outside 30s window', () => {
    const now = Date.now();
    const points = [
      makePoint(37.7700, -122.4194, now - 60000), // outside window
      makePoint(37.7749, -122.4194, now - 10000),
      makePoint(37.7758, -122.4194, now),
    ];
    const pace = calculateCurrentPace(points);
    expect(pace).toBeGreaterThan(0);
  });
});

describe('calculateAveragePace', () => {
  it('returns 0 for zero distance', () => {
    expect(calculateAveragePace(0, 100)).toBe(0);
  });

  it('returns 0 for zero time', () => {
    expect(calculateAveragePace(1000, 0)).toBe(0);
  });

  it('calculates 5:00/km pace correctly', () => {
    // 1000m in 300s = 300s/km = 5:00/km
    expect(calculateAveragePace(1000, 300)).toBe(300);
  });

  it('calculates 6:00/km pace correctly', () => {
    // 5000m in 1800s = 360s/km = 6:00/km
    expect(calculateAveragePace(5000, 1800)).toBe(360);
  });

  it('handles very slow pace', () => {
    // 100m in 100s = 1000s/km
    expect(calculateAveragePace(100, 100)).toBe(1000);
  });

  it('handles very fast pace', () => {
    // 1000m in 150s = 150s/km = 2:30/km (sprint)
    expect(calculateAveragePace(1000, 150)).toBe(150);
  });
});

describe('formatPace', () => {
  it('formats 5:00/km', () => {
    expect(formatPace(300)).toBe('5:00');
  });

  it('formats 4:30/km', () => {
    expect(formatPace(270)).toBe('4:30');
  });

  it('formats 6:05/km', () => {
    expect(formatPace(365)).toBe('6:05');
  });

  it('returns --:-- for 0', () => {
    expect(formatPace(0)).toBe('--:--');
  });

  it('returns --:-- for negative', () => {
    expect(formatPace(-100)).toBe('--:--');
  });

  it('returns --:-- for Infinity', () => {
    expect(formatPace(Infinity)).toBe('--:--');
  });

  it('converts to miles when unit is mi', () => {
    // 300s/km * 1.60934 ≈ 483s/mi ≈ 8:03/mi
    const result = formatPace(300, 'mi');
    expect(result).toBe('8:03');
  });
});

describe('formatTime', () => {
  it('formats 0 seconds', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  it('formats 3600 seconds as 1:00:00', () => {
    expect(formatTime(3600)).toBe('1:00:00');
  });

  it('formats 3661 seconds as 1:01:01', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('formats 599 seconds as 09:59', () => {
    expect(formatTime(599)).toBe('09:59');
  });
});

describe('formatDistance', () => {
  it('formats 0 meters as 0.00 km', () => {
    expect(formatDistance(0)).toBe('0.00');
  });

  it('formats 1000m as 1.00 km', () => {
    expect(formatDistance(1000)).toBe('1.00');
  });

  it('formats 5000m as 5.00 km', () => {
    expect(formatDistance(5000)).toBe('5.00');
  });

  it('formats 12345m as 12.3 km (1 decimal for >= 10)', () => {
    expect(formatDistance(12345)).toBe('12.3');
  });

  it('formats in miles', () => {
    // 1609.34m = 1 mile
    expect(formatDistance(1609.34, 'mi')).toBe('1.00');
  });

  it('formats long distance in miles', () => {
    // 16093.4m ≈ 10 miles
    expect(formatDistance(16093.4, 'mi')).toBe('10.0');
  });
});
