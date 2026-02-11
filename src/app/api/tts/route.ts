import { NextRequest } from 'next/server';
import { createEdgeSupabaseClient } from '@/lib/supabase/edge';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), {
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

  let body: {
    text: string;
    voiceId: string;
    stability?: number;
    similarity?: number;
    style?: number;
    speed?: number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.text || !body.voiceId) {
    return new Response(JSON.stringify({ error: 'text and voiceId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Server-side cost guard: reject oversized requests
  if (body.text.length > 1000) {
    return new Response(JSON.stringify({ error: 'Text exceeds maximum length (1000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${body.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: body.text,
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_64',
          voice_settings: {
            stability: body.stability ?? 0.5,
            similarity_boost: body.similarity ?? 0.75,
            style: body.style ?? 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream audio back to client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to reach ElevenLabs API' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
