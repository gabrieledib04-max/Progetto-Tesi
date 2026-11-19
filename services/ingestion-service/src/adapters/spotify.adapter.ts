import { SessionTag, SESSION_RECENCY_LAMBDA } from '@eventspot/shared';
import {
  SessionContextModel,
  inMemoryIngestionStore,
  isIngestionDbInMemory,
} from '../db/mongodb.js';
import { config } from '../config.js';

export interface SpotifySessionContextResult {
  sessionTags: SessionTag[];
  sessionArtists: string[];
  isSessionEmpty: boolean;
}

export class SpotifyAdapter {
  /**
   * Fetches active/recent listening session, resolves genres and applies exponential decay (FR-03)
   */
  async getSessionContext(
    sessionIdHash?: string,
    accessToken?: string
  ): Promise<SpotifySessionContextResult> {
    if (!accessToken && !sessionIdHash) {
      return { sessionTags: [], sessionArtists: [], isSessionEmpty: true };
    }

    // 1. Check MongoDB session context cache (15-minute TTL)
    if (sessionIdHash) {
      const cached = await this.getCachedSessionContext(sessionIdHash);
      if (cached) {
        return {
          sessionTags: cached.tags,
          sessionArtists: cached.artistNames,
          isSessionEmpty: cached.tags.length === 0,
        };
      }
    }

    // 2. Fetch fresh session context
    let result: SpotifySessionContextResult;

    if (config.mockExternalProviders || !accessToken || accessToken.startsWith('mock_')) {
      result = this.getMockSessionContext();
    } else {
      result = await this.fetchLiveSpotifySession(accessToken);
    }

    // 3. Cache session context if sessionIdHash present
    if (sessionIdHash) {
      await this.saveCachedSessionContext(sessionIdHash, result);
    }

    return result;
  }

  /**
   * Purges cached session context on logout or GDPR deletion
   */
  async purgeSessionContext(sessionIdHash: string): Promise<void> {
    if (isIngestionDbInMemory()) {
      inMemoryIngestionStore.sessionContexts.delete(sessionIdHash);
      return;
    }
    await SessionContextModel.deleteOne({ sessionIdHash });
  }

  private async fetchLiveSpotifySession(accessToken: string): Promise<SpotifySessionContextResult> {
    try {
      // 1. Fetch currently-playing track (if any)
      const currentRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let currentTrack: any = null;
      if (currentRes.status === 200) {
        const json = (await currentRes.json()) as any;
        currentTrack = json?.item;
      }

      // 2. Fetch recently-played tracks (limit 15)
      const recentRes = await fetch(
        'https://api.spotify.com/v1/me/player/recently-played?limit=15',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!recentRes.ok) {
        throw new Error(`Spotify recently-played returned ${recentRes.status}`);
      }

      const recentData = (await recentRes.json()) as any;
      const recentItems = recentData.items || [];

      // Combine tracks: current track at rank 1, followed by recently-played
      const allTracks: Array<{ artistId: string; artistName: string; trackName: string }> = [];

      if (currentTrack?.artists?.[0]) {
        allTracks.push({
          artistId: currentTrack.artists[0].id,
          artistName: currentTrack.artists[0].name,
          trackName: currentTrack.name,
        });
      }

      for (const item of recentItems) {
        const t = item.track;
        if (t?.artists?.[0]) {
          allTracks.push({
            artistId: t.artists[0].id,
            artistName: t.artists[0].name,
            trackName: t.name,
          });
        }
      }

      if (allTracks.length === 0) {
        return { sessionTags: [], sessionArtists: [], isSessionEmpty: true };
      }

      // 3. Resolve artist genres from Spotify /v1/artists (batch of IDs)
      const uniqueArtistIds = Array.from(new Set(allTracks.map((t) => t.artistId).filter(Boolean)));
      const artistGenreMap = await this.fetchArtistGenres(accessToken, uniqueArtistIds);

      // 4. Calculate exponential decay on recency: alpha_k = exp(-lambda * (k - 1))
      const tagWeights = new Map<string, number>();
      const sessionArtistsSet = new Set<string>();

      allTracks.forEach((track, index) => {
        const rank = index + 1; // 1, 2, 3...
        const recencyWeight = Math.exp(-SESSION_RECENCY_LAMBDA * (rank - 1));
        sessionArtistsSet.add(track.artistName);

        const genres = artistGenreMap.get(track.artistId) || [];
        for (const genre of genres) {
          const lower = genre.toLowerCase().trim();
          tagWeights.set(lower, (tagWeights.get(lower) || 0) + recencyWeight);
        }
      });

      // Normalize tag weights to [0, 1] relative scale
      const maxWeight = Math.max(...Array.from(tagWeights.values()), 1);
      const sessionTags: SessionTag[] = Array.from(tagWeights.entries())
        .map(([name, w]) => ({
          name,
          weight: Math.round((w / maxWeight) * 100) / 100,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 15);

      return {
        sessionTags,
        sessionArtists: Array.from(sessionArtistsSet),
        isSessionEmpty: sessionTags.length === 0,
      };
    } catch (err: any) {
      console.warn(`[SpotifyAdapter] Live fetch failed: ${err.message}. Returning empty session context.`);
      return { sessionTags: [], sessionArtists: [], isSessionEmpty: true };
    }
  }

  private async fetchArtistGenres(
    accessToken: string,
    artistIds: string[]
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (artistIds.length === 0) return map;

    // Spotify allows up to 50 IDs per call
    const batch = artistIds.slice(0, 50).join(',');
    const res = await fetch(`https://api.spotify.com/v1/artists?ids=${batch}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      for (const artist of data.artists || []) {
        if (artist?.id) {
          map.set(artist.id, artist.genres || []);
        }
      }
    }
    return map;
  }

  private getMockSessionContext(): SpotifySessionContextResult {
    // Realistic active session representing student Marco (Indie / Rock / Alternative)
    const mockTracks = [
      { artist: 'Arctic Monkeys', genres: ['indie rock', 'alternative rock', 'post-punk revival'] },
      { artist: 'Fontaines D.C.', genres: ['post-punk', 'indie rock', 'alternative'] },
      { artist: 'The Weeknd', genres: ['contemporary r&b', 'synth-pop', 'pop'] },
      { artist: 'LANY', genres: ['indie pop', 'synth-pop', 'dream pop'] },
      { artist: 'Calcutta', genres: ['indie pop italiano', 'it-pop'] },
      { artist: 'Marracash', genres: ['hip hop', 'rap italiano'] },
      { artist: 'Dua Lipa', genres: ['pop', 'dance pop'] },
    ];

    const tagWeights = new Map<string, number>();
    const sessionArtists: string[] = [];

    mockTracks.forEach((track, index) => {
      const rank = index + 1;
      const weight = Math.exp(-SESSION_RECENCY_LAMBDA * (rank - 1));
      sessionArtists.push(track.artist);

      for (const genre of track.genres) {
        tagWeights.set(genre, (tagWeights.get(genre) || 0) + weight);
      }
    });

    const maxWeight = Math.max(...Array.from(tagWeights.values()), 1);
    const sessionTags: SessionTag[] = Array.from(tagWeights.entries())
      .map(([name, w]) => ({
        name,
        weight: Math.round((w / maxWeight) * 100) / 100,
      }))
      .sort((a, b) => b.weight - a.weight);

    return {
      sessionTags,
      sessionArtists,
      isSessionEmpty: false,
    };
  }

  private async getCachedSessionContext(sessionIdHash: string): Promise<any | null> {
    if (isIngestionDbInMemory()) {
      const cached = inMemoryIngestionStore.sessionContexts.get(sessionIdHash);
      if (!cached) return null;
      if (Date.now() - cached.fetchedAt.getTime() > 900 * 1000) {
        inMemoryIngestionStore.sessionContexts.delete(sessionIdHash);
        return null;
      }
      return cached;
    }

    const doc = await SessionContextModel.findOne({ sessionIdHash }).lean();
    return doc;
  }

  private async saveCachedSessionContext(
    sessionIdHash: string,
    result: SpotifySessionContextResult
  ): Promise<void> {
    if (isIngestionDbInMemory()) {
      inMemoryIngestionStore.sessionContexts.set(sessionIdHash, {
        tags: result.sessionTags,
        artistNames: result.sessionArtists,
        trackCount: result.sessionArtists.length,
        fetchedAt: new Date(),
      });
      return;
    }

    await SessionContextModel.findOneAndUpdate(
      { sessionIdHash },
      {
        $set: {
          tags: result.sessionTags,
          artistNames: result.sessionArtists,
          trackCount: result.sessionArtists.length,
          fetchedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}

export const spotifyAdapter = new SpotifyAdapter();
