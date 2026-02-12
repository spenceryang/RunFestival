import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

Object.defineProperty(globalThis, 'SpeechRecognition', {
  value: MockSpeechRecognition,
  writable: true,
  configurable: true,
});

import { VoiceInput } from '@/lib/audio/voice-input';

describe('VoiceInput', () => {
  let voiceInput: VoiceInput;

  beforeEach(() => {
    vi.clearAllMocks();
    voiceInput = new VoiceInput();
  });

  describe('isSupported', () => {
    it('returns true when SpeechRecognition is available', () => {
      expect(VoiceInput.isSupported()).toBe(true);
    });

    it('returns false when SpeechRecognition is not available', () => {
      const original = (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).SpeechRecognition;
      // Also need to remove webkitSpeechRecognition
      const originalWebkit = (globalThis as Record<string, unknown>).webkitSpeechRecognition;
      delete (globalThis as Record<string, unknown>).webkitSpeechRecognition;

      expect(VoiceInput.isSupported()).toBe(false);

      (globalThis as Record<string, unknown>).SpeechRecognition = original;
      if (originalWebkit) {
        (globalThis as Record<string, unknown>).webkitSpeechRecognition = originalWebkit;
      }
    });
  });

  describe('start/stop lifecycle', () => {
    it('starts listening and calls onEnd when recognition ends', () => {
      const onResult = vi.fn();
      const onEnd = vi.fn();

      const started = voiceInput.start(onResult, onEnd);
      expect(started).toBe(true);
      expect(voiceInput.isListening).toBe(true);
    });

    it('returns false if already listening', () => {
      const onResult = vi.fn();
      const onEnd = vi.fn();

      voiceInput.start(onResult, onEnd);
      const secondStart = voiceInput.start(onResult, onEnd);
      expect(secondStart).toBe(false);
    });

    it('calls onError with not-supported when constructor missing', () => {
      const original = (globalThis as Record<string, unknown>).SpeechRecognition;
      delete (globalThis as Record<string, unknown>).SpeechRecognition;

      const onResult = vi.fn();
      const onEnd = vi.fn();
      const onError = vi.fn();

      const input = new VoiceInput();
      const started = input.start(onResult, onEnd, onError);

      expect(started).toBe(false);
      expect(onError).toHaveBeenCalledWith('not-supported');

      (globalThis as Record<string, unknown>).SpeechRecognition = original;
    });

    it('stop() sets isListening to false', () => {
      voiceInput.start(vi.fn(), vi.fn());
      expect(voiceInput.isListening).toBe(true);

      voiceInput.stop();
      expect(voiceInput.isListening).toBe(false);
    });
  });

  describe('duplicate onerror + onend guard (iOS WebKit quirk)', () => {
    it('calls onEnd only once when both onerror and onend fire', () => {
      const onResult = vi.fn();
      const onEnd = vi.fn();
      const onError = vi.fn();

      voiceInput.start(onResult, onEnd, onError);

      // Access the recognition instance via the private field
      const recognition = (voiceInput as unknown as { recognition: MockSpeechRecognition }).recognition;

      // Simulate iOS WebKit firing both onerror AND onend
      recognition.onerror!({ error: 'no-speech', message: '' });
      recognition.onend!();

      // onError should be called once, onEnd should be called once total
      // (onerror handler calls onEnd, so onend handler should be a no-op)
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('no-speech');
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('calls onEnd only once when onend fires after onresult', () => {
      const onResult = vi.fn();
      const onEnd = vi.fn();

      voiceInput.start(onResult, onEnd);

      const recognition = (voiceInput as unknown as { recognition: MockSpeechRecognition }).recognition;

      // Simulate successful result followed by onend
      recognition.onresult!({
        results: [[{ transcript: 'hello coach', confidence: 0.9 }]],
      });
      recognition.onend!();

      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith('hello coach');
      // onEnd should NOT be called — onresult already handled completion
      expect(onEnd).toHaveBeenCalledTimes(0);
    });
  });

  describe('destroy', () => {
    it('stops listening and nulls recognition', () => {
      voiceInput.start(vi.fn(), vi.fn());
      voiceInput.destroy();
      expect(voiceInput.isListening).toBe(false);
    });
  });
});
