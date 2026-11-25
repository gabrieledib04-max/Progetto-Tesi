import { NormalizedEvent } from '@eventspot/shared';
import { config } from '../config.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  classifyVenueOutdoor,
  calculateHaversineKm,
  DEFAULT_CONCERT_IMAGE,
} from './event-source.interface.js';

export class JamBaseAdapter implements EventSourceAdapter {
  readonly sourceId = 'jambase';

  isEnabled(): boolean {
    return !config.mockExternalProviders && Boolean(config.jamBase.apiKey);
  }

  async fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]> {
    if (!this.isEnabled() || !config.jamBase.apiKey) {
      return [];
    }

    const url = new URL(`${config.jamBase.baseUrl}/events`);
    url.searchParams.set('geoCountryIso2', 'IT');
    url.searchParams.set('eventDateFrom', query.dateFrom.slice(0, 10));
    url.searchParams.set('eventDateTo', query.dateTo.slice(0, 10));
    url.searchParams.set('perPage', '50');
    url.searchParams.set('eventType', 'concert');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.jamBase.apiKey}`,
          Accept: 'application/json',
          'User-Agent': 'EventSpot/2.2 (Politecnico-di-Bari-Thesis)',
        },
      });

      if (!res.ok) {
        throw new Error(`JamBase API returned ${res.status}`);
      }

      const data = (await res.json()) as any;
      const rawEvents = Array.isArray(data?.events) ? data.events : [];

      return rawEvents
        .map((ev: any) => this.normalizeJamBaseEvent(ev))
        .filter((ev: NormalizedEvent | null): ev is NormalizedEvent => {
          if (!ev || ev.venue.lat === 0 || ev.venue.lon === 0) return false;
          const dist = calculateHaversineKm(query.lat, query.lon, ev.venue.lat, ev.venue.lon);
          return dist <= query.radiusKm;
        });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeJamBaseEvent(raw: any): NormalizedEvent | null {
    const location = raw.location || {};
    const geo = location.geo || {};
    const lat = Number(geo.latitude || 0);
    const lon = Number(geo.longitude || 0);
    if (!lat || !lon) return null;

    const venueName = String(location.name || 'Live Venue');
    const addressObj = location.address || {};
    const performers = Array.isArray(raw.performer) ? raw.performer : [];
    const artistNames = performers
      .map((p: any) => String(p?.name || '').trim())
      .filter(Boolean);

    const genresSet = new Set<string>();
    for (const p of performers) {
      if (Array.isArray(p?.genre)) {
        for (const g of p.genre) {
          if (typeof g === 'string' && g.trim()) genresSet.add(g.toLowerCase().trim());
        }
      }
    }

    const offers = Array.isArray(raw.offers) ? raw.offers : raw.offers ? [raw.offers] : [];
    const priced = offers.find((o: any) => typeof o?.price === 'number' && o.price >= 0);
    const priceRange = priced
      ? {
          min: Number(priced.price),
          max: Number(priced.highPrice || priced.price),
          currency: String(priced.priceCurrency || 'EUR'),
        }
      : undefined;

    return {
      id: `jb_${String(raw.identifier || raw['@id'] || Math.random().toString(36).slice(2))}`,
      name: String(raw.name || artistNames[0] || 'Live Concert'),
      artistNames: artistNames.length > 0 ? artistNames : [String(raw.name || 'Live Act')],
      genres: Array.from(genresSet),
      startDateTime: raw.startDate ? new Date(raw.startDate).toISOString() : new Date().toISOString(),
      venue: {
        name: venueName,
        city: String(addressObj.addressLocality || ''),
        address: typeof addressObj.streetAddress === 'string' ? addressObj.streetAddress : undefined,
        country: String(addressObj.addressCountry || 'IT'),
        lat,
        lon,
        isOutdoor: classifyVenueOutdoor(venueName),
      },
      priceRange,
      priceStatus: priceRange ? 'AVAILABLE' : 'UNAVAILABLE',
      ticketUrl: String(raw.url || offers[0]?.url || 'https://www.jambase.com/'),
      imageUrl: typeof raw.image === 'string' && raw.image ? raw.image : DEFAULT_CONCERT_IMAGE,
    };
  }
}

export const jamBaseAdapter = new JamBaseAdapter();
