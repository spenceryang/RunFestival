import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  })),
}));

// Chain mocks
mockInsert.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ single: mockSingle });
mockUpdate.mockReturnValue({ eq: mockEq });
mockDelete.mockReturnValue({ eq: mockEq });

import { joinActiveRunners, heartbeatActiveRunner, leaveActiveRunners } from '@/lib/services/active-runners';

describe('active-runners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  describe('joinActiveRunners', () => {
    it('returns row ID on success', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'row-123' }, error: null });

      const id = await joinActiveRunners({
        userId: 'user-1',
        runId: 'run-1',
        displayName: 'Test Runner',
        city: 'San Francisco',
      });

      expect(id).toBe('row-123');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          run_id: 'run-1',
          display_name: 'Test Runner',
          city: 'San Francisco',
          is_synthetic: false,
        })
      );
    });

    it('returns null on DB error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS error' } });

      const id = await joinActiveRunners({
        userId: 'user-1',
        displayName: 'Runner',
        city: 'NYC',
      });

      expect(id).toBeNull();
    });

    it('returns null on network error', async () => {
      mockSingle.mockRejectedValue(new Error('Network error'));

      const id = await joinActiveRunners({
        userId: 'user-1',
        displayName: 'Runner',
        city: 'LA',
      });

      expect(id).toBeNull();
    });

    it('handles null runId', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'row-456' }, error: null });

      await joinActiveRunners({
        userId: 'guest-1',
        displayName: 'Guest',
        city: 'Unknown',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: null,
        })
      );
    });
  });

  describe('heartbeatActiveRunner', () => {
    it('updates heartbeat timestamp', async () => {
      mockEq.mockResolvedValue({ error: null });

      await heartbeatActiveRunner('row-123', {
        distanceMeters: 5000,
        currentPaceSecondsPerKm: 330,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_distance_meters: 5000,
          current_pace_seconds_per_km: 330,
        })
      );
    });

    it('does not throw on error', async () => {
      mockEq.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(heartbeatActiveRunner('row-123')).resolves.toBeUndefined();
    });
  });

  describe('leaveActiveRunners', () => {
    it('deletes the row', async () => {
      mockEq.mockResolvedValue({ error: null });

      await leaveActiveRunners('row-123');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'row-123');
    });

    it('does not throw on error', async () => {
      mockEq.mockRejectedValue(new Error('DB error'));

      await expect(leaveActiveRunners('row-123')).resolves.toBeUndefined();
    });
  });
});
