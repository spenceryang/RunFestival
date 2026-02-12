import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock speechSynthesis
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn().mockReturnValue([]);
const mockAddEventListener = vi.fn();

Object.defineProperty(globalThis, 'speechSynthesis', {
  value: {
    speak: mockSpeak,
    cancel: mockCancel,
    getVoices: mockGetVoices,
    addEventListener: mockAddEventListener,
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
  value: class MockUtterance {
    text: string;
    rate = 1.0;
    pitch = 1.0;
    volume = 1.0;
    voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  },
  writable: true,
  configurable: true,
});

import { waitForVoices, speakWithBrowserTTS } from '@/lib/audio/fallback-tts';

describe('fallback-tts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('waitForVoices', () => {
    it('returns immediately if voices are available', async () => {
      const voices = [{ name: 'Samantha', lang: 'en-US' }] as SpeechSynthesisVoice[];
      mockGetVoices.mockReturnValueOnce(voices);

      const result = await waitForVoices();
      expect(result).toEqual(voices);
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });

    it('waits for voiceschanged event if no voices initially', async () => {
      mockGetVoices.mockReturnValueOnce([]);
      const voices = [{ name: 'Samantha', lang: 'en-US' }] as SpeechSynthesisVoice[];

      const promise = waitForVoices(2000);

      // Simulate voiceschanged event
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'voiceschanged',
        expect.any(Function),
        { once: true }
      );

      // Get the callback and call it
      const callback = mockAddEventListener.mock.calls[0][1];
      mockGetVoices.mockReturnValueOnce(voices);
      callback();

      const result = await promise;
      expect(result).toEqual(voices);
    });

    it('times out and returns empty array if voiceschanged never fires', async () => {
      mockGetVoices.mockReturnValue([]);

      const promise = waitForVoices(2000);
      vi.advanceTimersByTime(2000);

      const result = await promise;
      expect(result).toEqual([]);
    });
  });

  describe('speakWithBrowserTTS', () => {
    it('resolves when utterance ends', async () => {
      mockGetVoices.mockReturnValue([{ name: 'Samantha', lang: 'en-US' }]);
      mockSpeak.mockImplementation((utterance: { onend: () => void }) => {
        // Simulate speech completing
        setTimeout(() => utterance.onend(), 100);
      });

      const promise = speakWithBrowserTTS('Hello');
      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects on speech error', async () => {
      mockGetVoices.mockReturnValue([{ name: 'Samantha', lang: 'en-US' }]);
      mockSpeak.mockImplementation((utterance: { onerror: (e: { error: string }) => void }) => {
        setTimeout(() => utterance.onerror({ error: 'synthesis-failed' }), 50);
      });

      const promise = speakWithBrowserTTS('Hello');
      // Attach .catch first to prevent unhandled rejection
      const caught = promise.catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(50);
      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('SpeechSynthesis error: synthesis-failed');
    });

    it('rejects on stuck timeout', async () => {
      mockGetVoices.mockReturnValue([{ name: 'Samantha', lang: 'en-US' }]);
      // Don't call onend or onerror — simulate stuck speech
      mockSpeak.mockImplementation(() => {});

      const promise = speakWithBrowserTTS('Hello');
      // Attach .catch first to prevent unhandled rejection
      const caught = promise.catch((e: Error) => e);
      // maxWaitMs = Math.max(5 * 100, 10000) = 10000
      await vi.advanceTimersByTimeAsync(10000);
      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('SpeechSynthesis timed out');
      expect(mockCancel).toHaveBeenCalled();
    });

    it('throws if speechSynthesis not supported', async () => {
      vi.useRealTimers(); // This test doesn't need fake timers
      const saved = globalThis.speechSynthesis;
      Object.defineProperty(globalThis, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      delete (globalThis as Record<string, unknown>).speechSynthesis;

      vi.resetModules();
      const { speakWithBrowserTTS: freshSpeak } = await import('@/lib/audio/fallback-tts');
      await expect(freshSpeak('Hello')).rejects.toThrow('SpeechSynthesis not supported');

      Object.defineProperty(globalThis, 'speechSynthesis', {
        value: saved,
        writable: true,
        configurable: true,
      });
    });
  });
});
