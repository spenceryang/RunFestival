import { describe, it, expect } from 'vitest';
import { assessMotivation } from '@/lib/agents/motivation-engine';

describe('motivation-engine', () => {
  const makeSplits = (paces: number[]) =>
    paces.map((p, i) => ({ number: i + 1, paceSeconds: p }));

  it('returns steady with no splits', () => {
    const result = assessMotivation([], 300, 300, 60, 5000, 500);
    expect(result.energyLevel).toBe('steady');
    expect(result.recentPaceTrend).toBe(0);
  });

  it('returns steady with one split', () => {
    const result = assessMotivation(
      makeSplits([300]),
      300, 300, 300, 5000, 1000
    );
    expect(result.energyLevel).toBe('steady');
  });

  it('detects struggling (slowing >10%)', () => {
    const result = assessMotivation(
      makeSplits([280, 300, 320]),
      320, 300, 900, 5000, 3000
    );
    expect(result.energyLevel).toBe('struggling');
  });

  it('detects surging (speeding up >5%)', () => {
    const result = assessMotivation(
      makeSplits([320, 300, 280]),
      280, 300, 900, 5000, 3000
    );
    expect(result.energyLevel).toBe('surging');
  });

  it('detects struggling from large target drift (>15%)', () => {
    const result = assessMotivation(
      makeSplits([300, 302]),
      360, 300, 600, 5000, 2000
    );
    expect(result.energyLevel).toBe('struggling');
  });

  it('detects final stretch at 85%+ progress', () => {
    const result = assessMotivation(
      makeSplits([300, 300, 300, 300]),
      300, 300, 1200, 5000, 4500
    );
    expect(result.shouldBoost).toBe(true);
  });

  it('does not boost in mid-run with steady pace', () => {
    const result = assessMotivation(
      makeSplits([300, 300]),
      300, 300, 600, 5000, 2000
    );
    expect(result.shouldBoost).toBe(false);
    expect(result.energyLevel).toBe('steady');
  });

  it('boosts when struggling even mid-run', () => {
    const result = assessMotivation(
      makeSplits([280, 310, 340]),
      340, 300, 900, 5000, 2000
    );
    expect(result.shouldBoost).toBe(true);
  });

  it('generates approach text', () => {
    const result = assessMotivation(
      makeSplits([300, 300]),
      300, 300, 600, 5000, 2000
    );
    expect(result.approach).toBeTruthy();
    expect(typeof result.approach).toBe('string');
  });

  it('adapts approach for early struggle', () => {
    const result = assessMotivation(
      makeSplits([280, 310, 340]),
      340, 300, 300, 5000, 1000
    );
    expect(result.approach).toContain('rhythm');
  });

  it('adapts approach for final stretch surge', () => {
    const result = assessMotivation(
      makeSplits([300, 290, 275]),
      275, 300, 1200, 5000, 4500
    );
    expect(result.approach).toContain('finishing strong');
  });
});
