'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { DemoGpsTracker } from '@/lib/gps/demo-data';
import { generateSyntheticMilestone } from '@/lib/collective/synthetic';
import { formatPace, formatTime, formatDistance } from '@/lib/gps/pace';
import { PaceDisplay } from './PaceDisplay';
import { RunControls } from './RunControls';
import { CollectiveBanner } from './CollectiveBanner';
import { CoachingIndicator } from './CoachingIndicator';

interface DemoRunScreenProps {
  onFinish: () => void;
  onTalkToCoach: () => void;
  isListening?: boolean;
  isCoaching?: boolean;
}

export function DemoRunScreen({ onFinish, onTalkToCoach, isListening = false, isCoaching = false }: DemoRunScreenProps) {
  const store = useRunStore();
  const trackerRef = useRef<DemoGpsTracker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const milestoneRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (store.status !== 'running') return;

    // Seed synthetic runner count
    useCollectiveStore.getState().setRunnerCount(
      287 + Math.floor(Math.random() * 100)
    );

    // Start demo GPS tracker at 10x speed
    if (!trackerRef.current) {
      trackerRef.current = new DemoGpsTracker((point) => {
        useRunStore.getState().addGpsPoint(point);
      }, 10);
      trackerRef.current.start();
    }

    // Elapsed time timer (accelerated)
    if (!timerRef.current) {
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        const s = useRunStore.getState();
        if (s.status === 'running') {
          elapsed += 3; // 3 seconds per tick at 10x
          s.updateElapsedTime(elapsed);
        }
      }, 300); // 300ms = 3s at 10x
    }

    // Generate synthetic milestones periodically
    if (!milestoneRef.current) {
      milestoneRef.current = setInterval(() => {
        const milestone = generateSyntheticMilestone();
        useCollectiveStore.getState().addEvent({
          type: 'milestone',
          text: `${milestone.name} in ${milestone.city} ${milestone.achievement}`,
          timestamp: Date.now(),
        });
        // Fluctuate runner count
        const current = useCollectiveStore.getState().runnerCount;
        const delta = Math.floor(Math.random() * 10) - 4;
        useCollectiveStore.getState().setRunnerCount(Math.max(100, current + delta));
      }, 5000);
    }

    return () => {};
  }, [store.status]);

  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (milestoneRef.current) clearInterval(milestoneRef.current);
    };
  }, []);

  const handlePause = useCallback(() => {
    store.pauseRun();
    trackerRef.current?.stop();
    trackerRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [store]);

  const handleResume = useCallback(() => {
    store.resumeRun();
  }, [store]);

  const handleStop = useCallback(() => {
    store.finishRun();
    trackerRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (milestoneRef.current) clearInterval(milestoneRef.current);
    onFinish();
  }, [store, onFinish]);

  const unit = store.distanceUnit;

  return (
    <div className="min-h-screen bg-festival-darker flex flex-col">
      {/* Demo indicator */}
      <div className="flex items-center justify-center pt-2">
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
          DEMO MODE (10x speed)
        </span>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-center px-4 py-2">
        <CollectiveBanner />
      </div>

      {/* Main stats */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <PaceDisplay
          paceSecondsPerKm={store.currentPaceSecondsPerKm}
          unit={unit}
        />

        <div className="flex items-center gap-12">
          <div className="text-center">
            <div className="stat-label">Distance</div>
            <div className="stat-medium text-white">
              {formatDistance(store.distanceMeters, unit)}
            </div>
            <div className="text-xs text-festival-muted mt-0.5">{unit}</div>
          </div>

          <div className="text-center">
            <div className="stat-label">Time</div>
            <div className="stat-medium text-white">
              {formatTime(store.elapsedSeconds)}
            </div>
          </div>

          <div className="text-center">
            <div className="stat-label">Avg Pace</div>
            <div className="stat-medium text-white">
              {formatPace(store.averagePaceSecondsPerKm, unit)}
            </div>
          </div>
        </div>

        {store.splits.length > 0 && (
          <div className="card flex items-center gap-3">
            <div className="text-festival-orange font-semibold">
              Split {store.splits[store.splits.length - 1].number}
            </div>
            <div className="text-white font-mono">
              {formatPace(store.splits[store.splits.length - 1].paceSeconds, unit)}
            </div>
          </div>
        )}

        {store.targetDistanceMeters && (
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-festival-muted mb-1">
              <span>{formatDistance(store.distanceMeters, unit)} {unit}</span>
              <span>{formatDistance(store.targetDistanceMeters, unit)} {unit}</span>
            </div>
            <div className="h-2 bg-festival-card rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-festival-orange to-festival-red rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (store.distanceMeters / store.targetDistanceMeters) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Recent collective events */}
        <RecentEvents />
      </div>

      {/* Coach activity indicator */}
      <CoachingIndicator isActive={isCoaching} />

      {/* Controls */}
      <div className="px-6 pb-8">
        <RunControls
          status={store.status}
          isListening={isListening}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onTalkToCoach={onTalkToCoach}
        />
      </div>
    </div>
  );
}

function RecentEvents() {
  const events = useCollectiveStore((s) => s.recentEvents);
  const latest = events[0];
  if (!latest) return null;

  return (
    <div className="card text-sm text-festival-muted max-w-xs text-center animate-pulse-slow">
      {latest.text}
    </div>
  );
}
