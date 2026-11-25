import { NormalizedEvent, TTL_SECONDS } from '@eventspot/shared';
import { encodeGeohash, bucketRadius } from '../utils/geohash.js';
import { SingleFlight } from '../utils/single-flight.js';
import { ticketmasterRateLimiter } from '../utils/token-bucket.js';
import {
  EventsCacheModel,
  inMemoryIngestionStore,
  isIngestionDbInMemory,
} from '../db/mongodb.js';
import { MOCK_NORMALIZED_EVENTS } from './mock-data.js';
import { config } from '../config.js';

export interface SearchEventsResult {
  events: NormalizedEvent[];
  isStale: boolean;
  cacheHit: boolean;
}

export class TicketmasterAdapter {
  private singleFlight = new SingleFlight<SearchEventsResult>();

  /**
   * Searches live music events with Cache-Aside, Stale-if-error, Single-Flight & Token Bucket
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
      };
    }

    // 2. Fetch via Single-Flight request to prevent concurrent duplicate calls
    return this.singleFlight.do(cacheKey, async () => {
      try {
        await ticketmasterRateLimiter.acquireToken();

        let events: NormalizedEvent[];
        if (config.mockExternalProviders || !config.ticketmaster.apiKey) {
          events = this.filterMockEvents(params.lat, params.lon, params.radiusKm);
        } else {
          events = await this.fetchLiveTicketmasterEvents({
            lat: params.lat,
            lon: params.lon,
            radiusKm: params.radiusKm,
            dateFrom,
            dateTo,
          });
        }

        // Cache fresh events (fresh 6h, stale-if-error 24h)
        await this.saveCachedEvents(cacheKey, events);

        return {
          events,
          isStale: false,
          cacheHit: false,
        };
      } catch (err: any) {
        // NFR-R4: Stale-if-error fallback up to 24h
        if (cached && now <= new Date(cached.staleUntil).getTime()) {
          console.warn(`[TicketmasterAdapter] Serving stale cache for ${cacheKey}: ${err.message}`);
          return {
            events: cached.events,
            isStale: true,
            cacheHit: true,
          };
        }
        throw new Error(`Ticketmaster service unavailable: ${err.message}`);
      }
    });
  }

  /**
   * Retrieves single normalized event by ID
   */
  async getEventById(eventId: string): Promise<NormalizedEvent | null> {
    // Check mock events first
    const mock = MOCK_NORMALIZED_EVENTS.find((e) => e.id === eventId);
    if (mock) return mock;

    // Search cache entries
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

  private formatTicketmasterIso(isoOrDate: string): string {
    const parsed = new Date(isoOrDate);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
    return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private async fetchLiveTicketmasterEvents(params: {
    lat: number;
    lon: number;
    radiusKm: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<NormalizedEvent[]> {
    const url = new URL(`${config.ticketmaster.baseUrl}/events.json`);
    url.searchParams.set('apikey', config.ticketmaster.apiKey);
    url.searchParams.set('classificationName', 'music');
    // Ticketmaster Discovery v2 prefers Base32 geoPoint over deprecated latlong
    url.searchParams.set('geoPoint', encodeGeohash(params.lat, params.lon, 7));
    url.searchParams.set('radius', Math.min(200, Math.max(10, Math.round(params.radiusKm))).toString());
    url.searchParams.set('unit', 'km');
    // Strictly strip milliseconds (.000Z -> Z) to avoid Ticketmaster 400 validation errors
    url.searchParams.set('startDateTime', this.formatTicketmasterIso(params.dateFrom));
    url.searchParams.set('endDateTime', this.formatTicketmasterIso(params.dateTo));
    url.searchParams.set('sort', 'date,asc');
    url.searchParams.set('size', '100');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Ticketmaster API returned status ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const rawEvents = data._embedded?.events || [];

      return rawEvents
        .map((raw: any) => this.normalizeRawEvent(raw))
        .filter((ev: NormalizedEvent) => ev.venue.lat !== 0 && ev.venue.lon !== 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeRawEvent(raw: any): NormalizedEvent {
    const venue = raw._embedded?.venues?.[0] || {};
    const lat = parseFloat(venue.location?.latitude || '0');
    const lon = parseFloat(venue.location?.longitude || '0');

    const venueName = venue.name || 'Venue non specificato';
    const isOutdoor = this.classifyVenueOutdoor(venueName);

    // Extract genres and subgenres
    const genres: string[] = [];
    for (const c of raw.classifications || []) {
      if (c.genre?.name && c.genre.name !== 'Undefined') genres.push(c.genre.name.toLowerCase());
      if (c.subGenre?.name && c.subGenre.name !== 'Undefined') genres.push(c.subGenre.name.toLowerCase());
    }

    // Extract artists
    const attractions = raw._embedded?.attractions || [];
    const artistNames = attractions.map((a: any) => a.name).filter(Boolean);
    if (artistNames.length === 0 && raw.name) {
      artistNames.push(raw.name);
    }

    // Price range
    const price = raw.priceRanges?.[0];
    const priceRange = price
      ? { min: price.min, max: price.max, currency: price.currency || 'EUR' }
      : undefined;

    // Pick best image
    const image = raw.images?.find((img: any) => img.ratio === '16_9') || raw.images?.[0];

    return {
      id: raw.id,
      name: raw.name,
      artistNames,
      genres,
      startDateTime: raw.dates?.start?.dateTime || raw.dates?.start?.localDate || new Date().toISOString(),
      venue: {
        name: venueName,
        city: venue.city?.name || '',
        address: venue.address?.line1,
        country: venue.country?.countryCode || 'IT',
        lat,
        lon,
        isOutdoor,
      },
      priceRange,
      priceStatus: priceRange ? 'AVAILABLE' : 'UNAVAILABLE',
      ticketUrl: raw.url || '',
      imageUrl: image?.url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    };
  }

  /**
   * Heuristic indoor/outdoor classifier based on venue name keywords
   */
  private classifyVenueOutdoor(venueName: string): boolean {
    const lower = venueName.toLowerCase();
    const outdoorKeywords = ['arena', 'parco', 'park', 'ippodromo', 'stadio', 'stadium', 'amphitheatre', 'open air', 'beach', 'spiaggia'];
    const indoorKeywords = ['club', 'teatro', 'theatre', 'palazzo', 'palasport', 'forum', 'hall', 'indoor'];

    if (indoorKeywords.some((k) => lower.includes(k))) return false;
    return outdoorKeywords.some((k) => lower.includes(k));
  }

  private filterMockEvents(lat: number, lon: number, radiusKm: number): NormalizedEvent[] {
    return MOCK_NORMALIZED_EVENTS.filter((e) => {
      const d = this.calculateHaversineDistance(lat, lon, e.venue.lat, e.venue.lon);
      return d <= radiusKm * 1.5; // slight tolerance for demo
    });
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

export const ticketmasterAdapter = new TicketmasterAdapter();
