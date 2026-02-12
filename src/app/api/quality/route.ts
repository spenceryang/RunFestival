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

  // Auth check — skip for dev mode (unauthenticated)
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
    coachingMessage: string;
    triggerType: string;
    persona: string;
    runContext: {
      distanceKm: number;
      paceFormatted: string;
      elapsedMinutes: number;
    };
    previousTopics: string[];
  };

  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `You are a coaching quality reviewer for RunFestival. Evaluate a coaching message and return a JSON quality review. Be concise and actionable.`;

  const userMessage = `Review this coaching message:

Message: "${input.coachingMessage}"
Trigger: ${input.triggerType}
Persona: ${input.persona}
Run context: ${input.runContext.distanceKm.toFixed(1)}km, pace ${input.runContext.paceFormatted}, ${input.runContext.elapsedMinutes.toFixed(0)} min elapsed
Previously covered topics: ${input.previousTopics.join(', ') || 'none'}

Evaluate on:
1. Relevance (does it match the trigger type?)
2. Tone (does it match the ${input.persona} persona?)
3. Repetition (does it avoid topics already covered?)
4. Engagement (would a runner enjoy hearing this?)
5. Brevity (appropriate length for audio while running?)

Respond with JSON only:
{
  "score": <1-5>,
  "feedback": "<1 sentence of key improvement>",
  "issues": ["<issue1>", "<issue2>"]
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
        max_tokens: 200,
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid review format' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const review = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({ review }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to generate quality review' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
