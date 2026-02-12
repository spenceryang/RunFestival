import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AudioContext
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn();
const mockStart = vi.fn();
const mockCreateBuffer = vi.fn().mockReturnValue({});
const mockCreateBufferSource = vi.fn().mockReturnValue({
  buffer: null,
  connect: mockConnect,
  start: mockStart,
});

class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  destination = {};
  resume = mockResume;
  close = mockClose;
  createBuffer = mockCreateBuffer;
  createBufferSource = mockCreateBufferSource;
}

Object.defineProperty(globalThis, 'AudioContext', {
  value: MockAudioContext,
  writable: true,
  configurable: true,
});

describe('audio-unlock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Reset the state to 'suspended' for each test
    MockAudioContext.prototype.state = 'suspended';
  });

  it('getSharedAudioContext creates a singleton', async () => {
    const { getSharedAudioContext } = await import('@/lib/audio/audio-unlock');
    const ctx1 = getSharedAudioContext();
    const ctx2 = getSharedAudioContext();
    expect(ctx1).toBe(ctx2);
  });

  it('unlockAudioContext resumes suspended context', async () => {
    mockResume.mockImplementation(function (this: MockAudioContext) {
      this.state = 'running';
      return Promise.resolve();
    });

    const { unlockAudioContext } = await import('@/lib/audio/audio-unlock');
    const result = await unlockAudioContext();

    expect(mockResume).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('unlockAudioContext plays a silent buffer', async () => {
    mockResume.mockImplementation(function (this: MockAudioContext) {
      this.state = 'running';
      return Promise.resolve();
    });

    const { unlockAudioContext } = await import('@/lib/audio/audio-unlock');
    await unlockAudioContext();

    expect(mockCreateBuffer).toHaveBeenCalledWith(1, 1, 44100);
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledWith(0);
  });

  it('isAudioUnlocked returns false before unlock', async () => {
    const { isAudioUnlocked } = await import('@/lib/audio/audio-unlock');
    expect(isAudioUnlocked()).toBe(false);
  });

  it('isAudioUnlocked returns true after unlock', async () => {
    mockResume.mockImplementation(function (this: MockAudioContext) {
      this.state = 'running';
      return Promise.resolve();
    });

    const { unlockAudioContext, isAudioUnlocked } = await import('@/lib/audio/audio-unlock');
    await unlockAudioContext();
    expect(isAudioUnlocked()).toBe(true);
  });

  it('destroySharedContext closes and nullifies', async () => {
    mockResume.mockImplementation(function (this: MockAudioContext) {
      this.state = 'running';
      return Promise.resolve();
    });

    const { getSharedAudioContext, destroySharedContext, isAudioUnlocked } = await import('@/lib/audio/audio-unlock');
    getSharedAudioContext(); // create it
    destroySharedContext();
    expect(isAudioUnlocked()).toBe(false);
  });

  it('unlockAudioContext returns false on error', async () => {
    mockResume.mockRejectedValueOnce(new Error('test error'));

    const { unlockAudioContext } = await import('@/lib/audio/audio-unlock');
    const result = await unlockAudioContext();
    expect(result).toBe(false);
  });
});
