import type { CoachingContext, PersonaVoiceConfig } from '@/types/coach';
import { streamCoachingMessage } from '@/lib/coach/coach-client';
import { requestTTS } from './tts-client';
import { speakWithBrowserTTS } from './fallback-tts';
import { PERSONA_VOICE_CONFIG } from '@/lib/coach/prompts';
import { ttsUsageTracker } from './tts-usage-tracker';

const MAX_QUEUE_SIZE = 2;

interface QueuedMessage {
  context: CoachingContext;
  onMessageComplete?: (fullText: string) => void;
}

export class AudioManager {
  private queue: QueuedMessage[] = [];
  private isPlaying = false;
  private audioContext: AudioContext | null = null;
  private isMuted = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private interrupted = false;
  private isPaused = false;
  private visibilityHandler: (() => void) | null = null;
  private activeChangeCallback: ((active: boolean) => void) | null = null;

  constructor() {
    // Pause TTS when app goes to background to prevent background API usage
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          ttsUsageTracker.pauseSession();
        } else {
          ttsUsageTracker.resumeSession();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended — must await on mobile where gesture is required
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Warm up the AudioContext from a user gesture (tap/click).
   * On iOS/Android, AudioContext must be created or resumed during a
   * user gesture — timer callbacks won't work. Call this from the
   * setup page "Go" button or any run-screen user interaction.
   */
  async warmUp(): Promise<void> {
    try {
      await this.getAudioContext();
    } catch {
      // Silently fail — we'll retry on next user gesture
    }
  }

  /**
   * Stop all current and queued audio immediately.
   * Use before enqueue() when the user speaks — their response takes priority.
   */
  interrupt(): void {
    this.interrupted = true;
    this.queue = [];

    // Stop current Web Audio playback
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }

    // Cancel any browser TTS in progress
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    this.isPlaying = false;
    this.notifyActiveChange(false);
  }

  /**
   * Pause audio processing. Stops current playback but preserves
   * the AudioContext and queue. Use when the run is paused.
   */
  pause(): void {
    this.isPaused = true;

    // Stop current Web Audio playback
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }

    // Cancel any browser TTS in progress
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    this.isPlaying = false;
    this.notifyActiveChange(false);
  }

  /**
   * Resume audio processing after a pause. AudioContext is preserved,
   * so the same voice continues. Picks up queue processing if messages
   * are pending.
   */
  resume(): void {
    this.isPaused = false;
    // If there are queued messages, start processing them
    if (this.queue.length > 0 && !this.isPlaying) {
      this.processNext();
    }
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Register a callback that fires when the audio manager starts or stops
   * actively processing coaching messages. Used for UI indicators.
   */
  onActiveChange(callback: ((active: boolean) => void) | null): void {
    this.activeChangeCallback = callback;
  }

  private notifyActiveChange(active: boolean): void {
    try {
      this.activeChangeCallback?.(active);
    } catch {
      // UI callback error — never crash audio pipeline
    }
  }

  async enqueue(
    context: CoachingContext,
    onMessageComplete?: (fullText: string) => void
  ): Promise<void> {
    if (this.isMuted || this.isPaused) return;

    // Reset interrupted flag on new enqueue
    this.interrupted = false;

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift(); // Drop oldest
    }
    this.queue.push({ context, onMessageComplete });

    if (!this.isPlaying) {
      await this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.interrupted || this.isPaused) return;

    const next = this.queue.shift();
    if (!next) {
      this.isPlaying = false;
      this.notifyActiveChange(false);
      return;
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.notifyActiveChange(true);
    }
    const voiceConfig = PERSONA_VOICE_CONFIG[next.context.persona];

    try {
      await this.processCoachingRequest(next.context, voiceConfig, next.onMessageComplete);
    } catch {
      // Audio error — fall back silently per CLAUDE.md
    }

    // Process next in queue (unless interrupted)
    if (!this.interrupted) {
      await this.processNext();
    } else {
      // Interrupted during processing — ensure indicator is cleared.
      // interrupt() normally handles this, but in race conditions the
      // catch block above may swallow the state change.
      this.isPlaying = false;
      this.notifyActiveChange(false);
    }
  }

  private async processCoachingRequest(
    context: CoachingContext,
    voiceConfig: PersonaVoiceConfig,
    onMessageComplete?: (fullText: string) => void
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const sentences: string[] = [];
      let sentenceIndex = 0;
      let isStreamDone = false;
      let isProcessing = false;

      const playSentence = async (sentence: string) => {
        if (this.interrupted) return;
        try {
          const audioBuffer = await requestTTS(sentence, voiceConfig);
          if (this.interrupted) return;
          await this.playAudioBuffer(audioBuffer);
        } catch {
          if (this.interrupted) return;
          // ElevenLabs failed, try browser TTS
          try {
            await speakWithBrowserTTS(sentence);
          } catch {
            // Complete silence fallback
          }
        }
      };

      const processQueue = async () => {
        // Prevent concurrent processQueue loops
        if (isProcessing) return;
        isProcessing = true;

        while (sentenceIndex < sentences.length && !this.interrupted && !this.isPaused) {
          const sentence = sentences[sentenceIndex];
          sentenceIndex++;
          await playSentence(sentence);
        }

        isProcessing = false;

        if (isStreamDone || this.interrupted) {
          resolve();
        }
      };

      streamCoachingMessage(
        context,
        (sentence) => {
          if (this.interrupted) return;
          sentences.push(sentence);
          // Start playing if not already processing
          if (!isProcessing) {
            processQueue();
          }
        },
        (fullText) => {
          isStreamDone = true;
          if (onMessageComplete && fullText) {
            try { onMessageComplete(fullText); } catch { /* ignore */ }
          }
          // If all sentences already processed, resolve
          if (sentenceIndex >= sentences.length || this.interrupted) {
            resolve();
          } else if (!isProcessing) {
            processQueue();
          }
        },
        () => {
          resolve(); // On error, just resolve to continue
        }
      );
    });
  }

  private async playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
    const ctx = await this.getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(buffer);

    return new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      this.currentSource = source;

      // Set volume lower to not compete with music
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.85;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
        }
        resolve();
      };
      source.start(0);
    });
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.interrupt();
    }
  }

  get muted(): boolean {
    return this.isMuted;
  }

  destroy(): void {
    this.interrupt();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    ttsUsageTracker.pauseSession();
  }
}
