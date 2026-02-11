type VoiceResultCallback = (transcript: string) => void;
type VoiceEndCallback = () => void;

export class VoiceInput {
  private recognition: SpeechRecognition | null = null;
  private _isListening = false;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  start(onResult: VoiceResultCallback, onEnd: VoiceEndCallback): boolean {
    if (this._isListening) return false;
    if (!VoiceInput.isSupported()) return false;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) {
        onResult(transcript.trim());
      }
    };

    this.recognition.onerror = () => {
      this._isListening = false;
      onEnd();
    };

    this.recognition.onend = () => {
      this._isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
      this._isListening = true;
      return true;
    } catch {
      this._isListening = false;
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
