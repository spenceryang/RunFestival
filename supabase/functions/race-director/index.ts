/**
 * Race Director — Global Agent (Supabase Edge Function)
 *
 * Runs every 60 seconds via pg_cron or external scheduler.
 * Scans active runners, detects interesting cross-runner patterns,
 * and generates collective moments using Opus 4.6.
 *
 * Deploy: supabase functions deploy race-director
 * Schedule: supabase functions schedule race-director --cron "*/1 * * * *"
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
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get active runners snapshot
  const { data: activeRuns } = await supabase
    .from('runs')
    .select('id, user_id, distance_meters, started_at, persona_used')
    .eq('status', 'active')
    .gte('started_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

  if (!activeRuns || activeRuns.length < 2) {
    return new Response(JSON.stringify({ message: 'Not enough active runners' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Detect patterns
  const totalRunners = activeRuns.length;
  const distances = activeRuns.map((r) => r.distance_meters ?? 0);
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

  // Pattern: cluster crossing milestones
  const at5k = activeRuns.filter((r) => (r.distance_meters ?? 0) >= 4500 && (r.distance_meters ?? 0) <= 5500);
  const at10k = activeRuns.filter((r) => (r.distance_meters ?? 0) >= 9500 && (r.distance_meters ?? 0) <= 10500);

  const patterns: string[] = [];
  if (at5k.length >= 3) patterns.push(`${at5k.length} runners are crossing the 5K mark right now`);
  if (at10k.length >= 2) patterns.push(`${at10k.length} runners just hit 10K`);
  if (totalRunners >= 50) patterns.push(`${totalRunners} runners active across the platform`);

  if (patterns.length === 0) {
    return new Response(JSON.stringify({ message: 'No notable patterns' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate collective moment with Opus
  let eventDescription = patterns.join('. ');

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 100,
          system: 'You are the Race Director for RunFestival. Write a brief, exciting 1-sentence announcement about what\'s happening across all runners right now. Make it feel like a live broadcast.',
          messages: [{
            role: 'user',
            content: `Current state: ${totalRunners} active runners. Average distance: ${(avgDistance / 1000).toFixed(1)}km. Patterns: ${patterns.join('; ')}. Write a broadcast message.`,
          }],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        eventDescription = result.content?.[0]?.text ?? eventDescription;
      }
    } catch {
      // Fall back to pattern text
    }
  }

  // Store the event
  await supabase.from('collective_events').insert({
    event_type: 'race_director',
    title: `Live Update: ${totalRunners} runners`,
    description: eventDescription,
    runner_count: totalRunners,
    metadata: { patterns, avgDistanceKm: avgDistance / 1000 },
  });

  return new Response(JSON.stringify({
    message: 'Race Director event created',
    runners: totalRunners,
    patterns,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
