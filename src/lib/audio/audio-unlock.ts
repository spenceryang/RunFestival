/**
 * Shared AudioContext singleton for iOS audio unlock.
 *
 * On iOS, AudioContext must be created and activated (resume + play)
 * during a user gesture (tap/click). This module stores a single
 * AudioContext that is unlocked on the setup page's GO button
 * and reused by AudioManager on the run page.
 *
 * The singleton survives Next.js client-side navigation because
 * App Router uses SPA routing without full page reloads.
 */

let sharedContext: AudioContext | null = null;

/**
 * Get the shared AudioContext, creating one if needed.
 * Does NOT unlock it — call unlockAudioContext() from a user gesture.
 */
export function getSharedAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

/**
 * Unlock the AudioContext by resuming it and playing a short silent buffer.
 * MUST be called from a user gesture handler (tap/click).
 *
 * IMPORTANT: This function does all critical work SYNCHRONOUSLY within
 * the gesture context. The returned promise resolves when resume() completes,
 * but the AudioContext is already being unlocked by the time this returns.
 * Callers do NOT need to await this — calling it synchronously is fine.
 *
 * On iOS, calling resume() alone is sometimes not sufficient — playing
 * a buffer within the gesture callback fully activates the audio session.
 */
export function unlockAudioContext(): Promise<boolean> {
  try {
    const ctx = getSharedAudioContext();

    // CRITICAL: Call resume() synchronously within the gesture handler.
    // iOS WebKit checks the call stack to verify user gesture context.
    // Do NOT await this before playing the silent buffer.
    const resumePromise = ctx.state === 'suspended'
      ? ctx.resume()
      : Promise.resolve();

    // Play a tiny silent buffer to fully unlock on iOS.
    // Some iOS versions require actual audio output within the gesture.
    // This MUST happen synchronously (same call stack as the gesture).
    try {
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('[AudioUnlock] Silent buffer play failed:', e);
    }

    // Also create and play a silent HTML Audio element — this unlocks
    // the HTML Audio path on iOS independently of AudioContext.
    try {
      const silentAudio = new Audio(
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAHAAGf9AAAIiSAM/8xIAAAAwAAA/gAAABEREREREREREREREREREREREREREREAAAAAAAAAAAAMQxDEMQxDEAAAAAAAAAAAAMQxDEMQxDEMQxDEMQxDEMQxDEMQxDAAAAAAD/+1DELgAADSAAAAAAAAANIAAAAABEREREREREREREREREREREREREREREREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      );
      silentAudio.volume = 0.01;
      silentAudio.play().catch(() => {});
    } catch {
      // HTML Audio pre-play failed — non-critical
    }

    console.warn('[AudioUnlock] state after unlock:', ctx.state);

    // Return a promise that resolves after resume completes
    return resumePromise.then(() => {
      console.warn('[AudioUnlock] resume complete, state:', ctx.state);
      return ctx.state === 'running';
    }).catch((e) => {
      console.warn('[AudioUnlock] resume failed:', e);
      return false;
    });
  } catch (e) {
    console.warn('[AudioUnlock] Failed to unlock:', e);
    return Promise.resolve(false);
  }
}

/**
 * Check if the shared AudioContext is unlocked and ready for playback.
 */
export function isAudioUnlocked(): boolean {
  return sharedContext !== null && sharedContext.state === 'running';
}

/**
 * Destroy the shared AudioContext. Called on AudioManager.destroy().
 */
export function destroySharedContext(): void {
  if (sharedContext) {
    sharedContext.close().catch(() => {});
    sharedContext = null;
  }
}
