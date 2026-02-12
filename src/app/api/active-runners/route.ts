import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'edge';

/**
 * GET /api/active-runners
 * Returns the count of currently active runners (heartbeat within last 5 minutes).
 * Uses service role key to bypass RLS.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(
          new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`)
        );
        return match ? decodeURIComponent(match[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });

  try {
    // Count active runners with heartbeat in the last 5 minutes
    const { count, error } = await supabase
      .from('active_runners')
      .select('*', { count: 'exact', head: true })
      .gte('last_heartbeat', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (error) {
      console.warn('Failed to count active runners:', error.message);
      return new Response(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ count: count ?? 0 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch {
    return new Response(JSON.stringify({ count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
