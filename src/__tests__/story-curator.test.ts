import { describe, it, expect } from 'vitest';
import { selectNextTopic } from '@/lib/agents/story-curator';

describe('story-curator', () => {
  describe('selectNextTopic', () => {
    it('picks an uncovered topic from user interests', () => {
      const result = selectNextTopic(
        ['history', 'science', 'music'],
        ['history']
      );
      expect(['science', 'music']).toContain(result);
    });

    it('returns first interest when all are covered', () => {
      const result = selectNextTopic(
        ['history', 'science'],
        ['history', 'science']
      );
      expect(result).toBe('history');
    });

    it('falls back to default topics when no interests', () => {
      const result = selectNextTopic([], []);
      expect(['history', 'science', 'nature', 'culture', 'sports']).toContain(result);
    });

    it('avoids partially matching covered topics', () => {
      const result = selectNextTopic(
        ['history', 'music'],
        ['Ancient History of Rome']
      );
      // 'history' matches 'Ancient History of Rome', so should pick 'music'
      expect(result).toBe('music');
    });

    it('handles empty covered topics', () => {
      const result = selectNextTopic(['science', 'food'], []);
      expect(['science', 'food']).toContain(result);
    });
  });
});
