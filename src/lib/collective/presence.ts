import { createClient } from '@/lib/supabase/client';
import { useCollectiveStore } from '@/lib/store/collective-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

let channel: RealtimeChannel | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

interface PresencePayload {
  user_id: string;
  display_name: string;
  city: string;
  started_at: string;
  distance_meters: number;
  current_pace: number;
}

/**
 * Join the runners presence channel.
 * Tracks this runner and listens for others.
 */
export function joinPresence(runner: {
  userId: string;
  displayName: string;
  city: string;
}): void {
  const supabase = createClient();

  channel = supabase.channel('runners', {
    config: { presence: { key: runner.userId } },
  });

  // Listen for presence changes (runner count)
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel!.presenceState();
    const runnerCount = Object.keys(state).length;
    useCollectiveStore.getState().setRunnerCount(runnerCount);
  });

  // Listen for broadcast events (milestones)
  channel.on('broadcast', { event: 'milestone' }, ({ payload }) => {
    useCollectiveStore.getState().addEvent({
      type: 'milestone',
      text: payload.text || `${payload.user} in ${payload.city}: ${payload.achievement}`,
      timestamp: Date.now(),
    });
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel!.track({
        user_id: runner.userId,
        display_name: runner.displayName,
        city: runner.city,
        started_at: new Date().toISOString(),
        distance_meters: 0,
        current_pace: 0,
      } satisfies PresencePayload);
    }
  });
}

/**
 * Start sending heartbeat updates every 30 seconds.
 */
export function startHeartbeat(
  getState: () => { distanceMeters: number; currentPaceSecondsPerKm: number }
): void {
  heartbeatInterval = setInterval(async () => {
    if (!channel) return;
    const state = getState();
    await channel.track({
      distance_meters: state.distanceMeters,
      current_pace: state.currentPaceSecondsPerKm,
    });
  }, 30_000);
}

/**
 * Broadcast a milestone event to all runners.
 */
export function broadcastMilestone(
  displayName: string,
  city: string,
  achievement: string
): void {
  if (!channel) return;
  channel.send({
    type: 'broadcast',
    event: 'milestone',
    payload: {
      user: displayName,
      city,
      achievement,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Leave the presence channel and stop heartbeat.
 */
export function leavePresence(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }
}
