import type { RunStatus } from '@/types/run';
import type { CoachingTrigger, TriggerType } from '@/types/coach';

interface RunSnapshot {
  status: RunStatus;
  distanceMeters: number;
  elapsedSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  targetPaceSecondsPerKm: number | null;
  targetDistanceMeters: number | null;
  currentSplit: number;
  splits: Array<{ number: number; paceSeconds: number }>;
}

const MIN_INTERVAL_MS = 45_000; // 45s minimum between coaching messages
const IDLE_THRESHOLD_MS = 180_000; // 3 minutes
const PACE_DRIFT_THRESHOLD = 0.15; // 15%
const PACE_DRIFT_DURATION_MS = 60_000; // 60 seconds
const FINAL_PUSH_FRACTION = 0.9; // Last 10%

export class CoachingTriggerEngine {
  private lastCoachMessage = 0;
  private paceDriftStart: number | null = null;

  evaluate(
    current: RunSnapshot,
    previous: RunSnapshot | null
  ): CoachingTrigger | null {
    if (current.status !== 'running') return null;

    const now = Date.now();
    if (now - this.lastCoachMessage < MIN_INTERVAL_MS) return null;

    // Priority 1: Split complete
    if (previous && current.currentSplit > previous.currentSplit) {
      return this.fire('split_complete', current, now);
    }

    // Priority 2: Pace drift
    if (current.targetPaceSecondsPerKm && current.currentPaceSecondsPerKm > 0) {
      const drift =
        Math.abs(
          current.currentPaceSecondsPerKm - current.targetPaceSecondsPerKm
        ) / current.targetPaceSecondsPerKm;

      if (drift > PACE_DRIFT_THRESHOLD) {
        if (!this.paceDriftStart) {
          this.paceDriftStart = now;
        } else if (now - this.paceDriftStart > PACE_DRIFT_DURATION_MS) {
          this.paceDriftStart = null;
          return this.fire('pace_drift', current, now);
        }
      } else {
        this.paceDriftStart = null;
      }
    }

    // Priority 3: Halfway
    if (current.targetDistanceMeters) {
      const halfwayPoint = current.targetDistanceMeters / 2;
      const justPassedHalfway =
        previous &&
        previous.distanceMeters < halfwayPoint &&
        current.distanceMeters >= halfwayPoint;
      if (justPassedHalfway) {
        return this.fire('halfway', current, now);
      }
    }

    // Priority 4: Final push
    if (current.targetDistanceMeters) {
      const finalPushStart =
        current.targetDistanceMeters * FINAL_PUSH_FRACTION;
      const justEnteredFinalPush =
        previous &&
        previous.distanceMeters < finalPushStart &&
        current.distanceMeters >= finalPushStart;
      if (justEnteredFinalPush) {
        return this.fire('final_push', current, now);
      }
    }

    // Priority 5: Idle — no coaching for 3+ minutes
    if (
      this.lastCoachMessage > 0 &&
      now - this.lastCoachMessage > IDLE_THRESHOLD_MS
    ) {
      return this.fire('idle_storytelling', current, now);
    }

    // First message after 30 seconds of running
    if (
      this.lastCoachMessage === 0 &&
      current.elapsedSeconds > 30
    ) {
      return this.fire('idle_storytelling', current, now);
    }

    return null;
  }

  triggerUserInitiated(current: RunSnapshot): CoachingTrigger {
    this.lastCoachMessage = Date.now();
    return {
      type: 'user_initiated',
      data: current as never,
    };
  }

  recordCoachMessage(): void {
    this.lastCoachMessage = Date.now();
  }

  reset(): void {
    this.lastCoachMessage = 0;
    this.paceDriftStart = null;
  }

  private fire(
    type: TriggerType,
    snapshot: RunSnapshot,
    now: number
  ): CoachingTrigger {
    this.lastCoachMessage = now;
    return { type, data: snapshot as never };
  }
}
