import type { GpsPoint } from '@/types/run';
import { haversine } from './distance';

const ROLLING_WINDOW_MS = 30_000; // 30-second rolling window

/**
 * Calculate current pace using a 30-second rolling window.
 * Returns pace in seconds per kilometer.
 * Returns 0 if insufficient data.
 */
export function calculateCurrentPace(points: GpsPoint[]): number {
  if (points.length < 2) return 0;

  const now = points[points.length - 1].timestamp;
  const windowStart = now - ROLLING_WINDOW_MS;

  // Find points within the rolling window
  const windowPoints = points.filter(
    (p) => p.timestamp >= windowStart && p.accuracy <= 30
  );

  if (windowPoints.length < 2) return 0;

  // Calculate distance covered in the window
  let windowDistance = 0;
  for (let i = 1; i < windowPoints.length; i++) {
    windowDistance += haversine(
      windowPoints[i - 1].lat,
      windowPoints[i - 1].lng,
      windowPoints[i].lat,
      windowPoints[i].lng
    );
  }

  if (windowDistance < 1) return 0; // Less than 1 meter, unreliable

  const windowTime =
    (windowPoints[windowPoints.length - 1].timestamp -
      windowPoints[0].timestamp) /
    1000;

  if (windowTime < 1) return 0;

  // Convert to seconds per kilometer
  return (windowTime / windowDistance) * 1000;
}

/**
 * Calculate average pace for the entire run.
 * Returns pace in seconds per kilometer.
 */
export function calculateAveragePace(
  distanceMeters: number,
  elapsedSeconds: number
): number {
  if (distanceMeters < 1 || elapsedSeconds < 1) return 0;
  return (elapsedSeconds / distanceMeters) * 1000;
}

/**
 * Format pace in seconds per km to "M:SS" string.
 */
export function formatPace(
  secondsPerKm: number,
  unit: 'km' | 'mi' = 'km'
): string {
  if (secondsPerKm <= 0 || !isFinite(secondsPerKm)) return '--:--';

  let seconds = secondsPerKm;
  if (unit === 'mi') {
    seconds = secondsPerKm * 1.60934; // Convert to seconds per mile
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format elapsed time in seconds to "H:MM:SS" or "MM:SS" string.
 */
export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Format distance in meters to display string.
 */
export function formatDistance(
  meters: number,
  unit: 'km' | 'mi' = 'km'
): string {
  if (unit === 'mi') {
    const miles = meters / 1609.34;
    return miles < 10 ? miles.toFixed(2) : miles.toFixed(1);
  }
  const km = meters / 1000;
  return km < 10 ? km.toFixed(2) : km.toFixed(1);
}
