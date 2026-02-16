import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// We need to test getSiteUrl with different env var combinations.
// Since getSiteUrl reads process.env at call time, we can modify them between tests.

// Don't mock the module — import the real function
// But we do need to clear the supabase/client mock from other tests
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(),
}));

describe('getSiteUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('returns NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://runfestival.vercel.app';
    // Dynamic import to pick up fresh env
    const { getSiteUrl } = await import('@/lib/supabase/client');
    expect(getSiteUrl()).toBe('https://runfestival.vercel.app');
  });

  it('strips trailing slash from NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://runfestival.vercel.app/';
    const { getSiteUrl } = await import('@/lib/supabase/client');
    expect(getSiteUrl()).toBe('https://runfestival.vercel.app');
  });

  it('returns NEXT_PUBLIC_VERCEL_URL with https:// prefix when SITE_URL is not set', async () => {
    process.env.NEXT_PUBLIC_VERCEL_URL = 'runfestival-abc123.vercel.app';
    const { getSiteUrl } = await import('@/lib/supabase/client');
    expect(getSiteUrl()).toBe('https://runfestival-abc123.vercel.app');
  });

  it('prefers NEXT_PUBLIC_SITE_URL over NEXT_PUBLIC_VERCEL_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://runfestival.vercel.app';
    process.env.NEXT_PUBLIC_VERCEL_URL = 'runfestival-preview-abc.vercel.app';
    const { getSiteUrl } = await import('@/lib/supabase/client');
    expect(getSiteUrl()).toBe('https://runfestival.vercel.app');
  });

  it('returns localhost fallback when no env vars and no window', async () => {
    // In test environment, window is not defined (Node.js)
    const originalWindow = globalThis.window;
    // @ts-expect-error — deliberately removing window for test
    delete globalThis.window;

    const { getSiteUrl } = await import('@/lib/supabase/client');
    expect(getSiteUrl()).toBe('http://localhost:3000');

    // Restore
    globalThis.window = originalWindow;
  });
});
