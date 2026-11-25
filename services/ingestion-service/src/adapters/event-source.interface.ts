import { NormalizedEvent } from '@eventspot/shared';

export interface EventSearchQuery {
  lat: number;
  lon: number;
  radiusKm: number;
  dateFrom: string;
  dateTo: string;
}

export interface EventSourceAdapter {
  readonly sourceId: string;
  isEnabled(): boolean;
  fetchEvents(query: EventSearchQuery): Promise<NormalizedEvent[]>;
}

const OUTDOOR_KEYWORDS = [
  'arena',
  'parco',
  'park',
  'ippodromo',
  'stadio',
  'stadium',
  'amphitheatre',
  'anfiteatro',
  'open air',
  'beach',
  'spiaggia',
  'piazza',
  'fiera',
  'festival',
];

const INDOOR_KEYWORDS = [
  'club',
  'teatro',
  'theatre',
  'theater',
  'palazzo',
  'palasport',
  'palaflorio',
  'forum',
  'hall',
  'indoor',
  'auditorium',
  'circolo',
  'alcatraz',
  'fabrique',
  'santeria',
  'magazzini',
  'blue note',
  'unipol arena',
];

export function classifyVenueOutdoor(venueName: string): boolean {
  const lower = venueName.toLowerCase();
  if (INDOOR_KEYWORDS.some((k) => lower.includes(k))) return false;
  return OUTDOOR_KEYWORDS.some((k) => lower.includes(k));
}

export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const DEFAULT_CONCERT_IMAGE =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80';
