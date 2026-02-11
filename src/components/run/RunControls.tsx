'use client';

import { Pause, Play, Square, Mic } from 'lucide-react';
import type { RunStatus } from '@/types/run';

interface RunControlsProps {
  status: RunStatus;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTalkToCoach: () => void;
}

export function RunControls({
  status,
  onPause,
  onResume,
  onStop,
  onTalkToCoach,
}: RunControlsProps) {
  if (status !== 'running' && status !== 'paused') return null;

  return (
    <div className="flex items-center justify-center gap-6">
      {status === 'running' ? (
        <>
          <button
            onClick={onTalkToCoach}
            className="w-14 h-14 rounded-full bg-festival-card border border-festival-border
                       flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Talk to coach"
          >
            <Mic className="w-6 h-6 text-festival-orange" />
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
            onClick={onStop}
            className="w-14 h-14 rounded-full bg-festival-red
                       flex items-center justify-center active:scale-95 transition-transform"
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
  );
}
