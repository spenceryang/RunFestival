import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceInput } from '@/lib/audio/voice-input';

class MockRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

describe('VoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
    });
    (globalThis as typeof globalThis & { webkitSpeechRecognition?: typeof MockRecognition }).webkitSpeechRecognition = MockRecognition as unknown as typeof SpeechRecognition;
  });

  it('reports support when webkitSpeechRecognition exists', () => {
    expect(VoiceInput.isSupported()).toBe(true);
  });

  it('calls onEnd only once when iOS emits both onerror and onend', () => {
    const voiceInput = new VoiceInput();
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    voiceInput.start(onResult, onEnd, onError);

    const recognition = (voiceInput as unknown as { recognition: MockRecognition }).recognition;
    expect(recognition).toBeTruthy();

    recognition!.onerror?.({ error: 'aborted', message: 'aborted' } as SpeechRecognitionErrorEvent);
    recognition!.onend?.();

    expect(onError).toHaveBeenCalledWith('aborted');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it('does not call onError when start throws; caller handles boolean fallback', () => {
    class ThrowingRecognition extends MockRecognition {
      start = vi.fn(() => {
        throw new Error('gesture-required');
      });
    }

    (globalThis as typeof globalThis & { webkitSpeechRecognition?: typeof ThrowingRecognition }).webkitSpeechRecognition = ThrowingRecognition as unknown as typeof SpeechRecognition;

    const voiceInput = new VoiceInput();
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    const started = voiceInput.start(onResult, onEnd, onError);

    expect(started).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

});
