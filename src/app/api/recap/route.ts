import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data: {
    distanceMeters: number;
    elapsedSeconds: number;
    averagePaceSecondsPerKm: number;
    targetPaceSecondsPerKm: number | null;
    targetDistanceMeters: number | null;
    splits: Array<{ number: number; paceSeconds: number }>;
    persona: string;
    runnerCount: number;
  };

  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `You are a running coach writing a brief, personal post-run recap on RunFestival. Write in second person ("you"). Be warm, specific about what happened in THIS run, and insightful. 3-4 sentences max. Reference their actual pace, splits, and patterns — don't be generic. End with one forward-looking sentence about what to try next time. Never mention being AI.`;

  const splitsText =
    data.splits
      .map((s) => `Split ${s.number}: ${formatPace(s.paceSeconds)}/km`)
      .join(', ') || 'None';

  const userMessage = `Write a post-run narrative recap:
- Distance: ${(data.distanceMeters / 1000).toFixed(2)} km
- Duration: ${formatTime(data.elapsedSeconds)}
- Average pace: ${formatPace(data.averagePaceSecondsPerKm)}/km
${data.targetPaceSecondsPerKm ? `- Target pace: ${formatPace(data.targetPaceSecondsPerKm)}/km` : ''}
${data.targetDistanceMeters ? `- Target distance: ${(data.targetDistanceMeters / 1000).toFixed(1)} km` : ''}
- Splits: ${splitsText}
- Coaching persona: ${data.persona}
${data.runnerCount > 0 ? `- Ran alongside ${data.runnerCount} others on RunFestival` : ''}`;

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

    return new Response(JSON.stringify({ narrative: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to generate recap' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function formatPace(secondsPerKm: number): string {
  if (secondsPerKm <= 0 || !isFinite(secondsPerKm)) return '--:--';
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
