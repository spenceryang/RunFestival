import { createClient } from '@/lib/supabase/client';
import { useCollectiveStore } from '@/lib/store/collective-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

let cityChannel: RealtimeChannel | null = null;
let globalChannel: RealtimeChannel | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// Backwards compatibility alias
let channel: RealtimeChannel | null = null;

interface PresencePayload {
  user_id: string;
  display_name: string;
  city: string;
  started_at: string;
  distance_meters: number;
  current_pace: number;
}

/**
 * Normalize city name to a channel-safe slug.
 * "San Francisco" → "san-francisco"
 */
function cityToChannelSlug(city: string): string {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'global';
}

/**
 * Join presence channels — both city-specific and global.
 *
 * Phase 6 scaling strategy:
 * - Each city gets its own Realtime channel (`runners:sf`, `runners:nyc`)
 * - A global channel (`runners:global`) receives aggregated stats from
 *   the aggregate-stats Edge Function every 30 seconds
 * - This avoids the 100-user presence limit per channel
 */
export function joinPresence(runner: {
  userId: string;
  displayName: string;
  city: string;
}): void {
  const supabase = createClient();
  const citySlug = cityToChannelSlug(runner.city);

  // City-specific channel for nearby runners
  cityChannel = supabase.channel(`runners:${citySlug}`, {
    config: { presence: { key: runner.userId } },
  });

  // Backwards compat
  channel = cityChannel;

  // Listen for city-level presence changes
  cityChannel.on('presence', { event: 'sync' }, () => {
    const state = cityChannel!.presenceState();
    const cityCount = Object.keys(state).length;
    console.warn('[Presence] sync — city count:', cityCount, 'keys:', Object.keys(state));
    // City count is a minimum — global stats add to this
    const store = useCollectiveStore.getState();
    const globalTotal = store.runnerCount;
    // Use whichever is larger (global may not have updated yet)
    // Ensure at least 1 (the current runner) when we're subscribed
    useCollectiveStore.getState().setRunnerCount(Math.max(cityCount, globalTotal, 1));
  });

  // Also listen for join events to catch when we join
  cityChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
    console.warn('[Presence] join event:', newPresences?.length, 'new presences');
    const state = cityChannel!.presenceState();
    const cityCount = Object.keys(state).length;
    const store = useCollectiveStore.getState();
    useCollectiveStore.getState().setRunnerCount(Math.max(cityCount, store.runnerCount, 1));
  });

  // Listen for broadcast events (milestones)
  cityChannel.on('broadcast', { event: 'milestone' }, ({ payload }) => {
    useCollectiveStore.getState().addEvent({
      type: 'milestone',
      text: payload.text || `${payload.user} in ${payload.city}: ${payload.achievement}`,
      timestamp: Date.now(),
    });
  });

  cityChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.warn('[Presence] Subscribed to city channel:', citySlug);
      // Immediately set runner count to at least 1 (ourselves)
      const store = useCollectiveStore.getState();
      if (store.runnerCount === 0) {
        store.setRunnerCount(1);
      }
      await cityChannel!.track({
        user_id: runner.userId,
        display_name: runner.displayName,
        city: runner.city,
        started_at: new Date().toISOString(),
        distance_meters: 0,
        current_pace: 0,
      } satisfies PresencePayload);
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('[Presence] Channel error — setting fallback runner count');
      // If Supabase Realtime fails, still show at least 1 runner (ourselves)
      useCollectiveStore.getState().setRunnerCount(1);
    }
  });

  // Global stats channel — receives aggregated data from Edge Function
  globalChannel = supabase.channel('runners:global');

  globalChannel.on('broadcast', { event: 'global_stats' }, ({ payload }) => {
    if (payload.totalRunners) {
      useCollectiveStore.getState().setRunnerCount(payload.totalRunners);
    }
    if (payload.recentEvents) {
      for (const evt of payload.recentEvents) {
        useCollectiveStore.getState().addEvent({
          type: 'collective_stat',
          text: evt.description || evt.title,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Race Director events
  globalChannel.on('broadcast', { event: 'race_director' }, ({ payload }) => {
    useCollectiveStore.getState().addEvent({
      type: 'hype_moment',
      text: payload.description || payload.title,
      timestamp: Date.now(),
    });
  });

  globalChannel.subscribe();
}

/**
 * Start sending heartbeat updates every 30 seconds.
 */
export function startHeartbeat(
  getState: () => { distanceMeters: number; currentPaceSecondsPerKm: number }
): void {
  heartbeatInterval = setInterval(async () => {
    if (!cityChannel) return;
    const state = getState();
    await cityChannel.track({
      distance_meters: state.distanceMeters,
      current_pace: state.currentPaceSecondsPerKm,
    });
  }, 30_000);
}

/**
 * Broadcast a milestone event to all runners in the city channel.
 */
export function broadcastMilestone(
  displayName: string,
  city: string,
  achievement: string
): void {
  if (!cityChannel) return;
  cityChannel.send({
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
 * Leave all presence channels and stop heartbeat.
 */
export function leavePresence(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (cityChannel) {
    cityChannel.unsubscribe();
    cityChannel = null;
  }
  if (globalChannel) {
    globalChannel.unsubscribe();
    globalChannel = null;
  }
  channel = null;
}
