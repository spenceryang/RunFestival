import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('platform detection', () => {
  const originalNavigator = globalThis.navigator;

  function mockNavigator(overrides: Partial<Navigator>) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, ...overrides },
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    // Reset module cache between tests so isIOS() re-reads navigator
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('isIOS returns true for iPhone user agent', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(true);
  });

  it('isIOS returns true for iPad user agent', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      platform: 'iPad',
      maxTouchPoints: 5,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(true);
  });

  it('isIOS returns true for iPad reporting as Mac (iPadOS 13+)', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(true);
  });

  it('isIOS returns false for Android', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(false);
  });

  it('isIOS returns false for desktop Mac (no touch)', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(false);
  });

  it('isIOS returns false for Windows', async () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      maxTouchPoints: 0,
    });
    const { isIOS } = await import('@/lib/audio/platform');
    expect(isIOS()).toBe(false);
  });
});
