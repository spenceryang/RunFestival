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
  private visibilityHandler: (() => void) | null = null;

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

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended (e.g., after user gesture requirement)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
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
  }

  async enqueue(
    context: CoachingContext,
    onMessageComplete?: (fullText: string) => void
  ): Promise<void> {
    if (this.isMuted) return;

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
    if (this.interrupted) return;

    const next = this.queue.shift();
    if (!next) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const voiceConfig = PERSONA_VOICE_CONFIG[next.context.persona];

    try {
      await this.processCoachingRequest(next.context, voiceConfig, next.onMessageComplete);
    } catch {
      // Audio error — fall back silently per CLAUDE.md
    }

    // Process next in queue (unless interrupted)
    if (!this.interrupted) {
      await this.processNext();
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

        while (sentenceIndex < sentences.length && !this.interrupted) {
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
    const ctx = this.getAudioContext();
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
