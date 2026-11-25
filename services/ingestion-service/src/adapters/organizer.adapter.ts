import crypto from 'crypto';
import { NormalizedEvent } from '@eventspot/shared';
import {
  OrganizerEventModel,
  EventsCacheModel,
  inMemoryIngestionStore,
  isIngestionDbInMemory,
} from '../db/mongodb.js';
import {
  EventSourceAdapter,
  EventSearchQuery,
  classifyVenueOutdoor,
  calculateHaversineKm,
  DEFAULT_CONCERT_IMAGE,
} from './event-source.interface.js';

export interface CreateOrganizerEventInput {
  name: string;
  artistNames: string[];
  genres: string[];
  startDateTime: string;
  venueName: string;
  city: string;
  address?: string;
  lat: number;
  lon: number;
  isOutdoor?: boolean;
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  imageUrl?: string;
}

export class OrganizerEventsAdapter implements EventSourceAdapter {
  readonly sourceId = 'organizer_portal';

  isEnabled(): boolean {
    return true; // Always available for local/independent venues
  }

  async addEvent(input: CreateOrganizerEventInput): Promise<NormalizedEvent> {
    const id = `org_${crypto.randomBytes(6).toString('hex')}`;
    const startTs = new Date(input.startDateTime);
    const expiresAt = new Date(startTs.getTime() + 86400 * 1000); // expire 24h after concert

    const priceRange =
      typeof input.priceMin === 'number' && input.priceMin >= 0
        ? {
            min: input.priceMin,
            max: typeof input.priceMax === 'number' ? Math.max(input.priceMin, input.priceMax) : input.priceMin,
            currency: 'EUR',
          }
        : undefined;

    const event: NormalizedEvent = {
      id,
      name: input.name.trim(),
      artistNames: input.artistNames.map((a) => a.trim()).filter(Boolean),
      genres: input.genres.map((g) => g.toLowerCase().trim()).filter(Boolean),
      startDateTime: startTs.toISOString(),
      venue: {
        name: input.venueName.trim(),
        city: input.city.trim(),
        address: input.address?.trim(),
        country: 'IT',
        lat: Number(input.lat),
        lon: Number(input.lon),
        isOutdoor: input.isOutdoor !== undefined ? input.isOutdoor : classifyVenueOutdoor(input.venueName),
      },
      priceRange,
      priceStatus: priceRange ? 'AVAILABLE' : 'UNAVAILABLE',
      ticketUrl: input.ticketUrl?.trim() || 'https://eventspot.local/organizer-event',
      imageUrl: input.imageUrl?.trim() || DEFAULT_CONCERT_IMAGE,
    };

    if (isIngestionDbInMemory()) {
      inMemoryIngestionStore.organizerEvents.set(id, event);
      inMemoryIngestionStore.events.clear(); // invalidate event cache
    } else {
      await OrganizerEventModel.create({ eventId: id, event, expiresAt });
      await EventsCacheModel.deleteMany({}); // invalidate event cache so new concert appears immediately
    }

    return event;
  }

  async fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = isIngestionDbInMemory()
      ? Array.from(inMemoryIngestionStore.organizerEvents.values())
      : ((await OrganizerEventModel.find({}).lean()) as any[]).map((doc) => doc.event);

    const fromTs = new Date(query.dateFrom).getTime();
    const toTs = new Date(query.dateTo).getTime();

    return allEvents.filter((ev) => {
      const evTs = new Date(ev.startDateTime).getTime();
      if (evTs < fromTs || evTs > toTs) return false;
      const dist = calculateHaversineKm(query.lat, query.lon, ev.venue.lat, ev.venue.lon);
      return dist <= query.radiusKm;
    });
  }

  async getEventById(eventId: string): Promise<NormalizedEvent | null> {
    if (isIngestionDbInMemory()) {
      return inMemoryIngestionStore.organizerEvents.get(eventId) || null;
    }
    const doc = (await OrganizerEventModel.findOne({ eventId }).lean()) as any;
    return doc?.event || null;
  }
}

export const organizerEventsAdapter = new OrganizerEventsAdapter();
