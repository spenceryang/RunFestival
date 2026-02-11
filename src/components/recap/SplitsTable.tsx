'use client';

import type { Split } from '@/types/run';
import { formatPace } from '@/lib/gps/pace';

interface SplitsTableProps {
  splits: Split[];
  targetPace: number | null;
  unit: 'km' | 'mi';
}

export function SplitsTable({ splits, targetPace, unit }: SplitsTableProps) {
  if (splits.length === 0) return null;

  return (
    <div className="card">
      <h3 className="stat-label mb-3">Splits</h3>
      <div className="space-y-2">
        {splits.map((split) => {
          const isAhead = targetPace ? split.paceSeconds <= targetPace : false;
          const isBehind = targetPace ? split.paceSeconds > targetPace : false;

          return (
            <div
              key={split.number}
              className="flex items-center justify-between py-2 border-b border-festival-border/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-festival-orange font-semibold w-8">
                  {split.number}
                </span>
                <span className="font-mono text-white">
                  {formatPace(split.paceSeconds, unit)}
                </span>
                <span className="text-xs text-festival-muted">/{unit}</span>
              </div>
              {targetPace && (
                <span
                  className={`text-xs font-semibold ${
                    isAhead ? 'text-green-400' : isBehind ? 'text-red-400' : ''
                  }`}
                >
                  {isAhead ? 'Ahead' : isBehind ? 'Behind' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
