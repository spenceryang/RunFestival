import type { PersonaVoiceConfig } from '@/types/coach';
import { getApiHeaders } from '@/lib/auth/demo-headers';
import { ttsUsageTracker } from './tts-usage-tracker';

const TTS_TIMEOUT_MS = 15_000; // 15 second timeout for TTS requests

/**
 * Request TTS audio from OpenAI via our proxy endpoint.
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

  console.warn('[TTS] Requesting:', text.slice(0, 50) + (text.length > 50 ? '...' : ''));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: getApiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        text,
        voice: voiceConfig.voice,
        speed: voiceConfig.speed,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    // Record successful request
    ttsUsageTracker.recordRequest(text.length);

    const buffer = await response.arrayBuffer();
    console.warn('[TTS] Received audio:', buffer.byteLength, 'bytes');
    return buffer;
  } finally {
    clearTimeout(timeoutId);
  }
}
