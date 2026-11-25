import crypto from 'crypto';
import { NormalizedEvent } from '@eventspot/shared';
import { config } from '../config.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  classifyVenueOutdoor,
  calculateHaversineKm,
  DEFAULT_CONCERT_IMAGE,
} from './event-source.interface.js';

const CITY_CENTER_FALLBACK: Record<string, { lat: number; lon: number }> = {
  milano: { lat: 45.4642, lon: 9.1900 },
  milan: { lat: 45.4642, lon: 9.1900 },
  bari: { lat: 41.1171, lon: 16.8719 },
  roma: { lat: 41.9028, lon: 12.4964 },
  rome: { lat: 41.9028, lon: 12.4964 },
  bologna: { lat: 44.4949, lon: 11.3426 },
  torino: { lat: 45.0703, lon: 7.6869 },
  turin: { lat: 45.0703, lon: 7.6869 },
  napoli: { lat: 40.8518, lon: 14.2681 },
  firenze: { lat: 43.7696, lon: 11.2558 },
  lecce: { lat: 40.3515, lon: 18.1750 },
};

export class JsonLdScraperAdapter implements EventSourceAdapter {
  readonly sourceId = 'jsonld_venues';

  isEnabled(): boolean {
    return !config.mockExternalProviders && config.eventFeedUrls.length > 0;
  }

  async fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]> {
    if (!this.isEnabled()) return [];

    const results = await Promise.allSettled(
      config.eventFeedUrls.map((url) => this.fetchFeedUrl(url, query))
    );

    const events: NormalizedEvent[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        events.push(...res.value);
      }
    }
    return events;
  }

  private async fetchFeedUrl(feedUrl: string, query: EventSearchQuery): Promise<NormalizedEvent[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'EventSpot/2.2 (Politecnico-di-Bari-Thesis)',
          Accept: 'text/html,application/ld+json,application/json',
        },
      });
      if (!res.ok) return [];

      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      const blocks: any[] = [];

      if (contentType.includes('json')) {
        try {
          blocks.push(JSON.parse(rawText));
        } catch {
          return [];
        }
      } else {
        const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let match: RegExpExecArray | null;
        while ((match = scriptRegex.exec(rawText)) !== null) {
          try {
            blocks.push(JSON.parse(match[1].trim()));
          } catch {
            // Skip malformed JSON-LD block
          }
        }
      }

      const rawItems = this.flattenJsonLdEvents(blocks);
      const fromTs = new Date(query.dateFrom).getTime();
      const toTs = new Date(query.dateTo).getTime();

      return rawItems
        .map((item) => this.normalizeSchemaOrgEvent(item, feedUrl))
        .filter((ev): ev is NormalizedEvent => {
          if (!ev) return false;
          const evTs = new Date(ev.startDateTime).getTime();
          if (evTs < fromTs || evTs > toTs) return false;
          const dist = calculateHaversineKm(query.lat, query.lon, ev.venue.lat, ev.venue.lon);
          return dist <= query.radiusKm;
        });
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private flattenJsonLdEvents(nodes: any[]): any[] {
    const found: any[] = [];
    const stack = [...nodes];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }
      if (typeof current === 'object') {
        if (Array.isArray(current['@graph'])) {
          stack.push(...current['@graph']);
        }
        const typeVal = current['@type'];
        const types = Array.isArray(typeVal) ? typeVal : [typeVal];
        if (types.some((t) => t === 'MusicEvent' || t === 'Festival' || t === 'Event')) {
          found.push(current);
        }
      }
    }
    return found;
  }

  private normalizeSchemaOrgEvent(raw: any, fallbackUrl: string): NormalizedEvent | null {
    if (!raw.name || !raw.startDate) return null;

    const loc = raw.location || {};
    const address = loc.address || {};
    const cityName = String(address.addressLocality || loc.name || '').trim();

    let lat = Number(loc.geo?.latitude || 0);
    let lon = Number(loc.geo?.longitude || 0);

    if ((!lat || !lon) && cityName) {
      const cityMatch = CITY_CENTER_FALLBACK[cityName.toLowerCase()];
      if (cityMatch) {
        lat = cityMatch.lat;
        lon = cityMatch.lon;
      }
    }

    if (!lat || !lon) return null;

    const performers = Array.isArray(raw.performer)
      ? raw.performer
      : raw.performer
        ? [raw.performer]
        : [];
    const artistNames = performers
      .map((p: any) => (typeof p === 'string' ? p : String(p?.name || '').trim()))
      .filter(Boolean);

    const offers = Array.isArray(raw.offers) ? raw.offers : raw.offers ? [raw.offers] : [];
    const validOffer = offers.find((o: any) => o?.price !== undefined && !Number.isNaN(Number(o.price)));
    const priceRange = validOffer
      ? {
          min: Number(validOffer.price),
          max: Number(validOffer.highPrice || validOffer.price),
          currency: String(validOffer.priceCurrency || 'EUR'),
        }
      : undefined;

    const imageUrl =
      typeof raw.image === 'string'
        ? raw.image
        : Array.isArray(raw.image) && typeof raw.image[0] === 'string'
          ? raw.image[0]
          : DEFAULT_CONCERT_IMAGE;

    const venueName = String(loc.name || cityName || 'Live Club');
    const hashId = crypto
      .createHash('sha1')
      .update(`${raw.name}|${raw.startDate}|${venueName}`)
      .digest('hex')
      .slice(0, 12);

    return {
      id: `ld_${hashId}`,
      name: String(raw.name).trim(),
      artistNames: artistNames.length > 0 ? artistNames : [String(raw.name).trim()],
      genres: raw.genre
        ? (Array.isArray(raw.genre) ? raw.genre : [raw.genre]).map((g: any) => String(g).toLowerCase())
        : ['live music'],
      startDateTime: new Date(raw.startDate).toISOString(),
      venue: {
        name: venueName,
        city: cityName || 'Italia',
        address: typeof address.streetAddress === 'string' ? address.streetAddress : undefined,
        country: String(address.addressCountry || 'IT'),
        lat,
        lon,
        isOutdoor: classifyVenueOutdoor(venueName),
      },
      priceRange,
      priceStatus: priceRange ? 'AVAILABLE' : 'UNAVAILABLE',
      ticketUrl: String(raw.url || offers[0]?.url || fallbackUrl),
      imageUrl,
    };
  }
}

export const jsonLdScraperAdapter = new JsonLdScraperAdapter();
