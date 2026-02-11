/**
 * Haversine formula to calculate distance between two GPS coordinates.
 * Returns distance in meters.
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate total distance from an array of GPS points.
 * Filters out points with poor accuracy (> 30m).
 */
export function calculateTotalDistance(
  points: Array<{ lat: number; lng: number; accuracy: number }>
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].accuracy <= 30 && points[i - 1].accuracy <= 30) {
      total += haversine(
        points[i - 1].lat,
        points[i - 1].lng,
        points[i].lat,
        points[i].lng
      );
    }
  }
  return total;
}
