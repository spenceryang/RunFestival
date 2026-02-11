import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isStandalonePwa } from '@/lib/pwa-detect';

describe('isStandalonePwa', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Ensure matchMedia exists in test env
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    // Clean up navigator.standalone
    Object.defineProperty(window.navigator, 'standalone', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('returns false in standard browser (no standalone)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(isStandalonePwa()).toBe(false);
  });

  it('returns true when navigator.standalone is true (iOS PWA)', () => {
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      writable: true,
      configurable: true,
    });
    expect(isStandalonePwa()).toBe(true);
  });

  it('returns true when display-mode: standalone matches (Android/desktop PWA)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isStandalonePwa()).toBe(true);
  });
});
