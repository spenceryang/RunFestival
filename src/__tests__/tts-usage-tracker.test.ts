import { describe, it, expect, beforeEach } from 'vitest';
import { ttsUsageTracker } from '@/lib/audio/tts-usage-tracker';

describe('tts-usage-tracker', () => {
  beforeEach(() => {
    ttsUsageTracker.reset();
  });

  describe('canMakeRequest', () => {
    it('allows a normal request', () => {
      const result = ttsUsageTracker.canMakeRequest('Hello, runner!');
      expect(result.allowed).toBe(true);
    });

    it('blocks when session is inactive', () => {
      ttsUsageTracker.pauseSession();
      const result = ttsUsageTracker.canMakeRequest('Hello');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('allows after resuming session', () => {
      ttsUsageTracker.pauseSession();
      ttsUsageTracker.resumeSession();
      const result = ttsUsageTracker.canMakeRequest('Hello');
      expect(result.allowed).toBe(true);
    });

    it('blocks text exceeding max chars per request', () => {
      const longText = 'a'.repeat(1001);
      const result = ttsUsageTracker.canMakeRequest(longText);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('too long');
    });

    it('allows text at exactly max chars per request', () => {
      const text = 'a'.repeat(1000);
      const result = ttsUsageTracker.canMakeRequest(text);
      expect(result.allowed).toBe(true);
    });

    it('blocks when session character limit is reached', () => {
      // Record enough to approach the limit
      ttsUsageTracker.recordRequest(49_990);
      const result = ttsUsageTracker.canMakeRequest('a'.repeat(20));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('limit reached');
    });
  });

  describe('recordRequest', () => {
    it('tracks total characters', () => {
      ttsUsageTracker.recordRequest(100);
      ttsUsageTracker.recordRequest(200);
      const snapshot = ttsUsageTracker.getSnapshot();
      expect(snapshot.totalCharacters).toBe(300);
    });

    it('tracks total requests', () => {
      ttsUsageTracker.recordRequest(50);
      ttsUsageTracker.recordRequest(50);
      ttsUsageTracker.recordRequest(50);
      const snapshot = ttsUsageTracker.getSnapshot();
      expect(snapshot.totalRequests).toBe(3);
    });

    it('calculates estimated cost', () => {
      ttsUsageTracker.recordRequest(1000);
      const snapshot = ttsUsageTracker.getSnapshot();
      // $0.015 per 1000 chars (OpenAI TTS)
      expect(snapshot.estimatedCostUsd).toBeCloseTo(0.015, 3);
    });

    it('calculates average chars per request', () => {
      ttsUsageTracker.recordRequest(100);
      ttsUsageTracker.recordRequest(300);
      const snapshot = ttsUsageTracker.getSnapshot();
      expect(snapshot.averageCharsPerRequest).toBe(200);
    });
  });

  describe('recordBlocked', () => {
    it('increments blocked count', () => {
      ttsUsageTracker.recordBlocked();
      ttsUsageTracker.recordBlocked();
      const snapshot = ttsUsageTracker.getSnapshot();
      expect(snapshot.blockedRequests).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all tracking data', () => {
      ttsUsageTracker.recordRequest(500);
      ttsUsageTracker.recordBlocked();
      ttsUsageTracker.reset();
      const snapshot = ttsUsageTracker.getSnapshot();
      expect(snapshot.totalCharacters).toBe(0);
      expect(snapshot.totalRequests).toBe(0);
      expect(snapshot.blockedRequests).toBe(0);
      expect(snapshot.estimatedCostUsd).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('notifies on recordRequest', () => {
      let called = false;
      const unsub = ttsUsageTracker.subscribe(() => { called = true; });
      ttsUsageTracker.recordRequest(10);
      expect(called).toBe(true);
      unsub();
    });

    it('stops notifying after unsubscribe', () => {
      let callCount = 0;
      const unsub = ttsUsageTracker.subscribe(() => { callCount++; });
      ttsUsageTracker.recordRequest(10);
      unsub();
      ttsUsageTracker.recordRequest(10);
      expect(callCount).toBe(1);
    });
  });

  describe('session state', () => {
    it('starts active', () => {
      expect(ttsUsageTracker.active).toBe(true);
    });

    it('tracks pause/resume', () => {
      ttsUsageTracker.pauseSession();
      expect(ttsUsageTracker.active).toBe(false);
      ttsUsageTracker.resumeSession();
      expect(ttsUsageTracker.active).toBe(true);
    });
  });
});
