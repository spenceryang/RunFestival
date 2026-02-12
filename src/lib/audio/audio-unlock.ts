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
 * On iOS, calling resume() alone is sometimes not sufficient — playing
 * a buffer within the gesture callback fully activates the audio session.
 */
export async function unlockAudioContext(): Promise<boolean> {
  try {
    const ctx = getSharedAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a tiny silent buffer to fully unlock on iOS.
    // Some iOS versions require actual audio output within the gesture.
    const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);

    console.warn('[AudioUnlock] state after unlock:', ctx.state);
    return ctx.state === 'running';
  } catch (e) {
    console.warn('[AudioUnlock] Failed to unlock:', e);
    return false;
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
