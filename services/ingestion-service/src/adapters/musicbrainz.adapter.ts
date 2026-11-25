import { NormalizedEvent } from '@eventspot/shared';
import { config } from '../config.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  classifyVenueOutdoor,
  calculateHaversineKm,
  DEFAULT_CONCERT_IMAGE,
} from './event-source.interface.js';

interface PlaceCoords {
  name: string;
  city: string;
  address?: string;
  lat: number;
  lon: number;
}

const MB_HEADERS = {
  'User-Agent': 'EventSpot/2.2 (Politecnico-di-Bari-Thesis)',
  Accept: 'application/json',
};

export class MusicBrainzEventsAdapter implements EventSourceAdapter {
  readonly sourceId = 'musicbrainz';
  private placeCache = new Map<string, PlaceCoords | null>();

  isEnabled(): boolean {
    return !config.mockExternalProviders && config.enableFreeEventAdapters;
  }

  async fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]> {
    if (!this.isEnabled()) return [];

    const startDay = query.dateFrom.slice(0, 10);
    const endDay = query.dateTo.slice(0, 10);

    // Search upcoming concerts or festivals in Italy within date window
    const luceneQuery = `begin:[${startDay} TO ${endDay}] AND (type:Concert OR type:Festival) AND area:Italy`;
    const url = new URL('https://musicbrainz.org/ws/2/event/');
    url.searchParams.set('query', luceneQuery);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', '20');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: MB_HEADERS,
      });

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as any;
      const rawEvents = Array.isArray(data?.events) ? data.events : [];
      if (rawEvents.length === 0) return [];

      const results: NormalizedEvent[] = [];

      // Look up place coordinates for events that expose a place relation (max 4 per cold cycle to respect rate limit)
      let placeFetchCount = 0;
      for (const raw of rawEvents) {
        const placeRel = (raw.relations || []).find(
          (r: any) => r['target-type'] === 'place' && r.place?.id
        );
        if (!placeRel?.place?.id) continue;

        let coords = this.placeCache.get(placeRel.place.id);
        if (coords === undefined && placeFetchCount < 4) {
          placeFetchCount++;
          coords = await this.fetchPlaceCoordinates(placeRel.place.id);
          this.placeCache.set(placeRel.place.id, coords);
        }

        if (!coords || !coords.lat || !coords.lon) continue;

        const distance = calculateHaversineKm(query.lat, query.lon, coords.lat, coords.lon);
        if (distance > query.radiusKm) continue;

        const artistRels = (raw.relations || []).filter((r: any) => r['target-type'] === 'artist');
        const artistNames = artistRels
          .map((r: any) => String(r.artist?.name || '').trim())
          .filter(Boolean);

        const beginDate = raw['life-span']?.begin || startDay;
        const startTime = raw.time ? `${beginDate}T${raw.time}:00Z` : `${beginDate}T21:00:00Z`;
        const tags = Array.isArray(raw.tags)
          ? raw.tags.map((t: any) => String(t.name || '').toLowerCase().trim()).filter(Boolean)
          : ['live music'];

        results.push({
          id: `mb_${raw.id}`,
          name: String(raw.name || artistNames[0] || 'Live Concert'),
          artistNames: artistNames.length > 0 ? artistNames : [String(raw.name || 'Live Act')],
          genres: tags.length > 0 ? tags : ['live music'],
          startDateTime: new Date(startTime).toISOString(),
          venue: {
            name: coords.name,
            city: coords.city,
            address: coords.address,
            country: 'IT',
            lat: coords.lat,
            lon: coords.lon,
            isOutdoor: classifyVenueOutdoor(coords.name),
          },
          priceRange: undefined,
          priceStatus: 'UNAVAILABLE',
          ticketUrl: `https://musicbrainz.org/event/${raw.id}`,
          imageUrl: DEFAULT_CONCERT_IMAGE,
        });
      }

      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchPlaceCoordinates(placeId: string): Promise<PlaceCoords | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    try {
      const res = await fetch(`https://musicbrainz.org/ws/2/place/${placeId}?fmt=json`, {
        signal: controller.signal,
        headers: MB_HEADERS,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as any;
      const lat = parseFloat(data?.coordinates?.latitude || '0');
      const lon = parseFloat(data?.coordinates?.longitude || '0');
      if (!lat || !lon) return null;

      return {
        name: String(data.name || 'Venue'),
        city: String(data.area?.name || ''),
        address: typeof data.address === 'string' && data.address ? data.address : undefined,
        lat,
        lon,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const musicBrainzEventsAdapter = new MusicBrainzEventsAdapter();
