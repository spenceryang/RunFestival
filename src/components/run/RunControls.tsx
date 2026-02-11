'use client';

import { useState, useCallback, useEffect } from 'react';
import { Pause, Play, Square, Mic } from 'lucide-react';
import type { RunStatus } from '@/types/run';

interface RunControlsProps {
  status: RunStatus;
  isListening?: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTalkToCoach: () => void;
}

export function RunControls({
  status,
  isListening = false,
  onPause,
  onResume,
  onStop,
  onTalkToCoach,
}: RunControlsProps) {
  const [confirmingStop, setConfirmingStop] = useState(false);

  // Auto-dismiss stop confirmation after 4 seconds
  useEffect(() => {
    if (!confirmingStop) return;
    const timer = setTimeout(() => setConfirmingStop(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingStop]);

  const handleStopPress = useCallback(() => {
    if (confirmingStop) {
      onStop();
      setConfirmingStop(false);
    } else {
      setConfirmingStop(true);
    }
  }, [confirmingStop, onStop]);

  const handleCancelStop = useCallback(() => {
    setConfirmingStop(false);
  }, []);

  if (status !== 'running' && status !== 'paused') return null;

  return (
    <div className="space-y-4">
      {/* Paused banner */}
      {status === 'paused' && (
        <div className="flex items-center justify-center">
          <div className="px-5 py-2 rounded-full bg-festival-orange/10 border border-festival-orange/30">
            <span className="text-sm font-medium text-festival-orange animate-pulse">
              Run Paused
            </span>
          </div>
        </div>
      )}

      {/* Stop confirmation banner */}
      {confirmingStop && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-festival-muted">End this run?</span>
          <button
            onClick={handleStopPress}
            className="px-4 py-1.5 rounded-full bg-festival-red text-white text-sm font-medium
                       active:scale-95 transition-transform"
          >
            Finish Run
          </button>
          <button
            onClick={handleCancelStop}
            className="px-4 py-1.5 rounded-full bg-festival-card border border-festival-border
                       text-festival-muted text-sm font-medium active:scale-95 transition-transform"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-6">
        {status === 'running' ? (
          <>
            <button
              onClick={onTalkToCoach}
              className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                isListening
                  ? 'bg-festival-orange/20 border-2 border-festival-orange animate-pulse'
                  : 'bg-festival-card border border-festival-border'
              }`}
              aria-label={isListening ? 'Listening...' : 'Talk to coach'}
            >
              <Mic className={`w-6 h-6 ${isListening ? 'text-white' : 'text-festival-orange'}`} />
            </button>

            <button
              onClick={onPause}
              className="w-20 h-20 rounded-full bg-festival-orange
                         flex items-center justify-center active:scale-90 transition-transform
                         shadow-lg shadow-festival-orange/30"
              aria-label="Pause run"
            >
              <Pause className="w-10 h-10 text-white" />
            </button>

            <div className="w-14 h-14" /> {/* Spacer for symmetry */}
          </>
        ) : (
          <>
            <button
              onClick={handleStopPress}
              className={`w-14 h-14 rounded-full flex items-center justify-center
                         active:scale-95 transition-all ${
                           confirmingStop
                             ? 'bg-festival-red/30 border-2 border-festival-red'
                             : 'bg-festival-red'
                         }`}
              aria-label="Stop run"
            >
              <Square className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={onResume}
              className="w-20 h-20 rounded-full bg-festival-orange
                         flex items-center justify-center active:scale-90 transition-transform
                         shadow-lg shadow-festival-orange/30"
              aria-label="Resume run"
            >
              <Play className="w-10 h-10 text-white ml-1" />
            </button>

            <div className="w-14 h-14" /> {/* Spacer for symmetry */}
          </>
        )}
      </div>
    </div>
  );
}
