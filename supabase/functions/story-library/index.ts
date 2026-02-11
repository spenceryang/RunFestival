/**
 * Story Library Curator — Global Agent (Supabase Edge Function)
 *
 * Runs daily. Generates fresh story seeds by topic and activity type.
 * Stories are pre-planned as multi-part arcs that the per-user
 * Story Curator agent can pick from.
 *
 * Deploy: supabase functions deploy story-library
 * Schedule: daily via cron
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOPICS = ['history', 'science', 'culture', 'sports', 'nature', 'music', 'technology', 'food'];
const ACTIVITY_TYPES = ['running', 'hiking', 'cycling', 'walking'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate stories for a subset of topic+activity combinations per day
  const today = new Date();
  const dayIndex = today.getDate() % TOPICS.length;
  const topicsToday = [TOPICS[dayIndex], TOPICS[(dayIndex + 1) % TOPICS.length]];

  const stories: Array<{
    activity_type: string;
    topic: string;
    title: string;
    arc: { part1: string; part2: string; part3: string };
    facts: string[];
  }> = [];

  for (const activity of ACTIVITY_TYPES) {
    for (const topic of topicsToday) {
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
            max_tokens: 500,
            system: `Generate a fascinating 3-part story plan for someone who is ${activity}. Topic: ${topic}. The story should be genuinely interesting and educational, told in short bursts between exercise updates. Output valid JSON only.`,
            messages: [{
              role: 'user',
              content: `Create a story plan. JSON format:
{
  "title": "<catchy title, under 8 words>",
  "arc": {
    "part1": "<1-2 sentences: set the scene, hook>",
    "part2": "<1-2 sentences: build tension/intrigue>",
    "part3": "<1-2 sentences: surprising payoff>"
  },
  "facts": ["<fact 1>", "<fact 2>", "<fact 3>"]
}`,
            }],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const text = result.content?.[0]?.text ?? '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const plan = JSON.parse(jsonMatch[0]);
            stories.push({
              activity_type: activity,
              topic,
              title: plan.title,
              arc: plan.arc,
              facts: plan.facts,
            });
          }
        }
      } catch {
        // Skip failures, continue with next
      }
    }
  }

  // Insert stories
  if (stories.length > 0) {
    await supabase.from('story_seeds').insert(stories);
  }

  return new Response(JSON.stringify({
    message: `Generated ${stories.length} story seeds`,
    topics: topicsToday,
    activities: ACTIVITY_TYPES,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
