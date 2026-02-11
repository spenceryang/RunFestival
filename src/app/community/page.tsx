'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { CommunityTimeline } from '@/components/shared/CommunityTimeline';

export default function CommunityPage() {
  const router = useRouter();
  const runnerCount = useCollectiveStore((s) => s.runnerCount);

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full bg-festival-card border border-festival-border
                     flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-festival-text" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Community</h1>
          <p className="text-sm text-festival-muted">Recent runs from around the world</p>
        </div>
      </div>

      {/* Live stats banner */}
      <div className="card flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-festival-orange" />
          <span className="text-festival-text">
            <span className="text-white font-bold text-lg tabular-nums">
              {runnerCount.toLocaleString()}
            </span>{' '}
            active runners
          </span>
        </div>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400">Live</span>
        </span>
      </div>

      {/* Timeline */}
      <CommunityTimeline />
    </div>
  );
}
