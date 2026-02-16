export type EnergyLevel = 'struggling' | 'steady' | 'surging';
export type RunPhase = 'warmup' | 'settling' | 'mid_grind' | 'pre_wall' | 'wall' | 'final_kick';
export type MindsetMode = 'how' | 'why';
export type Momentum = 'recovering' | 'fading' | 'stable' | 'breakthrough';

export interface MotivationState {
  energyLevel: EnergyLevel;
  approach: string;
  shouldBoost: boolean;
  recentPaceTrend: number; // percentage change (negative = faster)
  runPhase: RunPhase;
  mindsetMode: MindsetMode;
  momentum: Momentum;
  selfTalkCue: string;
}

/**
 * Rule-based motivation engine. Analyzes pace trends to detect struggle
 * vs flow state, picks the right energy level. Uses research-backed
 * run phases, "how" vs "why" mindset selection, momentum detection,
 * and self-talk cues. Zero API cost.
 */
export function assessMotivation(
  splits: Array<{ number: number; paceSeconds: number }>,
  currentPaceSecondsPerKm: number,
  targetPaceSecondsPerKm: number | null,
  elapsedSeconds: number,
  targetDistanceMeters: number | null,
  distanceMeters: number,
  experienceLevel?: string
): MotivationState {
  const recentPaceTrend = calculatePaceTrend(splits);
  const energyLevel = classifyEnergy(recentPaceTrend, currentPaceSecondsPerKm, targetPaceSecondsPerKm);
  const isInFinalStretch = isApproachingEnd(distanceMeters, targetDistanceMeters);
  const shouldBoost = energyLevel === 'struggling' || isInFinalStretch;
  const runPhase = classifyRunPhase(distanceMeters, targetDistanceMeters, elapsedSeconds);
  const mindsetMode = selectMindsetMode(runPhase, energyLevel);
  const momentum = detectMomentum(splits);
  const selfTalkCue = generateSelfTalkCue(energyLevel, runPhase, mindsetMode, experienceLevel);
  const approach = buildApproach(energyLevel, runPhase, mindsetMode, momentum, recentPaceTrend, experienceLevel);

  return {
    energyLevel,
    approach,
    shouldBoost,
    recentPaceTrend,
    runPhase,
    mindsetMode,
    momentum,
    selfTalkCue,
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

/**
 * Maps run progress to 6 phases. Uses distance if target exists,
 * falls back to time-based thresholds for open-ended runs.
 */
function classifyRunPhase(
  distanceMeters: number,
  targetDistanceMeters: number | null,
  elapsedSeconds: number
): RunPhase {
  if (targetDistanceMeters && targetDistanceMeters > 0) {
    const progress = distanceMeters / targetDistanceMeters;
    if (progress < 0.10) return 'warmup';
    if (progress < 0.25) return 'settling';
    if (progress < 0.60) return 'mid_grind';
    if (progress < 0.80) return 'pre_wall';
    if (progress < 0.90) return 'wall';
    return 'final_kick';
  }

  // Time-based fallback for runs without distance target
  if (elapsedSeconds < 300) return 'warmup';       // <5 min
  if (elapsedSeconds < 720) return 'settling';      // 5-12 min
  if (elapsedSeconds < 1800) return 'mid_grind';    // 12-30 min
  if (elapsedSeconds < 2700) return 'pre_wall';     // 30-45 min
  if (elapsedSeconds < 3600) return 'wall';         // 45-60 min
  return 'final_kick';                               // 60+ min
}

/**
 * Paper 2 (NYU "How vs Why"): When struggling or in late phases,
 * runners focus on implemental "how" tactics. In early phases or
 * when surging, "why" reflection is more effective.
 */
function selectMindsetMode(runPhase: RunPhase, energyLevel: EnergyLevel): MindsetMode {
  // Struggling always → focus on mechanics
  if (energyLevel === 'struggling') return 'how';

  // Late phases → narrow focus on execution
  if (runPhase === 'wall' || runPhase === 'final_kick') return 'how';

  // Surging → celebrate purpose and meaning
  if (energyLevel === 'surging') return 'why';

  // Early phases → reflect on purpose
  if (runPhase === 'warmup' || runPhase === 'settling') return 'why';

  // Mid-run steady → default to how (stay in flow)
  return 'how';
}

/**
 * Detects pace trajectory transitions across recent splits.
 * Tracks whether the runner is recovering, fading, stable, or breaking through.
 */
function detectMomentum(splits: Array<{ paceSeconds: number }>): Momentum {
  if (splits.length < 3) return 'stable';

  const recent = splits.slice(-5);
  if (recent.length < 3) return 'stable';

  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);

  const firstAvg = firstHalf.reduce((sum, s) => sum + s.paceSeconds, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + s.paceSeconds, 0) / secondHalf.length;

  if (firstAvg === 0) return 'stable';

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  // First half was slowing (positive trend), second half improved (negative change)
  const firstTrend = firstHalf.length >= 2
    ? ((firstHalf[firstHalf.length - 1].paceSeconds - firstHalf[0].paceSeconds) / firstHalf[0].paceSeconds) * 100
    : 0;

  // Recovering: was slowing, now stabilizing or getting faster
  if (firstTrend > 5 && change < -2) return 'recovering';

  // Breakthrough: significantly faster than recent average
  if (change < -8) return 'breakthrough';

  // Fading: getting noticeably slower
  if (change > 5) return 'fading';

  return 'stable';
}

/**
 * Paper 3 (Self-talk): Generates a short, persona-agnostic coaching cue.
 * The Head Coach adapts this to their voice.
 */
function generateSelfTalkCue(
  energyLevel: EnergyLevel,
  runPhase: RunPhase,
  mindsetMode: MindsetMode,
  experienceLevel?: string
): string {
  const isNovice = experienceLevel === 'beginner' || experienceLevel === 'novice';

  // Phase-specific cues take priority
  if (runPhase === 'warmup') {
    if (isNovice) return 'You showed up today. That\'s the hardest part.';
    return 'Easy start. Let your body warm up.';
  }

  if (runPhase === 'final_kick') {
    if (energyLevel === 'struggling') return 'Almost there. One step at a time. You\'ve got this.';
    if (energyLevel === 'surging') return 'Bring it home! This is your moment.';
    return 'The finish is right there. Enjoy this.';
  }

  if (runPhase === 'wall') {
    return 'Relax your shoulders. Unclench your hands. Breathe.';
  }

  // Mindset-driven cues
  if (mindsetMode === 'how') {
    if (energyLevel === 'struggling') return 'Focus on your next 100 steps. Just count them.';
    return 'Smooth rhythm. Light feet. Steady breathing.';
  }

  // mindsetMode === 'why'
  if (energyLevel === 'surging') return 'This is exactly why you train.';
  if (isNovice) return 'Every step is making you stronger.';
  return 'Remember why you started. You chose this.';
}

/**
 * Generates multi-layered approach text incorporating phase, mindset,
 * momentum, and experience level. Replaces the old static approach strings.
 */
function buildApproach(
  energy: EnergyLevel,
  phase: RunPhase,
  mindset: MindsetMode,
  momentum: Momentum,
  paceTrend: number,
  experienceLevel?: string
): string {
  const parts: string[] = [];

  // Phase context
  const phaseLabels: Record<RunPhase, string> = {
    warmup: 'Warming up',
    settling: 'Settling into rhythm',
    mid_grind: 'Mid-run',
    pre_wall: 'Approaching the hard stretch',
    wall: 'Wall phase',
    final_kick: 'Final stretch',
  };
  parts.push(`${phaseLabels[phase]}.`);

  // Mindset guidance
  if (mindset === 'how') {
    parts.push('Focus on HOW — breathing, form, counting steps, micro-goals.');
  } else {
    parts.push('Reflect on WHY — purpose, meaning, what this run represents.');
  }

  // Energy-specific guidance
  switch (energy) {
    case 'struggling':
      if (phase === 'warmup' || phase === 'settling') {
        parts.push('Early struggle — suggest settling into a comfortable rhythm, no judgment.');
      } else if (phase === 'wall') {
        parts.push('Hitting the wall — empathize, offer concrete body-focus cues (relax shoulders, shorten stride).');
      } else if (phase === 'final_kick') {
        parts.push('Dig deep — the finish line is close. Acknowledge the effort, one last push.');
      } else {
        parts.push('Mid-run struggle — empathize, suggest mental reset, remind them it\'s temporary.');
      }
      break;
    case 'surging':
      if (phase === 'final_kick') {
        parts.push('Finishing strong — celebrate the kick and fuel the final surge.');
      } else {
        parts.push('In the zone — keep energy high, don\'t distract from flow state.');
      }
      break;
    case 'steady':
      if (phase === 'final_kick') {
        parts.push('Steady into the finish — remind them how far they\'ve come, build excitement.');
      } else if (Math.abs(paceTrend) < 2) {
        parts.push('Locked in — steady rhythm. Good time for stories or observations.');
      } else {
        parts.push('Maintaining well — gentle encouragement.');
      }
      break;
  }

  // Momentum context
  switch (momentum) {
    case 'recovering':
      parts.push('Runner is recovering from a fade — acknowledge the comeback.');
      break;
    case 'fading':
      parts.push('Runner is fading — intervene with concrete tactics before it worsens.');
      break;
    case 'breakthrough':
      parts.push('Runner is breaking through — celebrate but don\'t over-hype.');
      break;
    // 'stable' — no extra note needed
  }

  // Experience-adaptive layer
  const isNovice = experienceLevel === 'beginner' || experienceLevel === 'novice';
  const isExperienced = experienceLevel === 'advanced' || experienceLevel === 'experienced';
  if (isNovice && energy === 'struggling') {
    parts.push('Novice runner: emphasize self-proof and personal achievement.');
  } else if (isExperienced && (phase === 'wall' || phase === 'pre_wall')) {
    parts.push('Experienced runner: connect effort to identity and long-term goals.');
  }

  return parts.join(' ');
}
