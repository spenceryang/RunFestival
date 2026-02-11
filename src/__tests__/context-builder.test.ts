import { describe, it, expect } from 'vitest';
import { buildCoachingContext } from '@/lib/coach/context-builder';

function makeRunState(overrides = {}) {
  return {
    distanceMeters: 3000,
    elapsedSeconds: 900,
    currentPaceSecondsPerKm: 300,
    averagePaceSecondsPerKm: 305,
    targetPaceSecondsPerKm: 310,
    targetDistanceMeters: 5000,
    splits: [
      { number: 1, paceSeconds: 310 },
      { number: 2, paceSeconds: 300 },
      { number: 3, paceSeconds: 295 },
    ],
    isPaused: false,
    ...overrides,
  };
}

const mockProfile = {
  name: 'Spencer',
  city: 'San Francisco',
  experienceLevel: 'intermediate',
  storyTopics: ['history', 'science'],
};

const mockCollective = {
  runnerCount: 342,
  recentEvents: [
    { type: 'milestone' as const, text: 'Sarah in London finished a 10K', timestamp: Date.now() },
  ],
  averagePaceSecondsPerKm: 348,
  totalDistanceToday: 4200000,
};

describe('buildCoachingContext', () => {
  it('builds context with correct persona', () => {
    const ctx = buildCoachingContext('hype', 'split_complete', makeRunState(), mockProfile, mockCollective);
    expect(ctx.persona).toBe('hype');
  });

  it('includes trigger type', () => {
    const ctx = buildCoachingContext('calm', 'halfway', makeRunState(), mockProfile, mockCollective);
    expect(ctx.trigger.type).toBe('halfway');
  });

  it('includes run state data', () => {
    const ctx = buildCoachingContext('data', 'idle_storytelling', makeRunState(), mockProfile, mockCollective);
    expect(ctx.runState.distanceMeters).toBe(3000);
    expect(ctx.runState.elapsedSeconds).toBe(900);
    expect(ctx.runState.splits).toHaveLength(3);
  });

  it('includes profile data', () => {
    const ctx = buildCoachingContext('storyteller', 'user_initiated', makeRunState(), mockProfile, mockCollective);
    expect(ctx.profile.name).toBe('Spencer');
    expect(ctx.profile.city).toBe('San Francisco');
    expect(ctx.profile.storyTopics).toContain('history');
  });

  it('includes collective data', () => {
    const ctx = buildCoachingContext('hype', 'split_complete', makeRunState(), mockProfile, mockCollective);
    expect(ctx.collective.runnerCount).toBe(342);
    expect(ctx.collective.recentEvents).toHaveLength(1);
    expect(ctx.collective.averagePaceFormatted).toBe('5:48');
  });

  it('builds split_complete trigger data with split info', () => {
    const ctx = buildCoachingContext('data', 'split_complete', makeRunState(), mockProfile, mockCollective);
    expect(ctx.trigger.data).toHaveProperty('splitNumber');
    expect(ctx.trigger.data).toHaveProperty('splitPaceFormatted');
  });

  it('builds pace_drift trigger data with drift info', () => {
    const ctx = buildCoachingContext('hype', 'pace_drift', makeRunState(), mockProfile, mockCollective);
    expect(ctx.trigger.data).toHaveProperty('currentPace');
    expect(ctx.trigger.data).toHaveProperty('targetPace');
    expect(ctx.trigger.data).toHaveProperty('driftPercent');
  });

  it('builds halfway trigger data with projection', () => {
    const ctx = buildCoachingContext('calm', 'halfway', makeRunState(), mockProfile, mockCollective);
    expect(ctx.trigger.data).toHaveProperty('firstHalfSeconds');
    expect(ctx.trigger.data).toHaveProperty('projectedFinish');
    expect(ctx.trigger.data.projectedFinish).toBe(1800); // 900 * 2
  });

  it('builds final_push trigger data with remaining distance', () => {
    const ctx = buildCoachingContext('hype', 'final_push', makeRunState({ distanceMeters: 4500 }), mockProfile, mockCollective);
    expect(ctx.trigger.data).toHaveProperty('remainingMeters');
    expect(ctx.trigger.data.remainingMeters).toBe(500);
  });

  it('handles null target pace', () => {
    const ctx = buildCoachingContext(
      'calm',
      'pace_drift',
      makeRunState({ targetPaceSecondsPerKm: null }),
      mockProfile,
      mockCollective
    );
    expect(ctx.trigger.data.driftPercent).toBe(0);
  });

  it('handles empty splits', () => {
    const ctx = buildCoachingContext(
      'data',
      'split_complete',
      makeRunState({ splits: [] }),
      mockProfile,
      mockCollective
    );
    expect(ctx.trigger.data.splitNumber).toBe(0);
  });
});
