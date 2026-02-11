'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { useTimelineStore } from '@/lib/store/timeline-store';
import { useUserStore } from '@/lib/store/user-store';
import { updateRunAiSummary } from '@/lib/services/run-persistence';
import { getGuestName } from '@/lib/guest-name';
import { RecapStats } from '@/components/recap/RecapStats';
import { SplitsTable } from '@/components/recap/SplitsTable';
import { RecapNarrative } from '@/components/recap/RecapNarrative';
import { RecapMap } from '@/components/recap/RecapMap';
import { Home, Share2, Trophy } from 'lucide-react';
import { formatDistance } from '@/lib/gps/pace';

export default function RecapPage() {
  const router = useRouter();
  const store = useRunStore();
  const collective = useCollectiveStore();
  const addTimelineRun = useTimelineStore((s) => s.addRun);
  const user = useUserStore((s) => s.user);
  const addedToTimeline = useRef(false);

  // Add the completed run to the community timeline store
  useEffect(() => {
    if (addedToTimeline.current) return;
    if (store.distanceMeters <= 0 || store.elapsedSeconds <= 0) return;

    const displayName = user?.name ?? getGuestName() ?? 'Runner';
    addTimelineRun({
      id: store.runId ?? `local-${Date.now()}`,
      userId: user?.id ?? 'guest',
      displayName,
      city: user?.city ?? '',
      distanceMeters: store.distanceMeters,
      elapsedSeconds: store.elapsedSeconds,
      averagePaceSecondsPerKm: store.averagePaceSecondsPerKm,
      persona: store.persona,
      completedAt: Date.now(),
      isSynthetic: false,
    });
    addedToTimeline.current = true;
  }, [store.distanceMeters, store.elapsedSeconds, store.averagePaceSecondsPerKm, store.persona, store.runId, user, addTimelineRun]);

  const handleDone = () => {
    store.resetRun();
    collective.reset();
    router.push('/');
  };

  const handleNarrativeLoaded = useCallback((narrative: string) => {
    if (store.runId) {
      updateRunAiSummary(store.runId, narrative);
    }
  }, [store.runId]);

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Celebration header — the emotional payoff */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-festival-orange/10 border-2 border-festival-orange
                        flex items-center justify-center mx-auto mb-3">
          <Trophy className="w-8 h-8 text-festival-orange" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">You did it!</h1>
        <p className="text-lg text-festival-orange font-medium">
          {formatDistance(store.distanceMeters, store.distanceUnit)} {store.distanceUnit} complete
        </p>
      </div>

      {/* Stats first — the achievement */}
      <div className="space-y-4 mb-6">
        <RecapStats
          distanceMeters={store.distanceMeters}
          elapsedSeconds={store.elapsedSeconds}
          averagePace={store.averagePaceSecondsPerKm}
          splitsCount={store.splits.length}
          unit={store.distanceUnit}
        />
      </div>

      {/* Collective — social connection */}
      {collective.runnerCount > 0 && (
        <div className="card mb-6 text-center">
          <p className="text-festival-muted text-sm">
            You ran with{' '}
            <span className="text-white font-semibold">
              {collective.runnerCount.toLocaleString()}
            </span>{' '}
            other people today
          </p>
        </div>
      )}

      {/* AI Recap Narrative */}
      <div className="mb-6">
        <RecapNarrative
          distanceMeters={store.distanceMeters}
          elapsedSeconds={store.elapsedSeconds}
          averagePaceSecondsPerKm={store.averagePaceSecondsPerKm}
          targetPaceSecondsPerKm={store.targetPaceSecondsPerKm}
          targetDistanceMeters={store.targetDistanceMeters}
          splits={store.splits.map((s) => ({ number: s.number, paceSeconds: s.paceSeconds }))}
          persona={store.persona}
          runnerCount={collective.runnerCount}
          onNarrativeLoaded={handleNarrativeLoaded}
        />
      </div>

      {/* Map — route visualization */}
      <div className="mb-6">
        <RecapMap
          gpsPoints={store.gpsPoints}
          splits={store.splits}
          averagePaceSecondsPerKm={store.averagePaceSecondsPerKm}
        />
      </div>

      {/* Splits — detailed data */}
      <div className="mb-6">
        <SplitsTable
          splits={store.splits}
          targetPace={store.targetPaceSecondsPerKm}
          unit={store.distanceUnit}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDone}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Done
        </button>
        <button
          className="w-14 h-14 rounded-full bg-festival-card border border-festival-border
                     flex items-center justify-center"
          onClick={() => {
            // Share functionality — future
          }}
        >
          <Share2 className="w-5 h-5 text-festival-muted" />
        </button>
      </div>
    </div>
  );
}
