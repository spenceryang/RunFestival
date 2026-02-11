import type { PersonaVoiceConfig } from '@/types/coach';
import { getApiHeaders } from '@/lib/auth/demo-headers';
import { ttsUsageTracker } from './tts-usage-tracker';

/**
 * Request TTS audio from ElevenLabs via our proxy endpoint.
 * Returns the audio as an ArrayBuffer for playback.
 *
 * Guarded by the usage tracker — blocks requests when:
 * - Session is inactive (app backgrounded)
 * - Rate limit exceeded
 * - Session character limit reached
 * - Single request too long
 */
export async function requestTTS(
  text: string,
  voiceConfig: PersonaVoiceConfig
): Promise<ArrayBuffer> {
  // Check usage guard
  const check = ttsUsageTracker.canMakeRequest(text);
  if (!check.allowed) {
    ttsUsageTracker.recordBlocked();
    throw new Error(`TTS blocked: ${check.reason}`);
  }

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

  // Record successful request
  ttsUsageTracker.recordRequest(text.length);

  return response.arrayBuffer();
}
