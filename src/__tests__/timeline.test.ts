import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTimelineRuns, formatTimeAgo } from '@/lib/collective/timeline';
import { useTimelineStore } from '@/lib/store/timeline-store';

describe('generateTimelineRuns', () => {
  it('generates requested number of runs', () => {
    expect(generateTimelineRuns(10)).toHaveLength(10);
    expect(generateTimelineRuns(25)).toHaveLength(25);
    expect(generateTimelineRuns(0)).toHaveLength(0);
  });

  it('each run has required fields', () => {
    const runs = generateTimelineRuns(5);
    for (const run of runs) {
      expect(run.id).toBeTruthy();
      expect(run.userId).toBeTruthy();
      expect(run.displayName).toBeTruthy();
      expect(run.city).toBeTruthy();
      expect(run.distanceMeters).toBeGreaterThan(0);
      expect(run.elapsedSeconds).toBeGreaterThan(0);
      expect(run.averagePaceSecondsPerKm).toBeGreaterThanOrEqual(240);
      expect(run.averagePaceSecondsPerKm).toBeLessThanOrEqual(450);
      expect(run.persona).toBeTruthy();
      expect(run.completedAt).toBeGreaterThan(0);
      expect(run.isSynthetic).toBe(true);
    }
  });

  it('runs are sorted by most recent first', () => {
    const runs = generateTimelineRuns(20);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i - 1].completedAt).toBeGreaterThanOrEqual(runs[i].completedAt);
    }
  });

  it('runs have distances in realistic range (2-21km)', () => {
    const runs = generateTimelineRuns(50);
    for (const run of runs) {
      expect(run.distanceMeters).toBeGreaterThanOrEqual(2000);
      expect(run.distanceMeters).toBeLessThanOrEqual(21000);
    }
  });

  it('runs completed within the last 24 hours', () => {
    const runs = generateTimelineRuns(50);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    for (const run of runs) {
      expect(run.completedAt).toBeGreaterThanOrEqual(dayAgo);
      expect(run.completedAt).toBeLessThanOrEqual(now);
    }
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
  });

  it('returns "just now" for < 60 seconds', () => {
    expect(formatTimeAgo(Date.now() - 30_000)).toBe('just now');
    expect(formatTimeAgo(Date.now() - 1_000)).toBe('just now');
  });

  it('returns minutes for < 1 hour', () => {
    expect(formatTimeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(formatTimeAgo(Date.now() - 30 * 60_000)).toBe('30m ago');
  });

  it('returns hours for < 1 day', () => {
    expect(formatTimeAgo(Date.now() - 2 * 3600_000)).toBe('2h ago');
    expect(formatTimeAgo(Date.now() - 12 * 3600_000)).toBe('12h ago');
  });

  it('returns days for >= 1 day', () => {
    expect(formatTimeAgo(Date.now() - 86400_000)).toBe('1d ago');
    expect(formatTimeAgo(Date.now() - 3 * 86400_000)).toBe('3d ago');
  });
});

describe('useTimelineStore', () => {
  beforeEach(() => {
    useTimelineStore.getState().clear();
  });

  it('starts empty', () => {
    expect(useTimelineStore.getState().runs).toHaveLength(0);
    expect(useTimelineStore.getState().isLoading).toBe(false);
  });

  it('addRun adds to front', () => {
    const run1 = {
      id: '1', userId: 'u1', displayName: 'Alice', city: 'NYC',
      distanceMeters: 5000, elapsedSeconds: 1500, averagePaceSecondsPerKm: 300,
      persona: 'hype', completedAt: 1000, isSynthetic: false,
    };
    const run2 = {
      id: '2', userId: 'u2', displayName: 'Bob', city: 'LA',
      distanceMeters: 10000, elapsedSeconds: 3000, averagePaceSecondsPerKm: 300,
      persona: 'calm', completedAt: 2000, isSynthetic: false,
    };

    useTimelineStore.getState().addRun(run1);
    useTimelineStore.getState().addRun(run2);

    const runs = useTimelineStore.getState().runs;
    expect(runs).toHaveLength(2);
    expect(runs[0].displayName).toBe('Bob');
    expect(runs[1].displayName).toBe('Alice');
  });

  it('limits to 50 runs', () => {
    const runs = Array.from({ length: 55 }, (_, i) => ({
      id: `${i}`, userId: `u${i}`, displayName: `Runner ${i}`, city: 'NYC',
      distanceMeters: 5000, elapsedSeconds: 1500, averagePaceSecondsPerKm: 300,
      persona: 'hype', completedAt: i * 1000, isSynthetic: true,
    }));

    useTimelineStore.getState().setRuns(runs);
    expect(useTimelineStore.getState().runs).toHaveLength(50);
  });

  it('setLoading toggles loading state', () => {
    useTimelineStore.getState().setLoading(true);
    expect(useTimelineStore.getState().isLoading).toBe(true);
    useTimelineStore.getState().setLoading(false);
    expect(useTimelineStore.getState().isLoading).toBe(false);
  });

  it('clear resets everything', () => {
    useTimelineStore.getState().addRun({
      id: '1', userId: 'u1', displayName: 'Alice', city: 'NYC',
      distanceMeters: 5000, elapsedSeconds: 1500, averagePaceSecondsPerKm: 300,
      persona: 'hype', completedAt: 1000, isSynthetic: false,
    });
    useTimelineStore.getState().setLoading(true);

    useTimelineStore.getState().clear();
    expect(useTimelineStore.getState().runs).toHaveLength(0);
    expect(useTimelineStore.getState().isLoading).toBe(false);
  });
});
