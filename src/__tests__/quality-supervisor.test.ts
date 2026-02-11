import { describe, it, expect } from 'vitest';
import { shouldReview, formatQualityFeedback } from '@/lib/agents/quality-supervisor';
import type { QualityReview } from '@/lib/agents/quality-supervisor';

describe('quality-supervisor', () => {
  describe('shouldReview', () => {
    it('does not review message 0', () => {
      expect(shouldReview(0)).toBe(false);
    });

    it('reviews every 3rd message', () => {
      expect(shouldReview(3)).toBe(true);
      expect(shouldReview(6)).toBe(true);
      expect(shouldReview(9)).toBe(true);
    });

    it('does not review non-3rd messages', () => {
      expect(shouldReview(1)).toBe(false);
      expect(shouldReview(2)).toBe(false);
      expect(shouldReview(4)).toBe(false);
      expect(shouldReview(5)).toBe(false);
    });
  });

  describe('formatQualityFeedback', () => {
    it('returns null for empty reviews', () => {
      expect(formatQualityFeedback([])).toBeNull();
    });

    it('formats low-quality reviews with improvement note', () => {
      const reviews: QualityReview[] = [
        { score: 2, feedback: 'Too generic', issues: ['repetitive', 'off-topic'] },
      ];
      const result = formatQualityFeedback(reviews);
      expect(result).toContain('improvement');
      expect(result).toContain('repetitive');
    });

    it('formats high-quality reviews with positive note', () => {
      const reviews: QualityReview[] = [
        { score: 5, feedback: 'Great tone match', issues: [] },
      ];
      const result = formatQualityFeedback(reviews);
      expect(result).toContain('strong');
    });

    it('deduplicates issues across reviews', () => {
      const reviews: QualityReview[] = [
        { score: 3, feedback: 'OK', issues: ['too long', 'repetitive'] },
        { score: 3, feedback: 'Better', issues: ['too long', 'monotone'] },
      ];
      const result = formatQualityFeedback(reviews);
      // Should contain each unique issue only once
      const longCount = (result?.match(/too long/g) || []).length;
      expect(longCount).toBe(1);
    });

    it('includes latest feedback', () => {
      const reviews: QualityReview[] = [
        { score: 4, feedback: 'Old feedback', issues: [] },
        { score: 4, feedback: 'Latest feedback here', issues: [] },
      ];
      const result = formatQualityFeedback(reviews);
      expect(result).toContain('Latest feedback here');
    });
  });
});
