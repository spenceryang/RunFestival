import type { PersonaVoiceConfig } from '@/types/coach';
import { getApiHeaders } from '@/lib/auth/demo-headers';

/**
 * Request TTS audio from ElevenLabs via our proxy endpoint.
 * Returns the audio as an ArrayBuffer for playback.
 */
export async function requestTTS(
  text: string,
  voiceConfig: PersonaVoiceConfig
): Promise<ArrayBuffer> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({
      text,
      voiceId: voiceConfig.elevenLabsVoiceId,
      stability: voiceConfig.stability,
      similarity: voiceConfig.similarity,
      style: voiceConfig.style,
      speed: voiceConfig.speed,
    }),
  });

  if (!response.ok) {
    throw new Error(`TTS API error: ${response.status}`);
  }

  return response.arrayBuffer();
}
