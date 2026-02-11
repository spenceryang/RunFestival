import { NextRequest } from 'next/server';
import { createEdgeSupabaseClient } from '@/lib/supabase/edge';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth check — skip for demo mode
  if (request.headers.get('x-demo-mode') !== 'true') {
    const supabase = createEdgeSupabaseClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let input: {
    userInterests: string[];
    activityType: string;
    topicsCovered: string[];
    persona: string;
  };

  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const availableTopics = input.userInterests.filter(
    (t) => !input.topicsCovered.some((c) => c.toLowerCase().includes(t.toLowerCase()))
  );
  const topic = availableTopics[0] ?? input.userInterests[0] ?? 'history';

  const systemPrompt = `You are a story planning agent for RunFestival, a running app with AI coaching. Generate a concise 3-part story plan that a coach can tell in short bursts while someone is ${input.activityType}. The story should be genuinely fascinating and educational. Output valid JSON only.`;

  const userMessage = `Create a story plan about "${topic}" for a ${input.persona} coaching persona.

Requirements:
- Title: catchy, short (under 8 words)
- 3-part arc: each part is 1-2 sentences describing what the coach should cover
- Part 1 sets the scene, Part 2 builds tension/intrigue, Part 3 delivers the payoff
- 3-5 key facts the coach can weave in
- Make it genuinely interesting — this is entertainment during exercise

Topics already covered (avoid): ${input.topicsCovered.join(', ') || 'none'}

Respond with JSON:
{
  "title": "...",
  "topic": "${topic}",
  "arc": { "part1": "...", "part2": "...", "part3": "..." },
  "keyFacts": ["...", "...", "..."],
  "activityType": "${input.activityType}"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text ?? '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid story plan format' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({ plan }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to generate story plan' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
