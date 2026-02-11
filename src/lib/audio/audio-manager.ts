import type { CoachingPersona } from '@/types/run';
import type { CoachingContext, PersonaVoiceConfig } from '@/types/coach';
import { streamCoachingMessage } from '@/lib/coach/coach-client';
import { requestTTS } from './tts-client';
import { speakWithBrowserTTS } from './fallback-tts';
import { PERSONA_VOICE_CONFIG } from '@/lib/coach/prompts';

const MAX_QUEUE_SIZE = 2;

interface QueuedMessage {
  context: CoachingContext;
}

export class AudioManager {
  private queue: QueuedMessage[] = [];
  private isPlaying = false;
  private audioContext: AudioContext | null = null;
  private isMuted = false;

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

  async enqueue(context: CoachingContext): Promise<void> {
    if (this.isMuted) return;

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift(); // Drop oldest
    }
    this.queue.push({ context });

    if (!this.isPlaying) {
      await this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const voiceConfig = PERSONA_VOICE_CONFIG[next.context.persona];

    try {
      await this.processCoachingRequest(next.context, voiceConfig);
    } catch {
      // Audio error — fall back silently per CLAUDE.md
    }

    // Process next in queue
    await this.processNext();
  }

  private async processCoachingRequest(
    context: CoachingContext,
    voiceConfig: PersonaVoiceConfig
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const sentences: string[] = [];
      let sentenceIndex = 0;
      let isStreamDone = false;

      const playSentence = async (sentence: string) => {
        try {
          const audioBuffer = await requestTTS(sentence, voiceConfig);
          await this.playAudioBuffer(audioBuffer);
        } catch {
          // ElevenLabs failed, try browser TTS
          try {
            await speakWithBrowserTTS(sentence);
          } catch {
            // Complete silence fallback
          }
        }
      };

      const processQueue = async () => {
        while (sentenceIndex < sentences.length) {
          const sentence = sentences[sentenceIndex];
          sentenceIndex++;
          await playSentence(sentence);
        }

        if (isStreamDone) {
          resolve();
        }
      };

      streamCoachingMessage(
        context,
        (sentence) => {
          sentences.push(sentence);
          // Start playing if not already
          if (sentences.length === 1) {
            processQueue();
          }
        },
        () => {
          isStreamDone = true;
          // If all sentences already processed, resolve
          if (sentenceIndex >= sentences.length) {
            resolve();
          } else {
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

      // Set volume lower to not compete with music
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.85;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => resolve();
      source.start(0);
    });
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.queue = [];
    }
  }

  get muted(): boolean {
    return this.isMuted;
  }

  destroy(): void {
    this.queue = [];
    this.isPlaying = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
