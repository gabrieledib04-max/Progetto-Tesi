import { NormalizedEvent, TTL_SECONDS } from '@eventspot/shared';
import { encodeGeohash, bucketRadius } from '../utils/geohash.js';
import { SingleFlight } from '../utils/single-flight.js';
import {
  EventsCacheModel,
  inMemoryIngestionStore,
  isIngestionDbInMemory,
} from '../db/mongodb.js';
import { config } from '../config.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  calculateHaversineKm,
  DEFAULT_CONCERT_IMAGE,
} from '../adapters/event-source.interface.js';
import { ticketmasterAdapter } from '../adapters/ticketmaster.adapter.js';
import { jamBaseAdapter } from '../adapters/jambase.adapter.js';
import { musicBrainzEventsAdapter } from '../adapters/musicbrainz.adapter.js';
import { jsonLdScraperAdapter } from '../adapters/jsonld.adapter.js';
import { organizerEventsAdapter } from '../adapters/organizer.adapter.js';
import { MOCK_NORMALIZED_EVENTS } from '../adapters/mock-data.js';

export interface SearchEventsResult {
  events: NormalizedEvent[];
  isStale: boolean;
  cacheHit: boolean;
  sourcesUsed?: string[];
}

export class EventAggregatorService {
  private singleFlight = new SingleFlight<SearchEventsResult>();
  private adapters: EventSourceAdapter[] = [
    ticketmasterAdapter,
    jamBaseAdapter,
    musicBrainzEventsAdapter,
    jsonLdScraperAdapter,
    organizerEventsAdapter,
  ];

  /**
   * Aggregates normalized live music events across all enabled providers
   * with Cache-Aside, Single-Flight, Stale-if-error & Deterministic Deduplication (FR-13)
   */
  async searchEvents(params: {
    lat: number;
    lon: number;
    radiusKm: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SearchEventsResult> {
    const geohash5 = encodeGeohash(params.lat, params.lon, 5);
    const radiusBucket = bucketRadius(params.radiusKm);
    const dateFrom = params.dateFrom || new Date().toISOString();
    const dateTo = params.dateTo || new Date(Date.now() + 30 * 86400000).toISOString();

    const dateFromDay = dateFrom.split('T')[0];
    const dateToDay = dateTo.split('T')[0];
    const cacheKey = `${geohash5}:${radiusBucket}:${dateFromDay}:${dateToDay}`;

    // 1. Check Cache
    const cached = await this.getCachedEvents(cacheKey);
    const now = Date.now();

    if (cached && now <= new Date(cached.freshUntil).getTime()) {
      return {
        events: cached.events,
        isStale: false,
        cacheHit: true,
        sourcesUsed: ['cache'],
      };
    }

    // 2. Single-Flight Multi-Provider Fetch
    return this.singleFlight.do(cacheKey, async () => {
      const query: EventSearchQuery = {
        lat: params.lat,
        lon: params.lon,
        radiusKm: params.radiusKm,
        dateFrom,
        dateTo,
      };

      try {
        const collected: NormalizedEvent[] = [];
        const sourcesUsed: string[] = [];

        if (config.mockExternalProviders) {
          // Include local organizer events even in mock mode
          const orgEvents = await organizerEventsAdapter.fetchEvents(query);
          collected.push(...orgEvents, ...this.filterMockEvents(query));
          sourcesUsed.push('organizer_portal', 'mock');
        } else {
          const enabled = this.adapters.filter((a) => a.isEnabled());
          const settled = await Promise.allSettled(
            enabled.map(async (adapter) => ({
              sourceId: adapter.sourceId,
              events: await adapter.fetchEvents(query),
            }))
          );

          let failedCount = 0;
          for (const outcome of settled) {
            if (outcome.status === 'fulfilled') {
              if (outcome.value.events.length > 0) {
                collected.push(...outcome.value.events);
                sourcesUsed.push(outcome.value.sourceId);
              }
            } else {
              failedCount++;
              console.warn(`[EventAggregator] Adapter failed: ${outcome.reason?.message || outcome.reason}`);
            }
          }

          // If all adapters threw errors and we have stale cache, trigger stale-if-error
          if (failedCount === enabled.length && enabled.length > 0) {
            throw new Error('All configured external event providers failed');
          }

          // Graceful demo fallback while Ticketmaster key is pending and no real events matched locally
          if (!ticketmasterAdapter.isEnabled() && collected.length === 0) {
            collected.push(...this.filterMockEvents(query));
            sourcesUsed.push('mock_fallback');
          }
        }

        const deduplicated = this.deduplicateEvents(collected);

        await this.saveCachedEvents(cacheKey, deduplicated);

        return {
          events: deduplicated,
          isStale: false,
          cacheHit: false,
          sourcesUsed,
        };
      } catch (err: any) {
        if (cached && now <= new Date(cached.staleUntil).getTime()) {
          console.warn(`[EventAggregator] Serving stale cache for ${cacheKey}: ${err.message}`);
          return {
            events: cached.events,
            isStale: true,
            cacheHit: true,
            sourcesUsed: ['stale_cache'],
          };
        }
        throw new Error(`Event providers unavailable: ${err.message}`);
      }
    });
  }

  /**
   * Retrieves a single normalized event by ID across organizer portal, mock fixtures, and cache
   */
  async getEventById(eventId: string): Promise<NormalizedEvent | null> {
    const orgEvent = await organizerEventsAdapter.getEventById(eventId);
    if (orgEvent) return orgEvent;

    const mock = MOCK_NORMALIZED_EVENTS.find((e) => e.id === eventId);
    if (mock) return mock;

    if (isIngestionDbInMemory()) {
      for (const entry of inMemoryIngestionStore.events.values()) {
        const found = entry.events.find((e) => e.id === eventId);
        if (found) return found;
      }
      return null;
    }

    const doc = (await EventsCacheModel.findOne({ 'events.id': eventId }).lean()) as any;
    if (doc) {
      const found = (doc.events as NormalizedEvent[]).find((e) => e.id === eventId);
      if (found) return found;
    }

    return null;
  }

  /**
   * Deterministic deduplication merging multi-provider records of the same live show (FR-13)
   */
  deduplicateEvents(events: NormalizedEvent[]): NormalizedEvent[] {
    const map = new Map<string, NormalizedEvent>();

    for (const ev of events) {
      const artistNorm = (ev.artistNames[0] || ev.name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 24);
      const geo6 = encodeGeohash(ev.venue.lat, ev.venue.lon, 6);
      const day = ev.startDateTime.slice(0, 10);
      const dedupKey = `${artistNorm}|${geo6}|${day}`;

      const existing = map.get(dedupKey);
      if (!existing) {
        map.set(dedupKey, ev);
        continue;
      }

      // Merge metadata from duplicate source
      const mergedGenres = Array.from(new Set([...existing.genres, ...ev.genres]));
      const mergedArtists = Array.from(new Set([...existing.artistNames, ...ev.artistNames]));
      const mergedPrice = existing.priceRange || ev.priceRange;
      const mergedImage =
        existing.imageUrl === DEFAULT_CONCERT_IMAGE && ev.imageUrl !== DEFAULT_CONCERT_IMAGE
          ? ev.imageUrl
          : existing.imageUrl;

      map.set(dedupKey, {
        ...existing,
        artistNames: mergedArtists,
        genres: mergedGenres,
        priceRange: mergedPrice,
        priceStatus: mergedPrice ? 'AVAILABLE' : 'UNAVAILABLE',
        imageUrl: mergedImage,
      });
    }

    return Array.from(map.values());
  }

  private filterMockEvents(query: EventSearchQuery): NormalizedEvent[] {
    return MOCK_NORMALIZED_EVENTS.filter((e) => {
      const d = calculateHaversineKm(query.lat, query.lon, e.venue.lat, e.venue.lon);
      return d <= query.radiusKm * 1.5;
    });
  }

  private async getCachedEvents(cacheKey: string): Promise<any | null> {
    if (isIngestionDbInMemory()) {
      return inMemoryIngestionStore.events.get(cacheKey) || null;
    }
    return EventsCacheModel.findOne({ cacheKey }).lean();
  }

  private async saveCachedEvents(cacheKey: string, events: NormalizedEvent[]): Promise<void> {
    const freshUntil = new Date(Date.now() + TTL_SECONDS.EVENTS_FRESH * 1000);
    const staleUntil = new Date(Date.now() + TTL_SECONDS.EVENTS_STALE_MAX * 1000);

    if (isIngestionDbInMemory()) {
      inMemoryIngestionStore.events.set(cacheKey, { events, freshUntil, staleUntil });
      return;
    }

    await EventsCacheModel.findOneAndUpdate(
      { cacheKey },
      { $set: { events, freshUntil, staleUntil } },
      { upsert: true }
    );
  }
}

export const eventAggregatorService = new EventAggregatorService();
