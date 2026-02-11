import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildTriggerPrompt, PERSONA_VOICE_CONFIG } from '@/lib/coach/prompts';

describe('buildSystemPrompt', () => {
  it('includes base rules for all personas', () => {
    const personas = ['hype', 'calm', 'data', 'storyteller'] as const;
    for (const persona of personas) {
      const prompt = buildSystemPrompt(persona);
      expect(prompt).toContain('CRITICAL RULES');
      expect(prompt).toContain('2-3 SHORT sentences');
      expect(prompt).toContain('NEVER tell the runner what to do');
    }
  });

  it('includes hype-specific content', () => {
    const prompt = buildSystemPrompt('hype');
    expect(prompt).toContain('HYPE COACH');
    expect(prompt).toContain("LET'S GO");
  });

  it('includes calm-specific content', () => {
    const prompt = buildSystemPrompt('calm');
    expect(prompt).toContain('CALM GUIDE');
    expect(prompt).toContain('breathing');
  });

  it('includes data-specific content', () => {
    const prompt = buildSystemPrompt('data');
    expect(prompt).toContain('DATA NERD');
    expect(prompt).toContain('Analytical');
  });

  it('includes storyteller-specific content', () => {
    const prompt = buildSystemPrompt('storyteller');
    expect(prompt).toContain('STORYTELLER');
    expect(prompt).toContain('stories');
  });
});

describe('buildTriggerPrompt', () => {
  it('returns prompt for each trigger type', () => {
    const triggers = [
      'split_complete',
      'pace_drift',
      'halfway',
      'final_push',
      'idle_storytelling',
      'user_initiated',
    ] as const;

    for (const trigger of triggers) {
      const prompt = buildTriggerPrompt(trigger);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(20);
      expect(prompt).toContain('TRIGGER');
    }
  });

  it('split_complete mentions split feedback', () => {
    expect(buildTriggerPrompt('split_complete')).toContain('split');
  });

  it('pace_drift mentions options', () => {
    expect(buildTriggerPrompt('pace_drift')).toContain('nag');
  });

  it('halfway mentions celebrate', () => {
    expect(buildTriggerPrompt('halfway')).toContain('Celebrate');
  });

  it('final_push mentions energy', () => {
    expect(buildTriggerPrompt('final_push')).toContain('energy');
  });

  it('user_initiated mentions warm response', () => {
    expect(buildTriggerPrompt('user_initiated')).toContain('warmly');
  });
});

describe('PERSONA_VOICE_CONFIG', () => {
  it('has config for all 4 personas', () => {
    expect(PERSONA_VOICE_CONFIG).toHaveProperty('hype');
    expect(PERSONA_VOICE_CONFIG).toHaveProperty('calm');
    expect(PERSONA_VOICE_CONFIG).toHaveProperty('data');
    expect(PERSONA_VOICE_CONFIG).toHaveProperty('storyteller');
  });

  it('each config has required fields', () => {
    for (const config of Object.values(PERSONA_VOICE_CONFIG)) {
      expect(config.elevenLabsVoiceId).toBeTruthy();
      expect(config.stability).toBeGreaterThanOrEqual(0);
      expect(config.stability).toBeLessThanOrEqual(1);
      expect(config.similarity).toBeGreaterThanOrEqual(0);
      expect(config.similarity).toBeLessThanOrEqual(1);
      expect(config.style).toBeGreaterThanOrEqual(0);
      expect(config.style).toBeLessThanOrEqual(1);
      expect(config.speed).toBeGreaterThan(0);
    }
  });

  it('hype has lower stability for expressiveness', () => {
    expect(PERSONA_VOICE_CONFIG.hype.stability).toBeLessThan(
      PERSONA_VOICE_CONFIG.calm.stability
    );
  });

  it('hype has faster speed', () => {
    expect(PERSONA_VOICE_CONFIG.hype.speed).toBeGreaterThan(
      PERSONA_VOICE_CONFIG.calm.speed
    );
  });
});
