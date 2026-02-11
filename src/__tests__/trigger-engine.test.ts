import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoachingTriggerEngine } from '@/lib/coach/trigger-engine';

function makeSnapshot(overrides = {}) {
  return {
    status: 'running' as const,
    distanceMeters: 2500,
    elapsedSeconds: 750,
    currentPaceSecondsPerKm: 300,
    averagePaceSecondsPerKm: 300,
    targetPaceSecondsPerKm: 300,
    targetDistanceMeters: 5000,
    currentSplit: 2,
    splits: [
      { number: 1, paceSeconds: 300 },
      { number: 2, paceSeconds: 298 },
    ],
    ...overrides,
  };
}

describe('CoachingTriggerEngine', () => {
  let engine: CoachingTriggerEngine;

  beforeEach(() => {
    engine = new CoachingTriggerEngine();
    vi.useFakeTimers();
  });

  it('returns null when status is not running', () => {
    const snapshot = makeSnapshot({ status: 'paused' as const });
    expect(engine.evaluate(snapshot, null)).toBeNull();
  });

  it('returns null within minimum interval', () => {
    vi.setSystemTime(1000);
    // First call succeeds (idle trigger after 30s elapsed)
    const s1 = makeSnapshot({ elapsedSeconds: 35 });
    engine.evaluate(s1, null);

    // Second call within 45s should return null
    vi.setSystemTime(20_000);
    const s2 = makeSnapshot({ elapsedSeconds: 55 });
    expect(engine.evaluate(s2, s1)).toBeNull();
  });

  it('fires split_complete when split number increases', () => {
    vi.setSystemTime(0);
    const prev = makeSnapshot({ currentSplit: 2 });

    vi.setSystemTime(50_000); // past minimum interval
    const curr = makeSnapshot({ currentSplit: 3 });

    const trigger = engine.evaluate(curr, prev);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('split_complete');
  });

  it('fires halfway trigger when crossing 50% of target distance', () => {
    vi.setSystemTime(0);
    const prev = makeSnapshot({ distanceMeters: 2400, currentSplit: 2 });

    vi.setSystemTime(50_000);
    const curr = makeSnapshot({ distanceMeters: 2600, currentSplit: 2 });

    const trigger = engine.evaluate(curr, prev);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('halfway');
  });

  it('fires final_push trigger when crossing 90% of target distance', () => {
    vi.setSystemTime(0);
    const prev = makeSnapshot({ distanceMeters: 4400, currentSplit: 4 });

    vi.setSystemTime(50_000);
    const curr = makeSnapshot({ distanceMeters: 4600, currentSplit: 4 });

    const trigger = engine.evaluate(curr, prev);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('final_push');
  });

  it('fires idle_storytelling after 3 minutes with no coaching', () => {
    vi.setSystemTime(100_000);
    // First message (idle after 30s)
    const s1 = makeSnapshot({ elapsedSeconds: 35 });
    engine.evaluate(s1, null);

    // 3+ minutes later, same split so split_complete doesn't fire
    vi.setSystemTime(300_000);
    const s2 = makeSnapshot({ distanceMeters: 3500, elapsedSeconds: 235, currentSplit: 2 });
    const trigger = engine.evaluate(s2, s1);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('idle_storytelling');
  });

  it('fires initial idle trigger after 30 seconds of running', () => {
    vi.setSystemTime(100_000); // nonzero start so Date.now() > minInterval
    const snapshot = makeSnapshot({ elapsedSeconds: 35 });
    const trigger = engine.evaluate(snapshot, null);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('idle_storytelling');
  });

  it('does not fire initial trigger before 30 seconds', () => {
    vi.setSystemTime(0);
    const snapshot = makeSnapshot({ elapsedSeconds: 20 });
    expect(engine.evaluate(snapshot, null)).toBeNull();
  });

  it('triggerUserInitiated returns user_initiated trigger', () => {
    const snapshot = makeSnapshot();
    const trigger = engine.triggerUserInitiated(snapshot);
    expect(trigger.type).toBe('user_initiated');
  });

  it('recordCoachMessage updates lastCoachMessage', () => {
    vi.setSystemTime(100_000);
    engine.recordCoachMessage();

    // Try to evaluate immediately — should be throttled
    const snapshot = makeSnapshot({ elapsedSeconds: 120 });
    expect(engine.evaluate(snapshot, null)).toBeNull();
  });

  it('reset clears state', () => {
    vi.setSystemTime(100_000);
    // Record a message
    const s1 = makeSnapshot({ elapsedSeconds: 35 });
    engine.evaluate(s1, null);

    engine.reset();

    // After reset, should be able to fire initial idle again
    vi.setSystemTime(200_000);
    const s2 = makeSnapshot({ elapsedSeconds: 35 });
    const trigger = engine.evaluate(s2, null);
    expect(trigger).not.toBeNull();
  });

  it('prioritizes split_complete over halfway', () => {
    vi.setSystemTime(0);
    // Both split and halfway trigger simultaneously
    const prev = makeSnapshot({ distanceMeters: 2400, currentSplit: 2 });

    vi.setSystemTime(50_000);
    const curr = makeSnapshot({ distanceMeters: 2600, currentSplit: 3 });

    const trigger = engine.evaluate(curr, prev);
    expect(trigger!.type).toBe('split_complete'); // higher priority
  });
});
