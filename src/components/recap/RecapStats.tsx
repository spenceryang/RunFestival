'use client';

import { formatPace, formatTime, formatDistance } from '@/lib/gps/pace';
import { Trophy, Clock, Gauge, Route } from 'lucide-react';

interface RecapStatsProps {
  distanceMeters: number;
  elapsedSeconds: number;
  averagePace: number;
  splitsCount: number;
  unit: 'km' | 'mi';
}

export function RecapStats({
  distanceMeters,
  elapsedSeconds,
  averagePace,
  splitsCount,
  unit,
}: RecapStatsProps) {
  const stats = [
    {
      icon: Route,
      label: 'Distance',
      value: formatDistance(distanceMeters, unit),
      suffix: unit,
    },
    {
      icon: Clock,
      label: 'Duration',
      value: formatTime(elapsedSeconds),
      suffix: '',
    },
    {
      icon: Gauge,
      label: 'Avg Pace',
      value: formatPace(averagePace, unit),
      suffix: `/${unit}`,
    },
    {
      icon: Trophy,
      label: 'Splits',
      value: String(splitsCount),
      suffix: '',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="card flex items-center gap-3">
            <Icon className="w-5 h-5 text-festival-orange flex-shrink-0" />
            <div>
              <div className="stat-label">{stat.label}</div>
              <div className="text-lg font-bold text-white">
                {stat.value}
                <span className="text-sm text-festival-muted ml-1">
                  {stat.suffix}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
