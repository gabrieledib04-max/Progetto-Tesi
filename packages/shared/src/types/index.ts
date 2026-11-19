/**
 * EventSpot - Shared Domain Types
 * Single Source of Truth based on EventSpot_PRD.md and EventSpot_TRD.md
 */

export interface VenueInfo {
  name: string;
  city: string;
  address?: string;
  country: string;
  lat: number;
  lon: number;
  isOutdoor: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface NormalizedEvent {
  id: string;
  name: string;
  artistNames: string[];
  genres: string[];
  startDateTime: string; // ISO-8601
  venue: VenueInfo;
  priceRange?: PriceRange;
  priceStatus: 'AVAILABLE' | 'UNAVAILABLE';
  ticketUrl: string;
  imageUrl: string;
}

export interface SessionTag {
  name: string;
  weight: number; // Exponential decay weight based on recency
}

export interface TimeSlot {
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  hourOfDay: number; // 0 to 23
  isWeekend: boolean;
  isEvening: boolean;
}

export interface WeatherCondition {
  wmoCode: number;
  precipMm: number;
  tempC: number;
  isAdverse: boolean;
  isAvailable: boolean;
}

export interface ContextVector {
  sessionTags: SessionTag[];
  sessionArtists: string[];
  isSessionEmpty: boolean;
  timeSlot: TimeSlot;
  userLocation: {
    lat: number;
    lon: number;
  };
  weather: WeatherCondition;
  maxPrice?: number;
  includeUnpriced: boolean;
}

export interface SubScores {
  semanticSim: number;
  timeCongruence: number;
  spatialDecay: number;
  weatherCompatibility: number;
}

export interface ScoredEvent {
  event: NormalizedEvent;
  score: number; // 0.0 - 100.0
  subScores: SubScores;
  reasons: string[];
  naturalLanguageReason: string;
  distanceKm: number;
  scoringMode: 'context_driven' | 'spatio_temporal_fallback';
}

export interface MatchesResponseMeta {
  totalMatches: number;
  responseTimeMs: number;
  scoringMode: 'context_driven' | 'spatio_temporal_fallback';
  isEventsCacheStale: boolean;
  searchContext: {
    lat: number;
    lon: number;
    radiusKm: number;
    dateFrom: string;
    dateTo: string;
    maxPrice?: number;
  };
}

export interface MatchesResponse {
  success: boolean;
  meta: MatchesResponseMeta;
  contextSummary: {
    sessionTags: SessionTag[];
    weather: {
      tempC: number;
      isAdverse: boolean;
      description: string;
    };
    timeSlot: TimeSlot;
  };
  matches: ScoredEvent[];
}

export interface RFC9457Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errorCode: string;
  instance?: string;
  correlationId?: string;
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
}

export interface FavoriteSnapshot {
  eventId: string;
  name: string;
  artistNames: string[];
  venue: string;
  city: string;
  startDateTime: string;
  priceRange?: PriceRange;
  ticketUrl: string;
  imageUrl: string;
  savedAt: string;
}
