'use client';

import { useRouter } from 'next/navigation';
import { useRunStore } from '@/lib/store/run-store';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { RecapStats } from '@/components/recap/RecapStats';
import { SplitsTable } from '@/components/recap/SplitsTable';
import { Home, Share2, Zap } from 'lucide-react';

export default function RecapPage() {
  const router = useRouter();
  const store = useRunStore();
  const collective = useCollectiveStore();

  const handleDone = () => {
    store.resetRun();
    collective.reset();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <Zap className="w-10 h-10 text-festival-orange mx-auto mb-2" />
        <h1 className="text-3xl font-bold text-white mb-1">Run Complete!</h1>
        <p className="text-festival-muted">Great effort out there</p>
      </div>

      {/* Stats */}
      <div className="space-y-4 mb-6">
        <RecapStats
          distanceMeters={store.distanceMeters}
          elapsedSeconds={store.elapsedSeconds}
          averagePace={store.averagePaceSecondsPerKm}
          splitsCount={store.splits.length}
          unit={store.distanceUnit}
        />
      </div>

      {/* Splits */}
      <div className="mb-6">
        <SplitsTable
          splits={store.splits}
          targetPace={store.targetPaceSecondsPerKm}
          unit={store.distanceUnit}
        />
      </div>

      {/* Collective */}
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
