type VoiceResultCallback = (transcript: string) => void;
type VoiceEndCallback = () => void;
type VoiceErrorCallback = (error: string) => void;

export class VoiceInput {
  private recognition: SpeechRecognition | null = null;
  private _isListening = false;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  start(
    onResult: VoiceResultCallback,
    onEnd: VoiceEndCallback,
    onError?: VoiceErrorCallback
  ): boolean {
    if (this._isListening) return false;
    if (!VoiceInput.isSupported()) {
      console.warn('[VoiceInput] SpeechRecognition not supported in this browser');
      onError?.('not-supported');
      return false;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Guard against iOS WebKit firing both onerror AND onend for a single
    // failed recognition attempt. First callback to fire wins.
    let completed = false;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) {
        completed = true;
        this._isListening = false;
        onResult(transcript.trim());
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (completed) return;
      completed = true;
      const errorType = event.error || 'unknown';
      console.warn('[VoiceInput] SpeechRecognition error:', errorType, event.message);
      this._isListening = false;
      onError?.(errorType);
      onEnd();
    };

    this.recognition.onend = () => {
      if (completed) return;
      completed = true;
      this._isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
      this._isListening = true;
      console.warn('[VoiceInput] Started listening');
      return true;
    } catch (e) {
      console.warn('[VoiceInput] Failed to start:', e);
      this._isListening = false;
      onError?.('start-failed');
      return false;
    }
  }

  stop(): void {
    if (this.recognition && this._isListening) {
      this.recognition.stop();
      this._isListening = false;
    }
  }

  get isListening(): boolean {
    return this._isListening;
  }

  destroy(): void {
    this.stop();
    this.recognition = null;
  }
}
