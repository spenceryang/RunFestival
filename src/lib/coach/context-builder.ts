import type { CoachingPersona } from '@/types/run';
import type { TriggerType, CoachingContext } from '@/types/coach';
import type { CollectiveState } from '@/types/collective';
import { formatPace } from '@/lib/gps/pace';
import { analyzePace } from '@/lib/agents/pace-strategist';
import { assessMotivation } from '@/lib/agents/motivation-engine';
import type { StoryPlan } from '@/lib/agents/story-curator';

interface RunSnapshot {
  distanceMeters: number;
  elapsedSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  splits: Array<{ number: number; paceSeconds: number; distanceMeters?: number; elapsedSeconds?: number }>;
  isPaused: boolean;
}

interface UserProfile {
  name: string;
  city: string;
  experienceLevel: string;
  storyTopics: string[];
}

export interface CoachingHistory {
  recentMessages: Array<{
    triggerType: TriggerType;
    summary: string;
    topics: string[];
  }>;
  topicsCovered: string[];
  lastCliffhanger: string | null;
}

export function buildCoachingContext(
  persona: CoachingPersona,
  triggerType: TriggerType,
  runState: RunSnapshot,
  profile: UserProfile,
  collective: CollectiveState,
  history?: CoachingHistory,
  storyPlan?: StoryPlan | null,
  qualityFeedback?: string | null
): CoachingContext {
  // Run specialist agents (zero-cost, rule-based)
  const paceAnalysis = analyzePace(
    runState.splits.map((s) => ({
      number: s.number,
      paceSeconds: s.paceSeconds,
      distanceMeters: s.distanceMeters ?? 1000,
      elapsedSeconds: s.elapsedSeconds ?? 0,
    })),
    runState.distanceMeters,
    runState.elapsedSeconds,
    runState.targetDistanceMeters,
    runState.targetPaceSecondsPerKm
  );

  const motivationState = assessMotivation(
    runState.splits,
    runState.currentPaceSecondsPerKm,
    runState.targetPaceSecondsPerKm,
    runState.elapsedSeconds,
    runState.targetDistanceMeters,
    runState.distanceMeters,
    profile.experienceLevel
  );

  const context: CoachingContext = {
    persona,
    trigger: {
      type: triggerType,
      data: buildTriggerData(triggerType, runState),
    },
    runState: {
      distanceMeters: runState.distanceMeters,
      elapsedSeconds: runState.elapsedSeconds,
      currentPaceSecondsPerKm: runState.currentPaceSecondsPerKm,
      averagePaceSecondsPerKm: runState.averagePaceSecondsPerKm,
      targetPaceSecondsPerKm: runState.targetPaceSecondsPerKm,
      targetDistanceMeters: runState.targetDistanceMeters,
      splits: runState.splits.map((s) => ({
        number: s.number,
        paceSeconds: s.paceSeconds,
      })),
      isPaused: runState.isPaused,
    },
    profile: {
      name: profile.name,
      city: profile.city,
      experienceLevel: profile.experienceLevel,
      storyTopics: profile.storyTopics,
      recentRunsSummary: '',
    },
    collective: {
      runnerCount: collective.runnerCount,
      recentEvents: collective.recentEvents.map((e) => ({
        type: e.type,
        text: e.text,
      })),
      averagePaceFormatted: formatPace(collective.averagePaceSecondsPerKm),
    },
    paceAnalysis,
    motivationState,
  };

  // Attach story plan if available (from async Story Curator)
  if (storyPlan && triggerType === 'idle_storytelling') {
    context.storyPlan = storyPlan;
  }

  // Attach quality feedback if available
  if (qualityFeedback) {
    context.qualityFeedback = qualityFeedback;
  }

  if (history && history.recentMessages.length > 0) {
    context.conversationHistory = history;
  }

  return context;
}

function buildTriggerData(
  type: TriggerType,
  runState: RunSnapshot
): Record<string, unknown> {
  switch (type) {
    case 'split_complete': {
      const lastSplit = runState.splits[runState.splits.length - 1];
      return {
        splitNumber: lastSplit?.number ?? 0,
        splitPaceSeconds: lastSplit?.paceSeconds ?? 0,
        splitPaceFormatted: formatPace(lastSplit?.paceSeconds ?? 0),
      };
    }
    case 'pace_drift':
      return {
        currentPace: formatPace(runState.currentPaceSecondsPerKm),
        targetPace: formatPace(runState.targetPaceSecondsPerKm ?? 0),
        driftPercent: runState.targetPaceSecondsPerKm
          ? Math.round(
              (Math.abs(
                runState.currentPaceSecondsPerKm -
                  runState.targetPaceSecondsPerKm
              ) /
                runState.targetPaceSecondsPerKm) *
                100
            )
          : 0,
      };
    case 'halfway':
      return {
        firstHalfSeconds: runState.elapsedSeconds,
        projectedFinish: runState.elapsedSeconds * 2,
      };
    case 'final_push':
      return {
        remainingMeters: runState.targetDistanceMeters
          ? runState.targetDistanceMeters - runState.distanceMeters
          : 0,
      };
    case 'idle_storytelling':
      return {};
    case 'user_initiated':
      return {};
    default:
      return {};
  }
}
