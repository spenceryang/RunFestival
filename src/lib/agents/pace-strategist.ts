import type { Split } from '@/types/run';

export interface PaceAnalysis {
  strategy: 'even' | 'negative' | 'positive' | 'erratic' | 'insufficient_data';
  advice: string;
  projectedFinishSeconds: number | null;
  recentTrend: 'speeding_up' | 'slowing_down' | 'steady';
  splitVariation: number; // coefficient of variation as percentage
}

/**
 * Rule-based pace strategist. Analyzes splits, projects finish time,
 * and classifies pacing strategy. Zero API cost — pure math.
 */
export function analyzePace(
  splits: Split[],
  distanceMeters: number,
  elapsedSeconds: number,
  targetDistanceMeters: number | null,
  targetPaceSecondsPerKm: number | null
): PaceAnalysis {
  if (splits.length < 2) {
    return {
      strategy: 'insufficient_data',
      advice: '',
      projectedFinishSeconds: projectFinish(distanceMeters, elapsedSeconds, targetDistanceMeters),
      recentTrend: 'steady',
      splitVariation: 0,
    };
  }

  const paces = splits.map((s) => s.paceSeconds);
  const strategy = classifyStrategy(paces);
  const recentTrend = detectTrend(paces);
  const splitVariation = coefficientOfVariation(paces);
  const projectedFinishSeconds = projectFinish(distanceMeters, elapsedSeconds, targetDistanceMeters);

  const advice = buildAdvice(strategy, recentTrend, paces, targetPaceSecondsPerKm, projectedFinishSeconds, targetDistanceMeters);

  return {
    strategy,
    advice,
    projectedFinishSeconds,
    recentTrend,
    splitVariation,
  };
}

function classifyStrategy(paces: number[]): PaceAnalysis['strategy'] {
  if (paces.length < 2) return 'insufficient_data';

  const firstHalf = paces.slice(0, Math.ceil(paces.length / 2));
  const secondHalf = paces.slice(Math.ceil(paces.length / 2));

  const avgFirst = mean(firstHalf);
  const avgSecond = mean(secondHalf);

  const cv = coefficientOfVariation(paces);

  // High variation = erratic
  if (cv > 15) return 'erratic';

  const diff = ((avgSecond - avgFirst) / avgFirst) * 100;

  // Negative split: second half faster (lower pace seconds) by >3%
  if (diff < -3) return 'negative';
  // Positive split: second half slower by >3%
  if (diff > 3) return 'positive';
  return 'even';
}

function detectTrend(paces: number[]): PaceAnalysis['recentTrend'] {
  if (paces.length < 2) return 'steady';

  const recent = paces.slice(-3);
  if (recent.length < 2) return 'steady';

  const first = recent[0];
  const last = recent[recent.length - 1];
  const change = ((last - first) / first) * 100;

  if (change < -5) return 'speeding_up';
  if (change > 5) return 'slowing_down';
  return 'steady';
}

function projectFinish(
  distanceMeters: number,
  elapsedSeconds: number,
  targetDistanceMeters: number | null
): number | null {
  if (!targetDistanceMeters || distanceMeters <= 0 || elapsedSeconds <= 0) return null;

  const pacePerMeter = elapsedSeconds / distanceMeters;
  return Math.round(pacePerMeter * targetDistanceMeters);
}

function buildAdvice(
  strategy: PaceAnalysis['strategy'],
  trend: PaceAnalysis['recentTrend'],
  paces: number[],
  targetPace: number | null,
  projectedFinish: number | null,
  targetDistance: number | null
): string {
  const parts: string[] = [];

  // Strategy-based advice
  switch (strategy) {
    case 'negative':
      parts.push('Running a negative split — strong second-half strategy.');
      break;
    case 'positive':
      parts.push('Positive splitting — started fast, pace increasing.');
      break;
    case 'erratic':
      parts.push('Pace is variable — finding a rhythm could help efficiency.');
      break;
    case 'even':
      parts.push('Even pacing — textbook execution.');
      break;
  }

  // Trend-based advice
  if (trend === 'slowing_down' && strategy !== 'positive') {
    parts.push('Recent trend: gradually slowing.');
  } else if (trend === 'speeding_up') {
    parts.push('Recent trend: picking up speed.');
  }

  // Target pace comparison
  if (targetPace && paces.length > 0) {
    const currentPace = paces[paces.length - 1];
    const diff = currentPace - targetPace;
    const diffPercent = Math.abs(diff / targetPace) * 100;

    if (diffPercent > 5) {
      if (diff > 0) {
        parts.push(`Last split ${Math.round(diff)}s/km slower than target.`);
      } else {
        parts.push(`Last split ${Math.round(Math.abs(diff))}s/km faster than target.`);
      }
    }
  }

  // Projected finish
  if (projectedFinish && targetDistance) {
    const projMinutes = Math.floor(projectedFinish / 60);
    const projSeconds = projectedFinish % 60;
    parts.push(`Projected finish: ${projMinutes}:${projSeconds.toString().padStart(2, '0')}.`);
  }

  return parts.join(' ');
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return (Math.sqrt(variance) / avg) * 100;
}
