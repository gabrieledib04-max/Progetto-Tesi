import { SessionTag } from '@eventspot/shared';

/**
 * Computes Semantic Similarity between active session tags and event genres/line-up
 * Range: [0.0, 1.0]
 */
export function computeSemanticSimilarity(
  sessionTags: SessionTag[],
  sessionArtists: string[],
  eventGenres: string[],
  eventArtists: string[]
): number {
  if (sessionTags.length === 0 && sessionArtists.length === 0) {
    return 0.0;
  }

  // 1. Direct Artist Match Check (Boost to 1.0)
  const sessionArtistSet = new Set(sessionArtists.map((a) => a.toLowerCase().trim()));
  for (const eventArtist of eventArtists) {
    const lower = eventArtist.toLowerCase().trim();
    if (sessionArtistSet.has(lower)) {
      return 1.0;
    }
    // Substring match for collaborations (e.g. "Artist A ft. Artist B")
    for (const sa of sessionArtistSet) {
      if (sa.length > 3 && (lower.includes(sa) || sa.includes(lower))) {
        return 1.0;
      }
    }
  }

  if (sessionTags.length === 0 || eventGenres.length === 0) {
    return 0.0;
  }

  // 2. Build Vocabulary of Unique Genre Tokens
  const sessionMap = new Map<string, number>();
  for (const tag of sessionTags) {
    sessionMap.set(tag.name.toLowerCase().trim(), tag.weight);
  }

  const eventSet = new Set(eventGenres.map((g) => g.toLowerCase().trim()));

  // Expand with word tokens (e.g., "indie rock" yields ["indie rock", "indie", "rock"])
  const vocabulary = new Set<string>();
  sessionMap.forEach((_, key) => {
    vocabulary.add(key);
    key.split(/\s+/).forEach((w) => vocabulary.add(w));
  });
  eventSet.forEach((key) => {
    vocabulary.add(key);
    key.split(/\s+/).forEach((w) => vocabulary.add(w));
  });

  const vocabArray = Array.from(vocabulary);

  // 3. Project into Vectors
  let dotProduct = 0;
  let normSessionSq = 0;
  let normEventSq = 0;

  for (const term of vocabArray) {
    // Session term weight
    let sessionVal = sessionMap.get(term) || 0;
    if (sessionVal === 0) {
      // Check if term is part of a compound tag
      for (const [tag, weight] of sessionMap.entries()) {
        if (tag.includes(term)) {
          sessionVal = Math.max(sessionVal, weight * 0.7);
        }
      }
    }

    // Event term weight
    let eventVal = eventSet.has(term) ? 1.0 : 0;
    if (eventVal === 0) {
      for (const eg of eventSet) {
        if (eg.includes(term)) {
          eventVal = 0.7;
          break;
        }
      }
    }

    dotProduct += sessionVal * eventVal;
    normSessionSq += sessionVal * sessionVal;
    normEventSq += eventVal * eventVal;
  }

  if (normSessionSq === 0 || normEventSq === 0) {
    return 0.0;
  }

  const cosineSim = dotProduct / (Math.sqrt(normSessionSq) * Math.sqrt(normEventSq));
  return Math.min(1.0, Math.max(0.0, Math.round(cosineSim * 1000) / 1000));
}
