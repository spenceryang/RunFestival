import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'edge';

/**
 * GET /api/community-runs
 * Returns recent completed runs for the community feed.
 * Uses service role key to bypass RLS (runs table restricts SELECT to own user).
 * Returns only public-safe fields — no GPS, coaching messages, or AI summaries.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ runs: [] }), {
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
    const { data: runs, error } = await supabase
      .from('runs')
      .select(`
        id,
        user_id,
        distance_meters,
        elapsed_seconds,
        average_pace_seconds_per_km,
        persona_used,
        finished_at,
        users ( name, city )
      `)
      .eq('status', 'completed')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Failed to fetch community runs:', error.message);
      return new Response(JSON.stringify({ runs: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const timelineRuns = (runs ?? []).map((run) => {
      // Supabase returns joined data as an object (single) or array (multiple).
      // With a foreign key join on user_id -> users.id, it's a single object.
      const rawUser = run.users as unknown;
      const user = (Array.isArray(rawUser) ? rawUser[0] : rawUser) as
        | { name: string; city: string | null }
        | null
        | undefined;
      return {
        id: run.id,
        userId: run.user_id,
        displayName: user?.name ?? 'Runner',
        city: user?.city ?? '',
        distanceMeters: run.distance_meters ?? 0,
        elapsedSeconds: run.elapsed_seconds ?? 0,
        averagePaceSecondsPerKm: run.average_pace_seconds_per_km ?? 0,
        persona: run.persona_used ?? 'hype',
        completedAt: run.finished_at ? new Date(run.finished_at).getTime() : Date.now(),
        isSynthetic: false,
      };
    });

    return new Response(JSON.stringify({ runs: timelineRuns }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch {
    return new Response(JSON.stringify({ runs: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
