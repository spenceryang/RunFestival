'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MapPin, Gauge } from 'lucide-react';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { DevGpsTracker } from '@/lib/gps/sf-marathon-route';
import { generateSyntheticMilestone } from '@/lib/collective/synthetic';
import { formatPace, formatTime, formatDistance } from '@/lib/gps/pace';
import { PaceDisplay } from './PaceDisplay';
import { RunControls } from './RunControls';
import { CollectiveBanner } from './CollectiveBanner';

const SPEED_OPTIONS = [5, 10, 20, 50] as const;

interface DevRunScreenProps {
  onFinish: () => void;
  onTalkToCoach: () => void;
  isListening?: boolean;
}

export function DevRunScreen({ onFinish, onTalkToCoach, isListening = false }: DevRunScreenProps) {
  const store = useRunStore();
  const trackerRef = useRef<DevGpsTracker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const milestoneRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [speed, setSpeed] = useState(20);
  const [debugInfo, setDebugInfo] = useState({
    pointIndex: 0,
    totalPoints: 0,
    lat: 0,
    lng: 0,
    accuracy: 0,
    progress: 0,
  });

  const startTracking = useCallback((speedMultiplier: number) => {
    // Clean up existing
    if (trackerRef.current) trackerRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);

    // Start dev GPS tracker
    trackerRef.current = new DevGpsTracker((point) => {
      useRunStore.getState().addGpsPoint(point);

      // Update debug info
      if (trackerRef.current) {
        setDebugInfo({
          pointIndex: trackerRef.current.currentPointIndex,
          totalPoints: trackerRef.current.pointCount,
          lat: point.lat,
          lng: point.lng,
          accuracy: point.accuracy,
          progress: trackerRef.current.progress,
        });
      }
    }, speedMultiplier);
    trackerRef.current.start();

    // Elapsed time timer (accelerated to match GPS speed)
    let elapsed = useRunStore.getState().elapsedSeconds;
    const secondsPerTick = 3; // each GPS point is 3s apart
    const tickIntervalMs = 3000 / speedMultiplier;

    timerRef.current = setInterval(() => {
      const s = useRunStore.getState();
      if (s.status === 'running') {
        elapsed += secondsPerTick;
        s.updateElapsedTime(elapsed);
      }
    }, tickIntervalMs);
  }, []);

  useEffect(() => {
    if (store.status !== 'running') return;

    // Seed synthetic runner count (marathon vibes — lots of runners)
    useCollectiveStore.getState().setRunnerCount(
      1247 + Math.floor(Math.random() * 500)
    );

    // Start tracking at current speed
    if (!trackerRef.current) {
      startTracking(speed);
    }

    // Generate synthetic milestones
    if (!milestoneRef.current) {
      milestoneRef.current = setInterval(() => {
        const milestone = generateSyntheticMilestone();
        useCollectiveStore.getState().addEvent({
          type: 'milestone',
          text: `${milestone.name} in ${milestone.city} ${milestone.achievement}`,
          timestamp: Date.now(),
        });
        const current = useCollectiveStore.getState().runnerCount;
        const delta = Math.floor(Math.random() * 20) - 8;
        useCollectiveStore.getState().setRunnerCount(Math.max(500, current + delta));
      }, 4000);
    }

    return () => {};
  }, [store.status, speed, startTracking]);

  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (milestoneRef.current) clearInterval(milestoneRef.current);
    };
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    const s = useRunStore.getState();
    if (s.status === 'running') {
      // Restart tracking with new speed
      if (trackerRef.current) trackerRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);

      trackerRef.current = new DevGpsTracker((point) => {
        useRunStore.getState().addGpsPoint(point);
        if (trackerRef.current) {
          setDebugInfo({
            pointIndex: trackerRef.current.currentPointIndex,
            totalPoints: trackerRef.current.pointCount,
            lat: point.lat,
            lng: point.lng,
            accuracy: point.accuracy,
            progress: trackerRef.current.progress,
          });
        }
      }, newSpeed);
      trackerRef.current.start();

      let elapsed = useRunStore.getState().elapsedSeconds;
      const tickIntervalMs = 3000 / newSpeed;
      timerRef.current = setInterval(() => {
        const state = useRunStore.getState();
        if (state.status === 'running') {
          elapsed += 3;
          state.updateElapsedTime(elapsed);
        }
      }, tickIntervalMs);
    }
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
      {/* Dev mode badge */}
      <div className="flex items-center justify-center pt-2">
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
          DEV MODE — SF Marathon 2026 ({speed}x)
        </span>
      </div>

      {/* Speed controls */}
      <div className="flex items-center justify-center gap-2 px-4 pt-2">
        <Gauge className="w-3.5 h-3.5 text-festival-muted" />
        <span className="text-xs text-festival-muted mr-1">Speed:</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            className={`px-2.5 py-0.5 text-xs rounded-full font-mono transition-all
              ${speed === s
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-festival-card text-festival-muted border border-festival-border hover:text-white'
              }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Collective banner */}
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

        {/* Recent events */}
        <RecentEvents />

        {/* GPS Debug info */}
        <div className="card bg-festival-dark/50 border-red-500/20 w-full max-w-xs">
          <div className="text-xs font-mono text-festival-muted space-y-1">
            <div className="text-red-400 font-semibold mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              GPS Debug
            </div>
            <div className="flex justify-between">
              <span>Point:</span>
              <span className="text-white">{debugInfo.pointIndex} / {debugInfo.totalPoints}</span>
            </div>
            <div className="flex justify-between">
              <span>Lat:</span>
              <span className="text-white">{debugInfo.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Lng:</span>
              <span className="text-white">{debugInfo.lng.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Accuracy:</span>
              <span className="text-white">{debugInfo.accuracy.toFixed(1)}m</span>
            </div>
            <div className="flex justify-between">
              <span>Route:</span>
              <span className="text-white">{(debugInfo.progress * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

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
