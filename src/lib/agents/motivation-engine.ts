export type EnergyLevel = 'struggling' | 'steady' | 'surging';

export interface MotivationState {
  energyLevel: EnergyLevel;
  approach: string;
  shouldBoost: boolean;
  recentPaceTrend: number; // percentage change (negative = faster)
}

/**
 * Rule-based motivation engine. Analyzes pace trends to detect struggle
 * vs flow state, picks the right energy level. Zero API cost.
 */
export function assessMotivation(
  splits: Array<{ number: number; paceSeconds: number }>,
  currentPaceSecondsPerKm: number,
  targetPaceSecondsPerKm: number | null,
  elapsedSeconds: number,
  targetDistanceMeters: number | null,
  distanceMeters: number
): MotivationState {
  const recentPaceTrend = calculatePaceTrend(splits);
  const energyLevel = classifyEnergy(recentPaceTrend, currentPaceSecondsPerKm, targetPaceSecondsPerKm);
  const isInFinalStretch = isApproachingEnd(distanceMeters, targetDistanceMeters);
  const shouldBoost = energyLevel === 'struggling' || isInFinalStretch;
  const approach = buildApproach(energyLevel, isInFinalStretch, elapsedSeconds, recentPaceTrend);

  return {
    energyLevel,
    approach,
    shouldBoost,
    recentPaceTrend,
  };
}

function calculatePaceTrend(splits: Array<{ paceSeconds: number }>): number {
  if (splits.length < 2) return 0;

  // Compare last 3 splits (or fewer if not enough data)
  const recent = splits.slice(-3);
  if (recent.length < 2) return 0;

  const first = recent[0].paceSeconds;
  const last = recent[recent.length - 1].paceSeconds;

  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

function classifyEnergy(
  paceTrend: number,
  currentPace: number,
  targetPace: number | null
): EnergyLevel {
  // Slowing by >10% = struggling
  if (paceTrend > 10) return 'struggling';

  // Speeding up by >5% = surging
  if (paceTrend < -5) return 'surging';

  // If we have a target and they're >15% off, struggling
  if (targetPace && currentPace > 0) {
    const drift = ((currentPace - targetPace) / targetPace) * 100;
    if (drift > 15) return 'struggling';
  }

  return 'steady';
}

function isApproachingEnd(distanceMeters: number, targetDistanceMeters: number | null): boolean {
  if (!targetDistanceMeters || targetDistanceMeters <= 0) return false;
  const progress = distanceMeters / targetDistanceMeters;
  return progress >= 0.85;
}

function buildApproach(
  energy: EnergyLevel,
  isFinalStretch: boolean,
  elapsedSeconds: number,
  paceTrend: number
): string {
  if (isFinalStretch) {
    switch (energy) {
      case 'struggling':
        return 'Dig deep — the finish line is close. Acknowledge the effort, encourage one last push.';
      case 'surging':
        return 'They\'re finishing strong — celebrate the kick and fuel the final surge.';
      case 'steady':
        return 'Steady into the finish — remind them how far they\'ve come, build excitement.';
    }
  }

  switch (energy) {
    case 'struggling':
      if (elapsedSeconds < 600) {
        return 'Early struggle — suggest settling into a comfortable rhythm, no judgment.';
      }
      return 'Mid-run struggle — empathize, suggest mental reset techniques, remind them it\'s temporary.';
    case 'surging':
      return 'They\'re in the zone — keep energy high, don\'t distract from flow state.';
    case 'steady':
      if (Math.abs(paceTrend) < 2) {
        return 'Locked in — steady rhythm. Good time for stories or observations.';
      }
      return 'Maintaining well — gentle encouragement, weave in context.';
  }
}
