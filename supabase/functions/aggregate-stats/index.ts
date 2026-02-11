/**
 * Aggregate Stats — Global Agent (Supabase Edge Function)
 *
 * Aggregates presence data across city-specific channels every 30 seconds.
 * Publishes summary to the global stats channel (runners:global).
 * This enables presence scaling: each city has its own channel to avoid
 * hitting the 100-user limit per channel.
 *
 * Deploy: supabase functions deploy aggregate-stats
 * Schedule: every 30s via external scheduler or pg_cron
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Query active runs for aggregate stats
  const { data: activeRuns } = await supabase
    .from('runs')
    .select('distance_meters, started_at')
    .eq('status', 'active')
    .gte('started_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

  const totalRunners = activeRuns?.length ?? 0;
  const totalDistance = activeRuns?.reduce((sum, r) => sum + (r.distance_meters ?? 0), 0) ?? 0;

  // Get recent collective events
  const { data: events } = await supabase
    .from('collective_events')
    .select('title, description, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // Broadcast to global channel
  const channel = supabase.channel('runners:global');
  await channel.send({
    type: 'broadcast',
    event: 'global_stats',
    payload: {
      totalRunners,
      totalDistanceKm: Math.round(totalDistance / 1000),
      recentEvents: events ?? [],
      timestamp: new Date().toISOString(),
    },
  });

  return new Response(JSON.stringify({
    totalRunners,
    totalDistanceKm: Math.round(totalDistance / 1000),
    eventsCount: events?.length ?? 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
