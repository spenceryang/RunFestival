import { createClient } from '@/lib/supabase/client';
import type { GpsPoint, Split } from '@/types/run';

interface CreateRunParams {
  userId: string;
  targetDistanceMeters: number | null;
  targetPaceSecondsPerKm: number | null;
  persona: string;
}

export interface CompleteRunParams {
  runId: string;
  distanceMeters: number;
  elapsedSeconds: number;
  averagePaceSecondsPerKm: number;
  splits: Split[];
  gpsPoints: GpsPoint[];
  coachingMessages: Array<{ triggerType: string; text: string; timestamp: number }>;
  aiSummary?: string;
  collectiveCount?: number;
}

/**
 * Creates an 'active' run record in Supabase when the user starts a run.
 * Returns the run ID or null if the insert fails (e.g., offline).
 */
export async function createRunRecord(params: CreateRunParams): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('runs')
      .insert({
        user_id: params.userId,
        started_at: new Date().toISOString(),
        status: 'active',
        target_distance_meters: params.targetDistanceMeters,
        target_pace_seconds_per_km: params.targetPaceSecondsPerKm,
        persona_used: params.persona,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[RunPersistence] Failed to create run record:', error.message);
      return null;
    }
    console.warn('[RunPersistence] Created run record:', data.id);
    return data.id;
  } catch {
    console.warn('Failed to create run record: network error');
    return null;
  }
}

/**
 * Updates a run record with final data when the run is completed.
 * Also generates route_geojson from GPS points for easy visualization.
 */
export async function completeRunRecord(params: CompleteRunParams): Promise<boolean> {
  try {
    const supabase = createClient();
    const routeGeojson = buildRouteGeoJson(params.gpsPoints);
    const { error } = await supabase
      .from('runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        distance_meters: params.distanceMeters,
        elapsed_seconds: params.elapsedSeconds,
        average_pace_seconds_per_km: params.averagePaceSecondsPerKm,
        splits: params.splits,
        gps_points: params.gpsPoints,
        route_geojson: routeGeojson,
        coaching_messages: params.coachingMessages,
        ai_summary: params.aiSummary ?? null,
        collective_count: params.collectiveCount ?? null,
      })
      .eq('id', params.runId);

    if (error) {
      console.warn('[RunPersistence] Failed to complete run record:', error.message);
      return false;
    }
    console.warn('[RunPersistence] Completed run record:', params.runId);
    return true;
  } catch {
    console.warn('[RunPersistence] Failed to complete run record: network error');
    return false;
  }
}

/**
 * Updates just the AI summary on a completed run (called from recap page).
 */
export async function updateRunAiSummary(runId: string, aiSummary: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from('runs')
      .update({ ai_summary: aiSummary })
      .eq('id', runId);
  } catch {
    console.warn('Failed to update AI summary — non-critical');
  }
}

/**
 * Builds a GeoJSON LineString from GPS points.
 * Uses [lng, lat] coordinate order per GeoJSON spec.
 */
function buildRouteGeoJson(gpsPoints: GpsPoint[]): object | null {
  if (gpsPoints.length < 2) return null;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: gpsPoints.map((p) => [p.lng, p.lat, p.altitude ?? 0]),
    },
    properties: {
      pointCount: gpsPoints.length,
    },
  };
}
