import {
  ContextVector,
  NormalizedEvent,
  ScoredEvent,
  SubScores,
} from '@eventspot/shared';
import { calculateHaversineDistance, computeSpatialDecay } from './haversine.js';
import { computeSemanticSimilarity } from './semantic.js';
import { computeTemporalCongruence } from './temporal.js';
import { computeWeatherCompatibility } from './weather.js';
import { generateExplanation } from './explainability.js';
import { config } from '../config.js';

export interface RankResult {
  scoringMode: 'context_driven' | 'spatio_temporal_fallback';
  matches: ScoredEvent[];
}

export class ScoringEngine {
  /**
   * Applies Context-Driven deterministic ranking and white-box explainability
   * (EventSpot_TRD.md Section 3; Pagano et al., 2016)
   */
  rankEvents(
    context: ContextVector,
    events: NormalizedEvent[],
    sortBy: 'relevance' | 'date' | 'distance' | 'price' = 'relevance'
  ): RankResult {
    // 1. Budget & Price Filtering (FR-07)
    const filteredEvents = this.filterByPrice(events, context.maxPrice, context.includeUnpriced);

    // 2. Resolve & Renormalize Scoring Weights
    const { weights, scoringMode } = this.resolveWeights(context);

    // 3. Compute Sub-scores & Final Weighted Score
    const scoredList: ScoredEvent[] = filteredEvents.map((event) => {
      const distanceKm = calculateHaversineDistance(
        context.userLocation.lat,
        context.userLocation.lon,
        event.venue.lat,
        event.venue.lon
      );

      // Semantic Similarity
      const semanticSim = context.isSessionEmpty
        ? 0.0
        : computeSemanticSimilarity(
            context.sessionTags,
            context.sessionArtists,
            event.genres,
            event.artistNames
          );

      // Temporal Congruence
      const timeCongruence = computeTemporalCongruence(context.timeSlot, event.startDateTime);

      // Spatial Decay (default reference radius 50km)
      const spatialDecay = computeSpatialDecay(distanceKm, 50);

      // Weather Compatibility
      const weatherCompatibility = computeWeatherCompatibility(
        context.weather,
        event.venue.isOutdoor
      );

      const subScores: SubScores = {
        semanticSim,
        timeCongruence,
        spatialDecay,
        weatherCompatibility,
      };

      // Weighted combination
      const scoreRaw =
        weights.w1 * semanticSim +
        weights.w2 * timeCongruence +
        weights.w3 * spatialDecay +
        weights.w4 * weatherCompatibility;

      const score = Math.min(100, Math.max(0, Math.round(scoreRaw * 1000) / 10)); // e.g. 87.5

      // White-box explainability
      const { reasons, naturalLanguageReason } = generateExplanation(
        event,
        context,
        subScores,
        distanceKm
      );

      return {
        event,
        score,
        subScores,
        reasons,
        naturalLanguageReason,
        distanceKm,
        scoringMode,
      };
    });

    // 4. Sort according to requested criterion
    const sorted = this.sortMatches(scoredList, sortBy);

    return {
      scoringMode,
      matches: sorted,
    };
  }

  /**
   * Resolves weights and renormalizes if weather is unavailable or session is empty (FR-06, NFR-R5)
   */
  private resolveWeights(context: ContextVector): {
    weights: { w1: number; w2: number; w3: number; w4: number };
    scoringMode: 'context_driven' | 'spatio_temporal_fallback';
  } {
    let w1 = 0;
    let w2 = 0;
    let w3 = 0;
    let w4 = 0;
    let scoringMode: 'context_driven' | 'spatio_temporal_fallback';

    if (context.isSessionEmpty) {
      // Fallback Mode (Missing Context)
      scoringMode = 'spatio_temporal_fallback';
      w1 = 0;
      w2 = config.fallbackWeights.time;
      w3 = config.fallbackWeights.spatial;
      w4 = context.weather.isAvailable ? config.fallbackWeights.weather : 0;
    } else {
      // Normal Context-Driven Mode
      scoringMode = 'context_driven';
      w1 = config.weights.sessionSemantic;
      w2 = config.weights.timeCongruence;
      w3 = config.weights.spatialDecay;
      w4 = context.weather.isAvailable ? config.weights.weatherCompatibility : 0;
    }

    // Renormalize active weights to sum exactly to 1.0
    const sum = w1 + w2 + w3 + w4;
    if (sum > 0) {
      w1 = w1 / sum;
      w2 = w2 / sum;
      w3 = w3 / sum;
      w4 = w4 / sum;
    }

    return {
      weights: { w1, w2, w3, w4 },
      scoringMode,
    };
  }

  /**
   * Strict budget filtering (FR-07)
   */
  private filterByPrice(
    events: NormalizedEvent[],
    maxPrice?: number,
    includeUnpriced = true
  ): NormalizedEvent[] {
    if (maxPrice === undefined || maxPrice === null) {
      return events;
    }

    return events.filter((e) => {
      if (e.priceRange?.min !== undefined) {
        return e.priceRange.min <= maxPrice;
      }
      // Event has no declared price range
      return includeUnpriced;
    });
  }

  private sortMatches(
    matches: ScoredEvent[],
    sortBy: 'relevance' | 'date' | 'distance' | 'price'
  ): ScoredEvent[] {
    return matches.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(a.event.startDateTime).getTime() - new Date(b.event.startDateTime).getTime();
      }
      if (sortBy === 'distance') {
        return a.distanceKm - b.distanceKm;
      }
      if (sortBy === 'price') {
        const priceA = a.event.priceRange?.min ?? Infinity;
        const priceB = b.event.priceRange?.min ?? Infinity;
        return priceA - priceB;
      }
      // Default: relevance (highest score first)
      return b.score - a.score;
    });
  }
}

export const scoringEngine = new ScoringEngine();
