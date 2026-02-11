'use client';

import { useState, useEffect, useCallback } from 'react';
import { ttsUsageTracker, type TTSUsageSnapshot } from '@/lib/audio/tts-usage-tracker';

export function ApiUsagePanel() {
  const [snapshot, setSnapshot] = useState<TTSUsageSnapshot | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Get initial snapshot
    setSnapshot(ttsUsageTracker.getSnapshot());

    // Subscribe to updates
    const unsubscribe = ttsUsageTracker.subscribe((s) => setSnapshot(s));

    // Also poll every 5s for timer-based fields (requestsThisMinute)
    const interval = setInterval(() => {
      setSnapshot(ttsUsageTracker.getSnapshot());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleReset = useCallback(() => {
    ttsUsageTracker.reset();
  }, []);

  if (!snapshot) return null;

  const sessionDurationMin = Math.round((Date.now() - snapshot.sessionStartedAt) / 60_000);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
          snapshot.blockedRequests > 0
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-festival-card border-festival-border text-festival-muted hover:text-white'
        }`}
      >
        TTS: ${snapshot.estimatedCostUsd.toFixed(3)} · {snapshot.totalRequests} reqs
      </button>

      {isExpanded && (
        <div className="absolute bottom-10 right-0 w-72 bg-festival-card border border-festival-border rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">API Usage</h3>
            <button
              onClick={handleReset}
              className="text-xs text-festival-muted hover:text-red-400 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <Row label="ElevenLabs TTS" />
            <Row label="Characters" value={snapshot.totalCharacters.toLocaleString()} />
            <Row label="Requests" value={String(snapshot.totalRequests)} />
            <Row label="Avg chars/req" value={String(snapshot.averageCharsPerRequest)} />
            <Row label="Requests/min" value={String(snapshot.requestsThisMinute)} />
            <Row label="Est. cost" value={`$${snapshot.estimatedCostUsd.toFixed(4)}`} highlight />
            <Row label="Blocked" value={String(snapshot.blockedRequests)} warn={snapshot.blockedRequests > 0} />
            <Row label="Session" value={`${sessionDurationMin}m`} />
            <Row label="Status" value={ttsUsageTracker.active ? 'Active' : 'Paused'} warn={!ttsUsageTracker.active} />

            <div className="border-t border-festival-border pt-2 mt-2">
              <p className="text-festival-muted">
                Claude API usage is tracked per-request in Vercel logs (model, tokens, latency).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  if (!value) {
    return (
      <div className="text-festival-orange font-semibold text-xs pt-1">{label}</div>
    );
  }
  return (
    <div className="flex justify-between">
      <span className="text-festival-muted">{label}</span>
      <span className={highlight ? 'text-festival-orange font-semibold' : warn ? 'text-red-400' : 'text-white'}>
        {value}
      </span>
    </div>
  );
}
