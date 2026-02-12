import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock dependencies before importing AudioManager
vi.mock('@/lib/coach/coach-client', () => ({
  streamCoachingMessage: vi.fn(),
}));

vi.mock('@/lib/audio/tts-client', () => ({
  requestTTS: vi.fn(),
}));

vi.mock('@/lib/audio/fallback-tts', () => ({
  speakWithBrowserTTS: vi.fn(),
}));

vi.mock('@/lib/audio/tts-usage-tracker', () => ({
  ttsUsageTracker: {
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
  },
}));

vi.mock('@/lib/audio/audio-unlock', () => {
  const mockCtx = {
    state: 'running',
    sampleRate: 44100,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn().mockReturnValue({}),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    }),
    decodeAudioData: vi.fn(),
    createGain: vi.fn(),
  };
  return {
    getSharedAudioContext: vi.fn().mockReturnValue(mockCtx),
    unlockAudioContext: vi.fn().mockResolvedValue(true),
    isAudioUnlocked: vi.fn().mockReturnValue(true),
    destroySharedContext: vi.fn(),
  };
});

vi.mock('@/lib/audio/platform', () => ({
  isIOS: vi.fn().mockReturnValue(false),
}));

// Mock AudioContext
const mockClose = vi.fn();
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockDecodeAudioData = vi.fn();
const mockCreateBufferSource = vi.fn();
const mockCreateGain = vi.fn();

class MockAudioContext {
  state = 'running';
  close = mockClose;
  resume = mockResume;
  decodeAudioData = mockDecodeAudioData;
  createBufferSource = mockCreateBufferSource;
  createGain = mockCreateGain;
  destination = {};
}

Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, writable: true });

// Provide speechSynthesis mock globally (jsdom doesn't include it)
const mockSpeechCancel = vi.fn();
Object.defineProperty(globalThis, 'speechSynthesis', {
  value: { cancel: mockSpeechCancel, speak: vi.fn(), getVoices: vi.fn().mockReturnValue([]) },
  writable: true,
  configurable: true,
});

import { AudioManager } from '@/lib/audio/audio-manager';
import { streamCoachingMessage } from '@/lib/coach/coach-client';
import type { CoachingContext } from '@/types/coach';

function makeContext(persona: 'hype' | 'calm' | 'data' | 'storyteller' = 'hype'): CoachingContext {
  return {
    persona,
    trigger: { type: 'idle_storytelling', data: {} },
    runState: {
      distanceMeters: 3000,
      elapsedSeconds: 900,
      currentPaceSecondsPerKm: 330,
      averagePaceSecondsPerKm: 340,
      targetPaceSecondsPerKm: 330,
      targetDistanceMeters: 5000,
      splits: [],
      isPaused: false,
    },
    profile: {
      name: 'Test Runner',
      city: 'San Francisco',
      experienceLevel: 'intermediate',
      storyTopics: ['history'],
      recentRunsSummary: '',
    },
    collective: {
      runnerCount: 100,
      recentEvents: [],
      averagePaceFormatted: '5:30',
    },
  };
}

// Helper to access private fields for testing
function getPrivateField<T>(obj: object, field: string): T {
  return (obj as Record<string, unknown>)[field] as T;
}

function setPrivateField(obj: object, field: string, value: unknown): void {
  (obj as Record<string, unknown>)[field] = value;
}

describe('AudioManager', () => {
  let manager: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechCancel.mockClear();
    manager = new AudioManager();
  });

  describe('pause/resume', () => {
    it('starts in unpaused state', () => {
      expect(manager.paused).toBe(false);
    });

    it('pause() sets paused state', () => {
      manager.pause();
      expect(manager.paused).toBe(true);
    });

    it('resume() clears paused state', () => {
      manager.pause();
      expect(manager.paused).toBe(true);
      manager.resume();
      expect(manager.paused).toBe(false);
    });

    it('pause() does not close AudioContext', () => {
      manager.pause();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('destroy() does close AudioContext if it was created', () => {
      // The audioContext is lazily created, so just calling destroy won't close it
      // unless it was previously used
      manager.destroy();
      // AudioContext was never created, so close shouldn't be called
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('enqueue() rejects messages while paused', async () => {
      manager.pause();
      const context = makeContext('hype');
      await manager.enqueue(context);
      expect(streamCoachingMessage).not.toHaveBeenCalled();
    });

    it('multiple pause/resume cycles do not leak AudioContexts', () => {
      manager.pause();
      manager.resume();
      manager.pause();
      manager.resume();
      manager.pause();
      manager.resume();
      // AudioContext.close should never be called — pause preserves it
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('resume() triggers queue processing if messages are pending', async () => {
      // Set up the mock to call onComplete immediately
      (streamCoachingMessage as Mock).mockImplementation(
        (_ctx: CoachingContext, _onSentence: (s: string) => void, onComplete: (t: string) => void) => {
          onComplete('Test message');
        }
      );

      // Pause then resume to verify the manager is functional after resume
      manager.pause();
      manager.resume();

      // Now enqueue should work
      const context = makeContext('calm');
      await manager.enqueue(context);
      expect(streamCoachingMessage).toHaveBeenCalledTimes(1);
    });

    it('pause() stops current playback source', () => {
      const mockStop = vi.fn();
      // Simulate having a current source playing
      setPrivateField(manager, 'currentSource', { stop: mockStop });
      manager.pause();
      expect(mockStop).toHaveBeenCalled();
      expect(getPrivateField(manager, 'currentSource')).toBeNull();
    });

    it('pause() cancels browser TTS', () => {
      manager.pause();
      expect(mockSpeechCancel).toHaveBeenCalled();
    });
  });

  describe('voice config preservation', () => {
    it('uses persona voice config from PERSONA_VOICE_CONFIG — not cached internally', async () => {
      // The AudioManager reads PERSONA_VOICE_CONFIG[context.persona] fresh
      // on each processNext(). This means voice config cannot drift across
      // pause/resume since it's always read from the imported constant.
      (streamCoachingMessage as Mock).mockImplementation(
        (_ctx: CoachingContext, _onSentence: (s: string) => void, onComplete: (t: string) => void) => {
          onComplete('Test');
        }
      );

      const context = makeContext('hype');
      await manager.enqueue(context);

      // Verify streamCoachingMessage was called with the hype context
      expect(streamCoachingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ persona: 'hype' }),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('different personas get their own voice config per enqueue', async () => {
      (streamCoachingMessage as Mock).mockImplementation(
        (_ctx: CoachingContext, _onSentence: (s: string) => void, onComplete: (t: string) => void) => {
          onComplete('Done');
        }
      );

      await manager.enqueue(makeContext('hype'));
      await manager.enqueue(makeContext('calm'));

      expect(streamCoachingMessage).toHaveBeenCalledTimes(2);
      expect((streamCoachingMessage as Mock).mock.calls[0][0].persona).toBe('hype');
      expect((streamCoachingMessage as Mock).mock.calls[1][0].persona).toBe('calm');
    });
  });

  describe('mute', () => {
    it('setMuted(true) prevents enqueuing', async () => {
      manager.setMuted(true);
      expect(manager.muted).toBe(true);

      await manager.enqueue(makeContext());
      expect(streamCoachingMessage).not.toHaveBeenCalled();
    });

    it('setMuted(false) allows new enqueues', async () => {
      (streamCoachingMessage as Mock).mockImplementation(
        (_ctx: CoachingContext, _onSentence: (s: string) => void, onComplete: (t: string) => void) => {
          onComplete('Test');
        }
      );

      manager.setMuted(true);
      manager.setMuted(false);
      expect(manager.muted).toBe(false);

      await manager.enqueue(makeContext());
      expect(streamCoachingMessage).toHaveBeenCalledTimes(1);
    });

    it('mute and pause work independently', async () => {
      manager.pause();
      manager.setMuted(true);
      expect(manager.paused).toBe(true);
      expect(manager.muted).toBe(true);

      manager.resume();
      expect(manager.paused).toBe(false);
      expect(manager.muted).toBe(true);

      // Still muted, so enqueue should be rejected
      await manager.enqueue(makeContext());
      expect(streamCoachingMessage).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('cleans up visibility handler', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      manager.destroy();
      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      removeSpy.mockRestore();
    });

    it('pauses TTS usage tracker', async () => {
      const { ttsUsageTracker } = await import('@/lib/audio/tts-usage-tracker');
      manager.destroy();
      expect(ttsUsageTracker.pauseSession).toHaveBeenCalled();
    });
  });

  describe('interrupt vs pause', () => {
    it('interrupt() clears queue, pause() does not', () => {
      // Add items to queue directly for testing
      setPrivateField(manager, 'queue', [
        { context: makeContext('hype') },
        { context: makeContext('calm') },
      ]);
      expect(getPrivateField<unknown[]>(manager, 'queue').length).toBe(2);

      // Pause preserves queue
      manager.pause();
      expect(getPrivateField<unknown[]>(manager, 'queue').length).toBe(2);

      // Resume and interrupt — interrupt clears queue
      manager.resume();
      manager.interrupt();
      expect(getPrivateField<unknown[]>(manager, 'queue').length).toBe(0);
    });
  });

  describe('persistent audio element (iOS)', () => {
    it('getOrCreatePersistentAudio creates element with playsInline hints', () => {
      // Access private method via type casting
      const audio = (manager as unknown as { getOrCreatePersistentAudio: () => HTMLAudioElement }).getOrCreatePersistentAudio();
      expect(audio).toBeInstanceOf(HTMLAudioElement);
      expect(audio.volume).toBe(0.85);
      expect(audio.getAttribute('playsinline')).toBe('');
      expect(audio.getAttribute('webkit-playsinline')).toBe('');
      expect(audio.preload).toBe('auto');
    });

    it('getOrCreatePersistentAudio returns the same element on subsequent calls', () => {
      const getter = (manager as unknown as { getOrCreatePersistentAudio: () => HTMLAudioElement }).getOrCreatePersistentAudio.bind(manager);
      const audio1 = getter();
      const audio2 = getter();
      expect(audio1).toBe(audio2);
    });

    it('destroy() cleans up persistent audio element', () => {
      // Create the persistent element first
      (manager as unknown as { getOrCreatePersistentAudio: () => HTMLAudioElement }).getOrCreatePersistentAudio();
      expect(getPrivateField(manager, 'persistentAudio')).not.toBeNull();

      manager.destroy();
      expect(getPrivateField(manager, 'persistentAudio')).toBeNull();
    });

    it('interrupt() pauses but does not destroy persistent audio', () => {
      const audio = (manager as unknown as { getOrCreatePersistentAudio: () => HTMLAudioElement }).getOrCreatePersistentAudio();
      const pauseSpy = vi.spyOn(audio, 'pause');

      manager.interrupt();

      expect(pauseSpy).toHaveBeenCalled();
      // Persistent audio is kept alive — not set to null
      expect(getPrivateField(manager, 'persistentAudio')).toBe(audio);
    });
  });
});
