import { NormalizedEvent } from '@eventspot/shared';
import { encodeGeohash } from '../utils/geohash.js';
import { ticketmasterRateLimiter } from '../utils/token-bucket.js';
import { config } from '../config.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  classifyVenueOutdoor,
  DEFAULT_CONCERT_IMAGE,
} from './event-source.interface.js';

export class TicketmasterAdapter implements EventSourceAdapter {
  readonly sourceId = 'ticketmaster';

  isEnabled(): boolean {
    return !config.mockExternalProviders && Boolean(config.ticketmaster.apiKey);
  }

  async fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]> {
    if (!this.isEnabled()) {
      return [];
    }

    await ticketmasterRateLimiter.acquireToken();
    return this.fetchLiveTicketmasterEvents(query);
  }

  private formatTicketmasterIso(isoOrDate: string): string {
    const parsed = new Date(isoOrDate);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
    return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private async fetchLiveTicketmasterEvents(params: EventSearchQuery): Promise<NormalizedEvent[]> {
    const url = new URL(`${config.ticketmaster.baseUrl}/events.json`);
    url.searchParams.set('apikey', config.ticketmaster.apiKey);
    url.searchParams.set('classificationName', 'music');
    url.searchParams.set('geoPoint', encodeGeohash(params.lat, params.lon, 7));
    url.searchParams.set(
      'radius',
      Math.min(200, Math.max(10, Math.round(params.radiusKm))).toString()
    );
    url.searchParams.set('unit', 'km');
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
    const isOutdoor = classifyVenueOutdoor(venueName);

    const genres: string[] = [];
    for (const c of raw.classifications || []) {
      if (c.genre?.name && c.genre.name !== 'Undefined') genres.push(c.genre.name.toLowerCase());
      if (c.subGenre?.name && c.subGenre.name !== 'Undefined') {
        genres.push(c.subGenre.name.toLowerCase());
      }
    }

    const attractions = raw._embedded?.attractions || [];
    const artistNames = attractions.map((a: any) => a.name).filter(Boolean);
    if (artistNames.length === 0 && raw.name) {
      artistNames.push(raw.name);
    }

    const price = raw.priceRanges?.[0];
    const priceRange = price
      ? { min: price.min, max: price.max, currency: price.currency || 'EUR' }
      : undefined;

    const image = raw.images?.find((img: any) => img.ratio === '16_9') || raw.images?.[0];

    return {
      id: raw.id,
      name: raw.name,
      artistNames,
      genres,
      startDateTime:
        raw.dates?.start?.dateTime || raw.dates?.start?.localDate || new Date().toISOString(),
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
      imageUrl: image?.url || DEFAULT_CONCERT_IMAGE,
    };
  }
}

export const ticketmasterAdapter = new TicketmasterAdapter();
