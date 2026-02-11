import { NextRequest } from 'next/server';
import { buildSystemPrompt, buildTriggerPrompt } from '@/lib/coach/prompts';
import type { CoachingContext } from '@/types/coach';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let context: CoachingContext;
  try {
    context = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildSystemPrompt(context.persona);
  const triggerPrompt = buildTriggerPrompt(context.trigger.type);

  const userMessage = `${triggerPrompt}

CURRENT RUN STATE:
- Distance: ${(context.runState.distanceMeters / 1000).toFixed(2)}km${context.runState.targetDistanceMeters ? ` of ${(context.runState.targetDistanceMeters / 1000).toFixed(1)}km` : ''}
- Current pace: ${formatPaceInline(context.runState.currentPaceSecondsPerKm)}/km${context.runState.targetPaceSecondsPerKm ? ` (target: ${formatPaceInline(context.runState.targetPaceSecondsPerKm)}/km)` : ''}
- Elapsed: ${formatTimeInline(context.runState.elapsedSeconds)}
- Splits: ${context.runState.splits.map((s) => `Split ${s.number}: ${formatPaceInline(s.paceSeconds)}/km`).join(', ') || 'None yet'}

LIVE COLLECTIVE:
- ${context.collective.runnerCount} people running right now
- Average pace: ${context.collective.averagePaceFormatted}/km
${context.collective.recentEvents.length > 0 ? `- Recent: ${context.collective.recentEvents.map((e) => e.text).join('; ')}` : ''}

RUNNER PROFILE:
- Name: ${context.profile.name}
${context.profile.storyTopics.length > 0 ? `- Story topics: ${context.profile.storyTopics.join(', ')}` : ''}

${JSON.stringify(context.trigger.data)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 150,
        stream: true,
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

    // Forward the stream directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach Claude API' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

function formatPaceInline(secondsPerKm: number): string {
  if (secondsPerKm <= 0 || !isFinite(secondsPerKm)) return '--:--';
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeInline(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
