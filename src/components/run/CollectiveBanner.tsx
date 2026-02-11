'use client';

import { Users } from 'lucide-react';
import { useCollectiveStore } from '@/lib/store/collective-store';

export function CollectiveBanner() {
  const runnerCount = useCollectiveStore((s) => s.runnerCount);

  if (runnerCount === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4
                    bg-festival-card/50 rounded-full border border-festival-border/50">
      <Users className="w-4 h-4 text-festival-orange" />
      <span className="text-sm text-festival-text">
        <span className="font-semibold text-white tabular-nums">
          {runnerCount.toLocaleString()}
        </span>{' '}
        running with you
      </span>
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
    </div>
  );
}
