import { createClient } from '@/lib/supabase/client';

interface JoinParams {
  userId: string;
  runId?: string | null;
  displayName: string;
  city: string;
}

/**
 * Insert a row into the `active_runners` table when a run starts.
 * Returns the row ID for later heartbeat/leave calls, or null on failure.
 */
export async function joinActiveRunners(params: JoinParams): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('active_runners')
      .insert({
        user_id: params.userId,
        run_id: params.runId ?? null,
        display_name: params.displayName,
        city: params.city,
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        current_distance_meters: 0,
        current_pace_seconds_per_km: null,
        is_synthetic: false,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[ActiveRunners] Failed to join:', error.message);
      return null;
    }
    console.warn('[ActiveRunners] Joined with id:', data.id);
    return data.id;
  } catch (e) {
    console.warn('[ActiveRunners] Failed to join (network):', e);
    return null;
  }
}

/**
 * Update the heartbeat timestamp and current stats for an active runner.
 * Called every 30 seconds during a run.
 */
export async function heartbeatActiveRunner(
  activeRunnerId: string,
  stats?: { distanceMeters?: number; currentPaceSecondsPerKm?: number }
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from('active_runners')
      .update({
        last_heartbeat: new Date().toISOString(),
        ...(stats?.distanceMeters !== undefined && { current_distance_meters: stats.distanceMeters }),
        ...(stats?.currentPaceSecondsPerKm !== undefined && { current_pace_seconds_per_km: stats.currentPaceSecondsPerKm }),
      })
      .eq('id', activeRunnerId);
  } catch {
    // Non-critical — heartbeat failure just means stale cleanup will eventually remove the row
  }
}

/**
 * Remove the active runner row when the run ends or the component unmounts.
 */
export async function leaveActiveRunners(activeRunnerId: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from('active_runners')
      .delete()
      .eq('id', activeRunnerId);
    console.warn('[ActiveRunners] Left, deleted row:', activeRunnerId);
  } catch {
    // Non-critical — cleanup function will remove stale rows after 5 minutes
  }
}
