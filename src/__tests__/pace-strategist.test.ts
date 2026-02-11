import { describe, it, expect } from 'vitest';
import { analyzePace } from '@/lib/agents/pace-strategist';

describe('pace-strategist', () => {
  const makeSplits = (paces: number[]) =>
    paces.map((p, i) => ({
      number: i + 1,
      distanceMeters: 1000,
      paceSeconds: p,
      elapsedSeconds: paces.slice(0, i + 1).reduce((a, b) => a + b, 0),
    }));

  it('returns insufficient_data with fewer than 2 splits', () => {
    const result = analyzePace(
      makeSplits([300]),
      1000, 300, 5000, 300
    );
    expect(result.strategy).toBe('insufficient_data');
  });

  it('detects even pacing', () => {
    const result = analyzePace(
      makeSplits([300, 302, 301, 299, 300]),
      5000, 1502, 5000, 300
    );
    expect(result.strategy).toBe('even');
  });

  it('detects negative split (second half faster)', () => {
    const result = analyzePace(
      makeSplits([320, 315, 290, 280]),
      4000, 1205, 5000, 300
    );
    expect(result.strategy).toBe('negative');
  });

  it('detects positive split (second half slower)', () => {
    const result = analyzePace(
      makeSplits([280, 285, 310, 320]),
      4000, 1195, 5000, 300
    );
    expect(result.strategy).toBe('positive');
  });

  it('detects erratic pacing (high variation)', () => {
    const result = analyzePace(
      makeSplits([250, 350, 260, 340]),
      4000, 1200, 5000, 300
    );
    expect(result.strategy).toBe('erratic');
  });

  it('detects speeding up trend', () => {
    const result = analyzePace(
      makeSplits([320, 310, 295]),
      3000, 925, 5000, 300
    );
    expect(result.recentTrend).toBe('speeding_up');
  });

  it('detects slowing down trend', () => {
    const result = analyzePace(
      makeSplits([280, 300, 320]),
      3000, 900, 5000, 300
    );
    expect(result.recentTrend).toBe('slowing_down');
  });

  it('detects steady trend', () => {
    const result = analyzePace(
      makeSplits([300, 302, 301]),
      3000, 903, 5000, 300
    );
    expect(result.recentTrend).toBe('steady');
  });

  it('projects finish time correctly', () => {
    const result = analyzePace(
      makeSplits([300, 300]),
      2000, 600, 5000, 300
    );
    // 600s for 2km → 1500s for 5km
    expect(result.projectedFinishSeconds).toBe(1500);
  });

  it('returns null projected finish without target distance', () => {
    const result = analyzePace(
      makeSplits([300, 300]),
      2000, 600, null, 300
    );
    expect(result.projectedFinishSeconds).toBeNull();
  });

  it('generates advice string', () => {
    const result = analyzePace(
      makeSplits([300, 302, 301, 299]),
      4000, 1202, 5000, 300
    );
    expect(result.advice).toBeTruthy();
    expect(typeof result.advice).toBe('string');
  });

  it('calculates split variation', () => {
    const result = analyzePace(
      makeSplits([300, 300, 300]),
      3000, 900, 5000, 300
    );
    expect(result.splitVariation).toBe(0); // Perfect consistency
  });

  it('calculates non-zero variation for inconsistent splits', () => {
    const result = analyzePace(
      makeSplits([250, 350]),
      2000, 600, 5000, 300
    );
    expect(result.splitVariation).toBeGreaterThan(0);
  });
});
