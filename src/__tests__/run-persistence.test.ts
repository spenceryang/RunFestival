import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'runs') {
        return {
          insert: (data: unknown) => {
            mockInsert(data);
            return {
              select: (cols: string) => {
                mockSelect(cols);
                return {
                  single: () => mockSingle(),
                };
              },
            };
          },
          update: (data: unknown) => {
            mockUpdate(data);
            return {
              eq: (col: string, val: string) => {
                mockEq(col, val);
                return mockEq();
              },
            };
          },
        };
      }
      return {};
    },
  }),
}));

import {
  createRunRecord,
  completeRunRecord,
  updateRunAiSummary,
} from '@/lib/services/run-persistence';

describe('run-persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: eq returns success
    mockEq.mockReturnValue(Promise.resolve({ error: null }));
  });

  describe('createRunRecord', () => {
    it('returns run ID on successful insert', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'run-uuid-123' },
        error: null,
      });

      const result = await createRunRecord({
        userId: 'user-1',
        targetDistanceMeters: 5000,
        targetPaceSecondsPerKm: 300,
        persona: 'hype',
      });

      expect(result).toBe('run-uuid-123');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          status: 'active',
          target_distance_meters: 5000,
          target_pace_seconds_per_km: 300,
          persona_used: 'hype',
        })
      );
    });

    it('returns null on insert error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await createRunRecord({
        userId: 'user-1',
        targetDistanceMeters: null,
        targetPaceSecondsPerKm: null,
        persona: 'calm',
      });

      expect(result).toBeNull();
    });

    it('returns null on network exception', async () => {
      mockSingle.mockRejectedValue(new Error('Network error'));

      const result = await createRunRecord({
        userId: 'user-1',
        targetDistanceMeters: 5000,
        targetPaceSecondsPerKm: 300,
        persona: 'data',
      });

      expect(result).toBeNull();
    });

    it('passes null targets correctly', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'run-uuid-456' },
        error: null,
      });

      await createRunRecord({
        userId: 'user-2',
        targetDistanceMeters: null,
        targetPaceSecondsPerKm: null,
        persona: 'storyteller',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_distance_meters: null,
          target_pace_seconds_per_km: null,
        })
      );
    });
  });

  describe('completeRunRecord', () => {
    it('returns true on successful update', async () => {
      mockEq.mockReturnValue(Promise.resolve({ error: null }));

      const result = await completeRunRecord({
        runId: 'run-123',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        averagePaceSecondsPerKm: 300,
        splits: [
          { number: 1, distanceMeters: 1000, paceSeconds: 305, elapsedSeconds: 305 },
          { number: 2, distanceMeters: 1000, paceSeconds: 298, elapsedSeconds: 603 },
        ],
        gpsPoints: [
          { lat: 37.77, lng: -122.42, altitude: null, speed: null, timestamp: 1000, accuracy: 5 },
        ],
        coachingMessages: [
          { triggerType: 'split_complete', text: 'Great first km!', timestamp: 305000 },
        ],
      });

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          distance_meters: 5000,
          elapsed_seconds: 1500,
          average_pace_seconds_per_km: 300,
        })
      );
    });

    it('returns false on update error', async () => {
      mockEq.mockReturnValue(Promise.resolve({ error: { message: 'Update failed' } }));

      const result = await completeRunRecord({
        runId: 'run-123',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        averagePaceSecondsPerKm: 300,
        splits: [],
        gpsPoints: [],
        coachingMessages: [],
      });

      expect(result).toBe(false);
    });

    it('handles optional fields', async () => {
      mockEq.mockReturnValue(Promise.resolve({ error: null }));

      await completeRunRecord({
        runId: 'run-123',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        averagePaceSecondsPerKm: 300,
        splits: [],
        gpsPoints: [],
        coachingMessages: [],
        aiSummary: 'Great run!',
        collectiveCount: 42,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_summary: 'Great run!',
          collective_count: 42,
        })
      );
    });
  });

  describe('updateRunAiSummary', () => {
    it('updates AI summary without throwing', async () => {
      mockEq.mockReturnValue(Promise.resolve({ error: null }));

      await expect(
        updateRunAiSummary('run-123', 'AI generated summary')
      ).resolves.not.toThrow();

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_summary: 'AI generated summary',
        })
      );
    });

    it('silently handles errors', async () => {
      mockEq.mockReturnValue(Promise.reject(new Error('Network error')));

      await expect(
        updateRunAiSummary('run-123', 'summary')
      ).resolves.not.toThrow();
    });
  });
});
