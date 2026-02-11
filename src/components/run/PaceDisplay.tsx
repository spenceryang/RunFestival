'use client';

import { formatPace } from '@/lib/gps/pace';

interface PaceDisplayProps {
  paceSecondsPerKm: number;
  unit: 'km' | 'mi';
  label?: string;
}

export function PaceDisplay({ paceSecondsPerKm, unit, label = 'Current Pace' }: PaceDisplayProps) {
  const paceStr = formatPace(paceSecondsPerKm, unit);
  const unitLabel = unit === 'km' ? '/km' : '/mi';

  return (
    <div className="text-center">
      <div className="stat-label">{label}</div>
      <div className="stat-large text-white">
        {paceStr}
      </div>
      <div className="text-sm text-festival-muted mt-1">{unitLabel}</div>
    </div>
  );
}
