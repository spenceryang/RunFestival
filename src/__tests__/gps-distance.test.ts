import { describe, it, expect } from 'vitest';
import { haversine, calculateTotalDistance } from '@/lib/gps/distance';

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('calculates distance between SF and NYC approximately correctly', () => {
    // SF to NYC is roughly 4,129 km
    const distance = haversine(37.7749, -122.4194, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(4_100_000);
    expect(distance).toBeLessThan(4_200_000);
  });

  it('calculates short distance correctly (100m walk)', () => {
    // ~100m difference at SF latitude
    const lat1 = 37.7749;
    const lng1 = -122.4194;
    const lat2 = 37.7758; // roughly 100m north
    const lng2 = -122.4194;
    const distance = haversine(lat1, lng1, lat2, lng2);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(120);
  });

  it('is symmetric', () => {
    const d1 = haversine(37.7749, -122.4194, 40.7128, -74.006);
    const d2 = haversine(40.7128, -74.006, 37.7749, -122.4194);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('handles negative coordinates', () => {
    // Sydney (-33.8688, 151.2093) to São Paulo (-23.5505, -46.6333)
    const distance = haversine(-33.8688, 151.2093, -23.5505, -46.6333);
    expect(distance).toBeGreaterThan(13_000_000); // ~13,500 km
    expect(distance).toBeLessThan(14_000_000);
  });

  it('handles equatorial points', () => {
    // Two points on the equator, 1 degree apart (~111km)
    const distance = haversine(0, 0, 0, 1);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });
});

describe('calculateTotalDistance', () => {
  it('returns 0 for empty array', () => {
    expect(calculateTotalDistance([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(
      calculateTotalDistance([{ lat: 37.7749, lng: -122.4194, accuracy: 10 }])
    ).toBe(0);
  });

  it('calculates distance for multiple points', () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, accuracy: 5 },
      { lat: 37.7758, lng: -122.4194, accuracy: 5 }, // ~100m north
      { lat: 37.7758, lng: -122.4180, accuracy: 5 }, // ~120m east
    ];
    const distance = calculateTotalDistance(points);
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(300);
  });

  it('filters out inaccurate points', () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, accuracy: 5 },
      { lat: 37.7758, lng: -122.4194, accuracy: 50 }, // bad accuracy — skip
      { lat: 37.7767, lng: -122.4194, accuracy: 5 },
    ];
    // Should skip the segment involving the inaccurate point
    const distance = calculateTotalDistance(points);
    expect(distance).toBe(0); // Both segments touch the bad point
  });

  it('includes segments where both endpoints are accurate', () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, accuracy: 10 },
      { lat: 37.7758, lng: -122.4194, accuracy: 10 },
      { lat: 37.7767, lng: -122.4194, accuracy: 10 },
    ];
    const distance = calculateTotalDistance(points);
    expect(distance).toBeGreaterThan(150); // ~200m total
  });

  it('handles accuracy exactly at 30m threshold', () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, accuracy: 30 },
      { lat: 37.7758, lng: -122.4194, accuracy: 30 },
    ];
    const distance = calculateTotalDistance(points);
    expect(distance).toBeGreaterThan(0); // 30 is <= 30, should include
  });

  it('rejects accuracy above 30m threshold', () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, accuracy: 31 },
      { lat: 37.7758, lng: -122.4194, accuracy: 10 },
    ];
    const distance = calculateTotalDistance(points);
    expect(distance).toBe(0);
  });
});
