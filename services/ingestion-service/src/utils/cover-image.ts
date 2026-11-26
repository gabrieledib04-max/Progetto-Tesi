import { NormalizedEvent } from '@eventspot/shared';
import { DEFAULT_CONCERT_IMAGE } from '../adapters/event-source.interface.js';

const CONCERT_FALLBACK_POOL = [
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
];

// Persistent in-memory cache of artistName -> resolved high-res portrait URL
const artistCoverCache = new Map<string, string | null>();

function isPlaceholderImage(url?: string): boolean {
  if (!url || !url.startsWith('http')) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('jambase-default-band-image') ||
    lower.includes('default-image') ||
    lower.includes('placeholder') ||
    url === DEFAULT_CONCERT_IMAGE
  );
}

function pickDeterministicFallback(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CONCERT_FALLBACK_POOL[hash % CONCERT_FALLBACK_POOL.length];
}

async function lookupDeezerArtistImage(artistName: string): Promise<string | null> {
  const key = artistName.toLowerCase().trim();
  if (!key) return null;

  if (artistCoverCache.has(key)) {
    return artistCoverCache.get(key) || null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1400);

  try {
    const url = new URL('https://api.deezer.com/search/artist');
    url.searchParams.set('q', artistName);
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      artistCoverCache.set(key, null);
      return null;
    }

    const data = (await res.json()) as any;
    const hit = data?.data?.[0];
    const picture: string | undefined = hit?.picture_xl || hit?.picture_big || hit?.picture_medium;

    // Skip generic Deezer empty artist avatar hash
    if (picture && !picture.includes('/artist//')) {
      artistCoverCache.set(key, picture);
      return picture;
    }

    artistCoverCache.set(key, null);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Replaces missing or generic black-and-white placeholder images with real artist portraits (Deezer public API)
 * or diverse live-music fallbacks. Runs bounded concurrent lookups to respect cold-start SLA.
 */
export async function enrichEventCovers(
  events: NormalizedEvent[],
  allowNetworkLookup = true
): Promise<NormalizedEvent[]> {
  // Collect unique artist names needing enrichment (cap live lookups to 12 per batch)
  const artistsToLookup: string[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    if (isPlaceholderImage(ev.imageUrl)) {
      const artist = (ev.artistNames[0] || '').trim();
      const lower = artist.toLowerCase();
      if (artist && !seen.has(lower) && !artistCoverCache.has(lower)) {
        seen.add(lower);
        artistsToLookup.push(artist);
      }
    }
  }

  if (allowNetworkLookup && artistsToLookup.length > 0) {
    await Promise.allSettled(
      artistsToLookup.slice(0, 12).map((artist) => lookupDeezerArtistImage(artist))
    );
  }

  return events.map((ev) => {
    if (!isPlaceholderImage(ev.imageUrl)) {
      return ev;
    }
    const artistKey = (ev.artistNames[0] || '').toLowerCase().trim();
    const resolved = artistKey ? artistCoverCache.get(artistKey) : null;
    return {
      ...ev,
      imageUrl: resolved || pickDeterministicFallback(ev.id + artistKey),
    };
  });
}
