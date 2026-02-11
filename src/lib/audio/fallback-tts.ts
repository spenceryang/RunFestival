/**
 * Browser SpeechSynthesis fallback when ElevenLabs is unavailable.
 * Returns a promise that resolves when speech is complete.
 */
export function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('SpeechSynthesis not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Try to use a natural-sounding voice
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes('Samantha') || v.name.includes('Google') || v.lang === 'en-US'
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Don't crash on speech errors

    speechSynthesis.speak(utterance);
  });
}
