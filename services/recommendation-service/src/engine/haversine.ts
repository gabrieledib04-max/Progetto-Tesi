/**
 * Haversine formula to compute great-circle distance between two points in km
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

/**
 * Computes normalized spatial decay: max(0, 1 - distance / maxRadius)
 */
export function computeSpatialDecay(distanceKm: number, maxRadiusKm: number): number {
  if (maxRadiusKm <= 0) return 0;
  const decay = 1 - distanceKm / maxRadiusKm;
  return Math.max(0, Math.min(1, Math.round(decay * 1000) / 1000));
}
