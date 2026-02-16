import { describe, it, expect } from 'vitest';
import { assessMotivation } from '@/lib/agents/motivation-engine';
import type { EnergyLevel, RunPhase, MindsetMode, Momentum } from '@/lib/agents/motivation-engine';

describe('motivation-engine', () => {
  const makeSplits = (paces: number[]) =>
    paces.map((p, i) => ({ number: i + 1, paceSeconds: p }));

  // ── Existing tests (backward compatibility) ──

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
    expect(result.approach.toLowerCase()).toContain('finishing strong');
  });

  // ── New fields populated ──

  it('returns all new fields in MotivationState', () => {
    const result = assessMotivation(
      makeSplits([300, 300]),
      300, 300, 600, 5000, 2000
    );
    expect(result).toHaveProperty('runPhase');
    expect(result).toHaveProperty('mindsetMode');
    expect(result).toHaveProperty('momentum');
    expect(result).toHaveProperty('selfTalkCue');
  });

  // ── Run Phase (classifyRunPhase) ──

  describe('run phases (distance-based)', () => {
    it('warmup at <10% progress', () => {
      const result = assessMotivation(makeSplits([300]), 300, 300, 60, 10000, 500);
      expect(result.runPhase).toBe('warmup');
    });

    it('settling at 10-25% progress', () => {
      const result = assessMotivation(makeSplits([300, 300]), 300, 300, 600, 10000, 1500);
      expect(result.runPhase).toBe('settling');
    });

    it('mid_grind at 25-60% progress', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 900, 10000, 4000);
      expect(result.runPhase).toBe('mid_grind');
    });

    it('pre_wall at 60-80% progress', () => {
      const result = assessMotivation(makeSplits([300, 300, 300, 300]), 300, 300, 1200, 10000, 7000);
      expect(result.runPhase).toBe('pre_wall');
    });

    it('wall at 80-90% progress', () => {
      const result = assessMotivation(makeSplits([300, 300, 300, 300]), 300, 300, 1200, 10000, 8500);
      expect(result.runPhase).toBe('wall');
    });

    it('final_kick at >90% progress', () => {
      const result = assessMotivation(makeSplits([300, 300, 300, 300]), 300, 300, 1200, 10000, 9500);
      expect(result.runPhase).toBe('final_kick');
    });
  });

  describe('run phases (time-based fallback)', () => {
    it('warmup at <5 min without distance target', () => {
      const result = assessMotivation(makeSplits([300]), 300, null, 180, null, 1000);
      expect(result.runPhase).toBe('warmup');
    });

    it('settling at 5-12 min without distance target', () => {
      const result = assessMotivation(makeSplits([300, 300]), 300, null, 500, null, 2000);
      expect(result.runPhase).toBe('settling');
    });

    it('mid_grind at 12-30 min without distance target', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, null, 1200, null, 4000);
      expect(result.runPhase).toBe('mid_grind');
    });

    it('wall at 45-60 min without distance target', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, null, 3000, null, 10000);
      expect(result.runPhase).toBe('wall');
    });

    it('final_kick at 60+ min without distance target', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, null, 3700, null, 12000);
      expect(result.runPhase).toBe('final_kick');
    });
  });

  // ── Mindset Mode (selectMindsetMode) ──

  describe('mindset mode', () => {
    it('struggling always returns how', () => {
      // Struggling in warmup (early phase)
      const result = assessMotivation(makeSplits([280, 310, 340]), 340, 300, 60, 10000, 500);
      expect(result.mindsetMode).toBe('how');
    });

    it('wall phase returns how even when steady', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 1200, 10000, 8500);
      expect(result.mindsetMode).toBe('how');
    });

    it('final_kick returns how even when steady', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 1200, 10000, 9500);
      expect(result.mindsetMode).toBe('how');
    });

    it('surging returns why', () => {
      const result = assessMotivation(makeSplits([320, 300, 280]), 280, 300, 900, 10000, 4000);
      expect(result.mindsetMode).toBe('why');
    });

    it('warmup steady returns why', () => {
      const result = assessMotivation(makeSplits([300]), 300, 300, 60, 10000, 500);
      expect(result.mindsetMode).toBe('why');
    });

    it('mid_grind steady returns how (stay in flow)', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 900, 10000, 4000);
      expect(result.mindsetMode).toBe('how');
    });
  });

  // ── Momentum (detectMomentum) ──

  describe('momentum detection', () => {
    it('returns stable with fewer than 3 splits', () => {
      const result = assessMotivation(makeSplits([300, 300]), 300, 300, 600, 5000, 2000);
      expect(result.momentum).toBe('stable');
    });

    it('returns stable with consistent pace', () => {
      const result = assessMotivation(makeSplits([300, 301, 299, 300, 301]), 300, 300, 1500, 10000, 5000);
      expect(result.momentum).toBe('stable');
    });

    it('detects fading when pace increases significantly', () => {
      const result = assessMotivation(makeSplits([280, 285, 290, 310, 330]), 330, 300, 1500, 10000, 5000);
      expect(result.momentum).toBe('fading');
    });

    it('detects breakthrough when pace drops significantly', () => {
      const result = assessMotivation(makeSplits([320, 315, 300, 280, 270]), 270, 300, 1500, 10000, 5000);
      expect(result.momentum).toBe('breakthrough');
    });

    it('detects recovering when was slowing then improved', () => {
      // First half: 280 → 330 (slowing, +18%)
      // Second half: 300, 280, 270 (avg ~283, clearly faster than first avg ~305)
      const result = assessMotivation(makeSplits([280, 330, 300, 280, 270]), 270, 300, 1500, 10000, 5000);
      expect(result.momentum).toBe('recovering');
    });
  });

  // ── Self-Talk Cues (generateSelfTalkCue) ──

  describe('self-talk cues', () => {
    it('always returns a non-empty string', () => {
      const result = assessMotivation(makeSplits([300, 300]), 300, 300, 600, 5000, 2000);
      expect(result.selfTalkCue).toBeTruthy();
      expect(result.selfTalkCue.length).toBeGreaterThan(0);
    });

    it('warmup cue for novice mentions showing up', () => {
      const result = assessMotivation(makeSplits([300]), 300, 300, 60, 10000, 500, 'beginner');
      expect(result.selfTalkCue).toContain('showed up');
    });

    it('warmup cue for experienced mentions warm up', () => {
      const result = assessMotivation(makeSplits([300]), 300, 300, 60, 10000, 500, 'advanced');
      expect(result.selfTalkCue).toContain('warm up');
    });

    it('wall phase cue mentions body-focus (shoulders/hands/breathe)', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 1200, 10000, 8500);
      expect(result.selfTalkCue).toContain('shoulders');
    });

    it('final kick struggling cue is encouraging', () => {
      const result = assessMotivation(makeSplits([280, 310, 340]), 340, 300, 1200, 10000, 9500);
      expect(result.selfTalkCue).toContain('Almost there');
    });

    it('surging why-mode cue mentions training', () => {
      const result = assessMotivation(makeSplits([320, 300, 280]), 280, 300, 600, 10000, 1500);
      expect(result.selfTalkCue).toContain('train');
    });
  });

  // ── Experience-Adaptive Approach ──

  describe('experience-adaptive approach', () => {
    it('novice struggling gets self-proof emphasis', () => {
      const result = assessMotivation(
        makeSplits([280, 310, 340]),
        340, 300, 900, 10000, 4000, 'beginner'
      );
      expect(result.approach).toContain('Novice runner');
    });

    it('experienced runner at wall gets identity connection', () => {
      const result = assessMotivation(
        makeSplits([300, 300, 300]),
        300, 300, 1200, 10000, 8500, 'experienced'
      );
      expect(result.approach).toContain('Experienced runner');
    });

    it('no experience-specific text without experienceLevel', () => {
      const result = assessMotivation(
        makeSplits([280, 310, 340]),
        340, 300, 900, 10000, 4000
      );
      expect(result.approach).not.toContain('Novice');
      expect(result.approach).not.toContain('Experienced');
    });
  });

  // ── Integration: approach includes phase + mindset + energy ──

  describe('multi-layered approach text', () => {
    it('approach includes phase label', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 900, 10000, 4000);
      expect(result.approach).toContain('Mid-run');
    });

    it('approach includes mindset guidance', () => {
      // Warmup + steady → why mode
      const result = assessMotivation(makeSplits([300]), 300, 300, 60, 10000, 500);
      expect(result.approach).toContain('WHY');
    });

    it('struggling approach includes how guidance', () => {
      const result = assessMotivation(makeSplits([280, 310, 340]), 340, 300, 900, 10000, 4000);
      expect(result.approach).toContain('HOW');
    });

    it('wall phase approach mentions wall', () => {
      const result = assessMotivation(makeSplits([300, 300, 300]), 300, 300, 1200, 10000, 8500);
      expect(result.approach).toContain('Wall phase');
    });
  });
});
