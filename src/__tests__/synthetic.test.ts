import { describe, it, expect } from 'vitest';
import {
  generateSyntheticRunners,
  generateSyntheticMilestone,
} from '@/lib/collective/synthetic';

describe('generateSyntheticRunners', () => {
  it('generates requested number of runners', () => {
    expect(generateSyntheticRunners(10)).toHaveLength(10);
    expect(generateSyntheticRunners(100)).toHaveLength(100);
    expect(generateSyntheticRunners(0)).toHaveLength(0);
  });

  it('each runner has required fields', () => {
    const runners = generateSyntheticRunners(5);
    for (const runner of runners) {
      expect(runner.userId).toBeTruthy();
      expect(runner.userId).toContain('synthetic-');
      expect(runner.displayName).toBeTruthy();
      expect(runner.city).toBeTruthy();
      expect(runner.currentPace).toBeGreaterThanOrEqual(300); // >= 5:00/km
      expect(runner.currentPace).toBeLessThanOrEqual(480); // <= 8:00/km
      expect(runner.distanceMeters).toBeGreaterThanOrEqual(0);
      expect(runner.startedMinutesAgo).toBeGreaterThanOrEqual(0);
      expect(runner.startedMinutesAgo).toBeLessThanOrEqual(45);
    }
  });

  it('generates unique user IDs', () => {
    const runners = generateSyntheticRunners(50);
    const ids = new Set(runners.map((r) => r.userId));
    expect(ids.size).toBe(50);
  });

  it('uses realistic city names', () => {
    const runners = generateSyntheticRunners(100);
    const cities = new Set(runners.map((r) => r.city));
    // Should have multiple different cities
    expect(cities.size).toBeGreaterThan(5);
  });
});

describe('generateSyntheticMilestone', () => {
  it('returns name, city, and achievement', () => {
    const milestone = generateSyntheticMilestone();
    expect(milestone.name).toBeTruthy();
    expect(milestone.city).toBeTruthy();
    expect(milestone.achievement).toBeTruthy();
  });

  it('generates varying milestones', () => {
    const milestones = Array.from({ length: 20 }, () =>
      generateSyntheticMilestone()
    );
    const achievements = new Set(milestones.map((m) => m.achievement));
    expect(achievements.size).toBeGreaterThan(1);
  });
});
