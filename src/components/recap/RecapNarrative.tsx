'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getApiHeaders } from '@/lib/auth/demo-headers';

interface RecapNarrativeProps {
  distanceMeters: number;
  elapsedSeconds: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  splits: Array<{ number: number; paceSeconds: number }>;
  persona: string;
  runnerCount: number;
  onNarrativeLoaded?: (narrative: string) => void;
}

export function RecapNarrative(props: RecapNarrativeProps) {
  const [narrative, setNarrative] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchNarrative() {
      try {
        const response = await fetch('/api/recap', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify(props),
        });

        if (!response.ok) throw new Error('Failed');

        const data = await response.json();
        if (!cancelled) {
          setNarrative(data.narrative);
          setIsLoading(false);
          if (props.onNarrativeLoaded) {
            props.onNarrativeLoaded(data.narrative);
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      }
    }

    fetchNarrative();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-festival-orange" />
        <h3 className="stat-label">Coach&apos;s Take</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-festival-border/30 rounded animate-pulse w-full" />
          <div className="h-3 bg-festival-border/30 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-festival-border/30 rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-sm text-festival-text leading-relaxed italic">
          &ldquo;{narrative}&rdquo;
        </p>
      )}
    </div>
  );
}
