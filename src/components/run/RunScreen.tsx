'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRunStore } from '@/lib/store/run-store';
import { GpsTracker } from '@/lib/gps/tracker';
import { requestWakeLock, releaseWakeLock } from '@/lib/gps/wake-lock';
import { saveGpsBuffer, saveRunState, clearRunData } from '@/lib/gps/storage';
import { formatPace, formatTime, formatDistance } from '@/lib/gps/pace';
import { PaceDisplay } from './PaceDisplay';
import { RunControls } from './RunControls';
import { CollectiveBanner } from './CollectiveBanner';
import { CoachingIndicator } from './CoachingIndicator';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { useCoachingStore } from '@/lib/store/coaching-store';
import { useUserStore } from '@/lib/store/user-store';
import { completeRunRecord } from '@/lib/services/run-persistence';
import { queueRunForSync } from '@/lib/services/offline-sync';
import { joinPresence, leavePresence, startHeartbeat } from '@/lib/collective/presence';
import { joinActiveRunners, heartbeatActiveRunner, leaveActiveRunners } from '@/lib/services/active-runners';
import { getGuestName } from '@/lib/guest-name';

interface RunScreenProps {
  onFinish: () => void;
  onTalkToCoach: () => void;
  isListening?: boolean;
  isCoaching?: boolean;
}

export function RunScreen({ onFinish, onTalkToCoach, isListening = false, isCoaching = false }: RunScreenProps) {
  const store = useRunStore();
  const user = useUserStore((s) => s.user);
  const trackerRef = useRef<GpsTracker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceJoinedRef = useRef(false);
  const activeRunnerIdRef = useRef<string | null>(null);
  const dbHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Join presence channels + DB active_runners on mount
  useEffect(() => {
    if (presenceJoinedRef.current) return;
    presenceJoinedRef.current = true;

    const displayName = user?.name ?? getGuestName() ?? 'Runner';
    const city = user?.city ?? 'Unknown';
    const userId = user?.id ?? `guest-${Date.now()}`;

    // Realtime presence (ephemeral — instant updates between connected devices)
    joinPresence({ userId, displayName, city });
    startHeartbeat(() => ({
      distanceMeters: useRunStore.getState().distanceMeters,
      currentPaceSecondsPerKm: useRunStore.getState().currentPaceSecondsPerKm,
    }));

    // DB-backed active_runners (persistent — cross-device visibility)
    const runId = useRunStore.getState().runId;
    joinActiveRunners({ userId, runId, displayName, city }).then((id) => {
      activeRunnerIdRef.current = id;
    });

    // DB heartbeat every 30s (independent of Realtime heartbeat)
    dbHeartbeatRef.current = setInterval(() => {
      if (activeRunnerIdRef.current) {
        const s = useRunStore.getState();
        heartbeatActiveRunner(activeRunnerIdRef.current, {
          distanceMeters: s.distanceMeters,
          currentPaceSecondsPerKm: s.currentPaceSecondsPerKm,
        });
      }
    }, 30_000);

    return () => {
      leavePresence();
      if (activeRunnerIdRef.current) {
        leaveActiveRunners(activeRunnerIdRef.current);
        activeRunnerIdRef.current = null;
      }
      if (dbHeartbeatRef.current) {
        clearInterval(dbHeartbeatRef.current);
        dbHeartbeatRef.current = null;
      }
      presenceJoinedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start GPS tracking and timer
  useEffect(() => {
    if (store.status !== 'running') return;

    // Request wake lock
    requestWakeLock();

    // Start GPS tracker
    if (!trackerRef.current) {
      trackerRef.current = new GpsTracker(
        (point) => {
          useRunStore.getState().addGpsPoint(point);
        },
        (error) => {
          console.warn('GPS error:', error.message);
        }
      );
      trackerRef.current.start();
    }

    // Start elapsed time timer
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        const s = useRunStore.getState();
        if (s.status === 'running' && s.startedAt) {
          const pauseAdjusted = (Date.now() - s.startedAt) / 1000;
          s.updateElapsedTime(Math.floor(pauseAdjusted));
        }
      }, 1000);
    }

    // Save to IndexedDB every 10 seconds
    if (!saveIntervalRef.current) {
      saveIntervalRef.current = setInterval(() => {
        const s = useRunStore.getState();
        if (s.status === 'running') {
          saveGpsBuffer(s.gpsPoints);
          saveRunState({
            distanceMeters: s.distanceMeters,
            elapsedSeconds: s.elapsedSeconds,
            splits: s.splits,
            startedAt: s.startedAt!,
            gpsPoints: s.gpsPoints,
          });
        }
      }, 10_000);
    }

    return () => {
      // Cleanup on unmount only
    };
  }, [store.status]);

  // Cleanup when run finishes or component unmounts
  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
      trackerRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      timerRef.current = null;
      saveIntervalRef.current = null;
      releaseWakeLock();
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
    // GPS and timer will restart via the effect
  }, [store]);

  const handleStop = useCallback(async () => {
    store.finishRun();
    trackerRef.current?.stop();
    trackerRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    timerRef.current = null;
    saveIntervalRef.current = null;
    await releaseWakeLock();

    // Persist run to Supabase if we have a run ID (authenticated user)
    const state = useRunStore.getState();
    console.warn('[RunScreen] handleStop — runId:', state.runId, 'distance:', state.distanceMeters);
    if (state.runId) {
      const runData = {
        runId: state.runId,
        distanceMeters: state.distanceMeters,
        elapsedSeconds: state.elapsedSeconds,
        averagePaceSecondsPerKm: state.averagePaceSecondsPerKm,
        splits: state.splits,
        gpsPoints: state.gpsPoints,
        coachingMessages: useCoachingStore.getState().history.map((h) => ({
          triggerType: h.triggerType,
          text: h.text,
          timestamp: h.timestamp,
        })),
        collectiveCount: useCollectiveStore.getState().runnerCount,
      };
      const success = await completeRunRecord(runData);
      if (!success) {
        await queueRunForSync(runData);
      }
    }

    await clearRunData();
    onFinish();
  }, [store, onFinish]);

  const unit = store.distanceUnit;

  return (
    <div className="min-h-screen bg-festival-darker flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-center pt-safe px-4 py-3">
        <CollectiveBanner />
      </div>

      {/* Main stats */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Current pace — the hero stat */}
        <PaceDisplay
          paceSecondsPerKm={store.currentPaceSecondsPerKm}
          unit={unit}
        />

        {/* Secondary stats row */}
        <div className="flex items-center gap-12">
          <div className="text-center">
            <div className="stat-label">Distance</div>
            <div className="stat-medium text-white">
              {formatDistance(store.distanceMeters, unit)}
            </div>
            <div className="text-xs text-festival-muted mt-0.5">
              {unit}
            </div>
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

        {/* Split indicator */}
        {store.splits.length > 0 && (
          <div className="card flex items-center gap-3">
            <div className="text-festival-orange font-semibold">
              Split {store.splits[store.splits.length - 1].number}
            </div>
            <div className="text-white font-mono">
              {formatPace(store.splits[store.splits.length - 1].paceSeconds, unit)}
            </div>
            {store.targetPaceSecondsPerKm && (
              <div
                className={`text-sm ${
                  store.splits[store.splits.length - 1].paceSeconds <=
                  store.targetPaceSecondsPerKm
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {store.splits[store.splits.length - 1].paceSeconds <=
                store.targetPaceSecondsPerKm
                  ? 'Ahead'
                  : 'Behind'}
              </div>
            )}
          </div>
        )}

        {/* Target progress */}
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
      </div>

      {/* Coach activity indicator */}
      <CoachingIndicator isActive={isCoaching} />

      {/* Controls */}
      <div className="pb-safe px-6 pb-8">
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
