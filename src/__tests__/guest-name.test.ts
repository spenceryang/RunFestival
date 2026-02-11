import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGuestName, setGuestName } from '@/lib/guest-name';

describe('guest-name', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getGuestName', () => {
    it('returns null when no guest name is set', () => {
      expect(getGuestName()).toBeNull();
    });

    it('returns the stored guest name', () => {
      localStorage.setItem('runfestival-guest-name', 'Alice');
      expect(getGuestName()).toBe('Alice');
    });

    it('returns null when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      expect(getGuestName()).toBeNull();
      vi.restoreAllMocks();
    });
  });

  describe('setGuestName', () => {
    it('stores the guest name in localStorage', () => {
      setGuestName('Bob');
      expect(localStorage.getItem('runfestival-guest-name')).toBe('Bob');
    });

    it('trims whitespace from the name', () => {
      setGuestName('  Charlie  ');
      expect(localStorage.getItem('runfestival-guest-name')).toBe('Charlie');
    });

    it('silently handles localStorage errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      // Should not throw
      expect(() => setGuestName('Bob')).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});
