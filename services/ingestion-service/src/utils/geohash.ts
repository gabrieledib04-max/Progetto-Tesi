const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes latitude & longitude into a standard Geohash string
 */
export function encodeGeohash(lat: number, lon: number, precision = 5): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let bits = 0;
  let ch = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch |= 1 << (4 - bits);
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bits);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bits < 4) {
      bits++;
    } else {
      geohash += BASE32[ch];
      bits = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Normalizes radius into discrete buckets: 10, 25, 50, 100, 200 km
 * as required by EventSpot_TRD.md Section 6 to maximize cache hit ratio.
 */
export function bucketRadius(radiusKm: number): number {
  if (radiusKm <= 10) return 10;
  if (radiusKm <= 25) return 25;
  if (radiusKm <= 50) return 50;
  if (radiusKm <= 100) return 100;
  return 200;
}
