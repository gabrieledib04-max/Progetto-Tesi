/**
 * EventSpot - Shared Constants
 */

export const DEFAULT_WEIGHTS = {
  // Normal Context-Driven mode
  SESSION_SEMANTIC: 0.40,
  TIME_CONGRUENCE: 0.20,
  SPATIAL_DECAY: 0.30,
  WEATHER_COMPATIBILITY: 0.10,

  // Fallback mode (Missing Context / Empty Session)
  FALLBACK_TIME: 0.30,
  FALLBACK_SPATIAL: 0.55,
  FALLBACK_WEATHER: 0.15,
} as const;

export const SESSION_RECENCY_LAMBDA = 0.15;

export const TTL_SECONDS = {
  AUTH_ATTEMPT: 600,             // 10 minutes
  SESSION: 86400,                // 24 hours of inactivity
  SESSION_CONTEXT_CACHE: 900,    // 15 minutes
  WEATHER_CACHE: 3600,           // 1 hour
  EVENTS_FRESH: 21600,           // 6 hours
  EVENTS_STALE_MAX: 86400,       // 24 hours (stale-if-error)
} as const;

export const STORAGE_KEYS = {
  FAVORITES: 'eventspot_favorites_v1',
} as const;
