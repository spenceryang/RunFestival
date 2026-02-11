/**
 * Tracks ElevenLabs TTS API usage for cost monitoring and guards.
 * All data is session-scoped (resets on page reload).
 * Dev mode surfaces this in a UI panel.
 */

export interface TTSUsageSnapshot {
  totalCharacters: number;
  totalRequests: number;
  estimatedCostUsd: number;
  requestsThisMinute: number;
  averageCharsPerRequest: number;
  sessionStartedAt: number;
  lastRequestAt: number | null;
  blockedRequests: number;
}

// ElevenLabs pricing: ~$0.30 per 1000 characters (Turbo v2.5)
const COST_PER_1000_CHARS = 0.30;

// Guards
const MAX_CHARS_PER_SESSION = 50_000;       // ~$15 safety cap per session
const MAX_REQUESTS_PER_MINUTE = 15;         // Rate limit
const MAX_CHARS_PER_REQUEST = 1000;         // Single request cap

class TTSUsageTracker {
  private totalCharacters = 0;
  private totalRequests = 0;
  private blockedRequests = 0;
  private requestTimestamps: number[] = [];
  private sessionStartedAt = Date.now();
  private lastRequestAt: number | null = null;
  private isSessionActive = true;
  private listeners: Array<(snapshot: TTSUsageSnapshot) => void> = [];

  /**
   * Check if a TTS request should be allowed.
   * Returns { allowed: boolean, reason?: string }.
   */
  canMakeRequest(text: string): { allowed: boolean; reason?: string } {
    if (!this.isSessionActive) {
      return { allowed: false, reason: 'Session inactive — TTS paused' };
    }

    if (text.length > MAX_CHARS_PER_REQUEST) {
      return { allowed: false, reason: `Text too long (${text.length} chars, max ${MAX_CHARS_PER_REQUEST})` };
    }

    if (this.totalCharacters + text.length > MAX_CHARS_PER_SESSION) {
      return { allowed: false, reason: `Session character limit reached (${MAX_CHARS_PER_SESSION} chars)` };
    }

    // Rate limit: max requests per minute
    const oneMinuteAgo = Date.now() - 60_000;
    const recentRequests = this.requestTimestamps.filter((t) => t > oneMinuteAgo);
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
      return { allowed: false, reason: `Rate limit: ${MAX_REQUESTS_PER_MINUTE} requests/min` };
    }

    return { allowed: true };
  }

  /**
   * Record a successful TTS request.
   */
  recordRequest(characterCount: number): void {
    const now = Date.now();
    this.totalCharacters += characterCount;
    this.totalRequests++;
    this.requestTimestamps.push(now);
    this.lastRequestAt = now;

    // Prune old timestamps (older than 2 minutes)
    const twoMinutesAgo = now - 120_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > twoMinutesAgo);

    this.notifyListeners();
  }

  /**
   * Record a blocked request.
   */
  recordBlocked(): void {
    this.blockedRequests++;
    this.notifyListeners();
  }

  /**
   * Pause TTS (e.g., when app goes to background).
   */
  pauseSession(): void {
    this.isSessionActive = false;
    this.notifyListeners();
  }

  /**
   * Resume TTS (e.g., when app returns to foreground).
   */
  resumeSession(): void {
    this.isSessionActive = true;
    this.notifyListeners();
  }

  get active(): boolean {
    return this.isSessionActive;
  }

  /**
   * Get current usage snapshot.
   */
  getSnapshot(): TTSUsageSnapshot {
    const oneMinuteAgo = Date.now() - 60_000;
    const requestsThisMinute = this.requestTimestamps.filter((t) => t > oneMinuteAgo).length;

    return {
      totalCharacters: this.totalCharacters,
      totalRequests: this.totalRequests,
      estimatedCostUsd: (this.totalCharacters / 1000) * COST_PER_1000_CHARS,
      requestsThisMinute,
      averageCharsPerRequest: this.totalRequests > 0 ? Math.round(this.totalCharacters / this.totalRequests) : 0,
      sessionStartedAt: this.sessionStartedAt,
      lastRequestAt: this.lastRequestAt,
      blockedRequests: this.blockedRequests,
    };
  }

  /**
   * Subscribe to usage updates.
   */
  subscribe(listener: (snapshot: TTSUsageSnapshot) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Reset all tracking data.
   */
  reset(): void {
    this.totalCharacters = 0;
    this.totalRequests = 0;
    this.blockedRequests = 0;
    this.requestTimestamps = [];
    this.sessionStartedAt = Date.now();
    this.lastRequestAt = null;
    this.isSessionActive = true;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((l) => l(snapshot));
  }
}

// Singleton instance
export const ttsUsageTracker = new TTSUsageTracker();
