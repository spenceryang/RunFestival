import type { CoachingPersona } from '@/types/run';
import type { TriggerType, CoachingContext } from '@/types/coach';
import type { CollectiveState } from '@/types/collective';
import { formatPace } from '@/lib/gps/pace';

interface RunSnapshot {
  distanceMeters: number;
  elapsedSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  splits: Array<{ number: number; paceSeconds: number }>;
  isPaused: boolean;
}

interface UserProfile {
  name: string;
  city: string;
  experienceLevel: string;
  storyTopics: string[];
}

export function buildCoachingContext(
  persona: CoachingPersona,
  triggerType: TriggerType,
  runState: RunSnapshot,
  profile: UserProfile,
  collective: CollectiveState
): CoachingContext {
  return {
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
      recentRunsSummary: '', // TODO: pull from run history
    },
    collective: {
      runnerCount: collective.runnerCount,
      recentEvents: collective.recentEvents.map((e) => ({
        type: e.type,
        text: e.text,
      })),
      averagePaceFormatted: formatPace(collective.averagePaceSecondsPerKm),
    },
  };
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
