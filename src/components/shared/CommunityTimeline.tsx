'use client';

import { useEffect } from 'react';
import { MapPin, Clock, Route, Flame, Wind, BarChart3, BookOpen } from 'lucide-react';
import { useTimelineStore, type TimelineRun } from '@/lib/store/timeline-store';
import { generateTimelineRuns, formatTimeAgo } from '@/lib/collective/timeline';
import { formatPace, formatDistance, formatTime } from '@/lib/gps/pace';

const PERSONA_ICONS = {
  hype: Flame,
  calm: Wind,
  data: BarChart3,
  storyteller: BookOpen,
} as const;

const PERSONA_COLORS = {
  hype: 'text-orange-400',
  calm: 'text-blue-400',
  data: 'text-emerald-400',
  storyteller: 'text-purple-400',
} as const;

function RunCard({ run }: { run: TimelineRun }) {
  const PersonaIcon = PERSONA_ICONS[run.persona as keyof typeof PERSONA_ICONS] || Flame;
  const personaColor = PERSONA_COLORS[run.persona as keyof typeof PERSONA_COLORS] || 'text-festival-orange';

  return (
    <div className="card flex items-start gap-3 group hover:border-festival-orange/30 transition-colors">
      {/* Avatar / persona indicator */}
      <div className={`w-10 h-10 rounded-full bg-festival-dark flex items-center justify-center flex-shrink-0 ${personaColor}`}>
        <PersonaIcon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name and city */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white text-sm truncate">
            {run.displayName}
          </span>
          <span className="flex items-center gap-1 text-xs text-festival-muted flex-shrink-0">
            <MapPin className="w-3 h-3" />
            {run.city}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-festival-text">
            <Route className="w-3.5 h-3.5 text-festival-orange" />
            {formatDistance(run.distanceMeters)} km
          </span>
          <span className="flex items-center gap-1 text-festival-text">
            <Clock className="w-3.5 h-3.5 text-festival-orange" />
            {formatTime(run.elapsedSeconds)}
          </span>
          <span className="text-festival-text font-mono">
            {formatPace(run.averagePaceSecondsPerKm)}/km
          </span>
        </div>
      </div>

      {/* Time ago */}
      <span className="text-xs text-festival-muted flex-shrink-0 mt-1">
        {formatTimeAgo(run.completedAt)}
      </span>
    </div>
  );
}

interface CommunityTimelineProps {
  className?: string;
}

export function CommunityTimeline({ className = '' }: CommunityTimelineProps) {
  const { runs, isLoading, setRuns, setLoading, addRun } = useTimelineStore();

  // Seed timeline with synthetic runs on mount
  useEffect(() => {
    if (runs.length === 0) {
      setLoading(true);
      // Simulate a brief load
      const timer = setTimeout(() => {
        setRuns(generateTimelineRuns(25));
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [runs.length, setRuns, setLoading]);

  // Periodically add new "live" runs
  useEffect(() => {
    const interval = setInterval(() => {
      const newRuns = generateTimelineRuns(1);
      if (newRuns[0]) {
        newRuns[0].completedAt = Date.now(); // just now
        addRun(newRuns[0]);
      }
    }, 15_000); // New run every 15 seconds

    return () => clearInterval(interval);
  }, [addRun]);

  return (
    <div className={className}>
      <h2 className="stat-label mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Community Runs
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card animate-pulse h-20"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
