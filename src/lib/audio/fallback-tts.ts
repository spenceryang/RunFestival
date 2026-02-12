/**
 * Browser SpeechSynthesis fallback when ElevenLabs is unavailable.
 * Returns a promise that resolves when speech is complete.
 *
 * iOS-specific handling:
 * - Voices load asynchronously — must wait for 'voiceschanged' event
 * - SpeechSynthesis can silently hang in PWA mode — stuck-speech timeout
 * - Errors now reject (not resolve) so the caller can fall back properly
 */

/**
 * Wait for voices to load. iOS loads voices asynchronously, so
 * getVoices() may return an empty array on first call.
 */
export function waitForVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), timeoutMs);

    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(timeout);
        resolve(speechSynthesis.getVoices());
      },
      { once: true }
    );
  });
}

export async function speakWithBrowserTTS(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) {
    throw new Error('SpeechSynthesis not supported');
  }

  const voices = await waitForVoices();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Try to use a natural-sounding voice
    const preferred = voices.find(
      (v) => v.name.includes('Samantha') || v.name.includes('Google') || v.lang === 'en-US'
    );
    if (preferred) utterance.voice = preferred;

    // iOS Safari PWA workaround: speech can silently hang without
    // firing onend or onerror. Set a timeout proportional to text length.
    const maxWaitMs = Math.max(text.length * 100, 10000);
    const stuckTimeout = setTimeout(() => {
      console.warn('[FallbackTTS] Speech appears stuck, rejecting after', maxWaitMs, 'ms');
      speechSynthesis.cancel();
      reject(new Error('SpeechSynthesis timed out'));
    }, maxWaitMs);

    utterance.onend = () => {
      clearTimeout(stuckTimeout);
      resolve();
    };

    utterance.onerror = (event) => {
      clearTimeout(stuckTimeout);
      console.warn('[FallbackTTS] SpeechSynthesis error:', event.error);
      reject(new Error(`SpeechSynthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}
