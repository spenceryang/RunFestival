import { createServerClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in Edge Runtime API routes.
 * Reads auth cookies from the raw Request headers (read-only).
 * Use this instead of server.ts which requires next/headers cookies().
 */
export function createEdgeSupabaseClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const match = cookieHeader.match(
            new RegExp(`(?:^|;\\s*)${escapeRegExp(name)}=([^;]*)`)
          );
          return match ? decodeURIComponent(match[1]) : undefined;
        },
        set() {
          // Edge routes cannot set cookies in responses via this adapter
        },
        remove() {
          // Edge routes cannot remove cookies via this adapter
        },
      },
    }
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
