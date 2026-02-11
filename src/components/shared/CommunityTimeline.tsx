'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, Route, Flame, Wind, BarChart3, BookOpen } from 'lucide-react';
import { useTimelineStore, type TimelineRun } from '@/lib/store/timeline-store';
import { formatTimeAgo } from '@/lib/collective/timeline';
import { formatPace, formatDistance, formatTime } from '@/lib/gps/pace';
import { GuestNamePrompt } from '@/components/shared/GuestNamePrompt';
import { useUserStore } from '@/lib/store/user-store';
import { getGuestName } from '@/lib/guest-name';

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
          {run.city && (
            <span className="flex items-center gap-1 text-xs text-festival-muted flex-shrink-0">
              <MapPin className="w-3 h-3" />
              {run.city}
            </span>
          )}
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
  const { runs, isLoading, setRuns, setLoading } = useTimelineStore();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Check if unauthenticated user needs to set a guest name
  useEffect(() => {
    if (!isAuthenticated && !getGuestName()) {
      setShowGuestPrompt(true);
    }
  }, [isAuthenticated]);

  // Fetch real completed runs from API on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchRuns() {
      setLoading(true);
      try {
        const res = await fetch('/api/community-runs');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.runs)) {
          // Merge with any locally-added runs (e.g. user's own run)
          const dbRunIds = new Set(data.runs.map((r: TimelineRun) => r.id));
          const localOnly = runs.filter((r) => !dbRunIds.has(r.id));
          const merged = [...localOnly, ...data.runs].sort(
            (a, b) => b.completedAt - a.completedAt
          );
          setRuns(merged);
        }
      } catch {
        // API unavailable — keep any existing local runs
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRuns();
    return () => { cancelled = true; };
    // Only fetch on mount — don't re-fetch when runs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRuns, setLoading]);

  // Refresh from API every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/community-runs');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.runs) && data.runs.length > 0) {
          const dbRunIds = new Set(data.runs.map((r: TimelineRun) => r.id));
          const currentRuns = useTimelineStore.getState().runs;
          const localOnly = currentRuns.filter((r) => !dbRunIds.has(r.id));
          const merged = [...localOnly, ...data.runs].sort(
            (a, b) => b.completedAt - a.completedAt
          );
          setRuns(merged);
        }
      } catch {
        // Silent — keep current data
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [setRuns]);

  return (
    <div className={className}>
      {showGuestPrompt && (
        <GuestNamePrompt onDone={() => setShowGuestPrompt(false)} />
      )}

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
      ) : runs.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-festival-muted text-sm">
            No runs yet. Be the first to complete a run!
          </p>
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
