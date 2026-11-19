import { buildRecommendationApp } from '../dist/server.js';
import { scoringEngine } from '../dist/engine/scoring.js';
import { calculateHaversineDistance, computeSpatialDecay } from '../dist/engine/haversine.js';
import { computeSemanticSimilarity } from '../dist/engine/semantic.js';
import { computeTemporalCongruence } from '../dist/engine/temporal.js';
import { computeWeatherCompatibility } from '../dist/engine/weather.js';

async function testRecommendationService() {
  console.log('🧪 Starting Recommendation Service Verification...\n');

  // 1. Math & Engine Unit Checks
  console.log('--- 1. Mathematical Components Verification ---');

  // Haversine
  // Milan Duomo (45.4642, 9.1900) to San Siro (45.4781, 9.1240) ~ 5.3 km
  const dist = calculateHaversineDistance(45.4642, 9.1900, 45.4781, 9.1240);
  if (dist < 5.0 || dist > 6.0) {
    throw new Error(`Haversine calculation unexpected: ${dist} km (expected ~5.3 km)`);
  }
  const decayNear = computeSpatialDecay(5, 50); // 1 - 5/50 = 0.90
  const decayFar = computeSpatialDecay(60, 50); // 0 (beyond max radius)
  if (decayNear !== 0.9 || decayFar !== 0) {
    throw new Error(`Spatial decay error: near=${decayNear}, far=${decayFar}`);
  }
  console.log(`✅ Haversine distance (${dist} km) & spatial decay verified`);

  // Semantic Cosine Sim & Direct Artist Boost
  const sessionTags = [
    { name: 'rock', weight: 1.0 },
    { name: 'indie rock', weight: 0.85 },
  ];
  const boostSim = computeSemanticSimilarity(
    sessionTags,
    ['Radiohead', 'The Smile'],
    ['electronic'],
    ['The Smile'] // direct match!
  );
  if (boostSim !== 1.0) {
    throw new Error(`Expected direct artist match boost to 1.0, got ${boostSim}`);
  }

  const genreSim = computeSemanticSimilarity(
    sessionTags,
    [],
    ['indie rock', 'alternative'],
    ['Unknown Band']
  );
  if (genreSim <= 0 || genreSim > 1.0) {
    throw new Error(`Expected positive cosine genre similarity, got ${genreSim}`);
  }
  console.log(`✅ Semantic similarity: direct boost=${boostSim}, genre similarity=${genreSim}`);

  // Temporal Congruence
  const now = new Date();
  const futureEventDate = new Date(now.getTime() + 2 * 86400000).toISOString(); // 2 days in future
  const timeSlot = { dayOfWeek: 5, hourOfDay: 21, isWeekend: true, isEvening: true };
  const tempCong = computeTemporalCongruence(timeSlot, futureEventDate);
  if (tempCong <= 0.5 || tempCong > 1.0) {
    throw new Error(`Temporal congruence unexpected: ${tempCong}`);
  }
  console.log(`✅ Temporal congruence for imminent weekend event: ${tempCong}`);

  // Weather Compatibility
  const rainWeather = { wmoCode: 61, precipMm: 5.0, tempC: 14, isAdverse: true, isAvailable: true };
  const indoorCompat = computeWeatherCompatibility(rainWeather, false); // indoor venue in rain
  const outdoorCompat = computeWeatherCompatibility(rainWeather, true); // outdoor venue in rain
  if (indoorCompat !== 1.0 || outdoorCompat !== 0.2) {
    throw new Error(`Weather compatibility error: indoor=${indoorCompat}, outdoor=${outdoorCompat}`);
  }
  console.log(`✅ Weather compatibility: rain indoor=${indoorCompat}, rain outdoor=${outdoorCompat}`);

  // 2. Integration with Fastify Server
  console.log('\n--- 2. Fastify Endpoint & Ranking Integration ---');
  const app = await buildRecommendationApp();

  // Health
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  if (healthRes.statusCode !== 200) {
    throw new Error(`/health failed with ${healthRes.statusCode}`);
  }
  console.log('✅ Health check /health: 200 OK');

  // Candidate Events Fixtures
  const mockEvents = [
    {
      id: 'event-1-direct-match',
      name: 'The Smile Live at Fabrique',
      artistNames: ['The Smile'],
      genres: ['rock', 'art rock'],
      startDateTime: new Date(Date.now() + 2 * 86400000).toISOString(),
      venue: {
        name: 'Fabrique',
        city: 'Milano',
        lat: 45.4380,
        lon: 9.2480,
        isOutdoor: false,
        country: 'IT',
      },
      priceRange: { min: 40, max: 55, currency: 'EUR' },
      priceStatus: 'AVAILABLE',
      ticketUrl: 'https://ticketmaster.ev/1',
      imageUrl: 'https://images.ev/1.jpg',
    },
    {
      id: 'event-2-genre-match',
      name: 'Indie Night: Arctic Waves',
      artistNames: ['Arctic Waves'],
      genres: ['indie rock', 'alternative'],
      startDateTime: new Date(Date.now() + 3 * 86400000).toISOString(),
      venue: {
        name: 'Alcatraz',
        city: 'Milano',
        lat: 45.4950,
        lon: 9.1820,
        isOutdoor: false,
        country: 'IT',
      },
      priceRange: { min: 25, max: 30, currency: 'EUR' },
      priceStatus: 'AVAILABLE',
      ticketUrl: 'https://ticketmaster.ev/2',
      imageUrl: 'https://images.ev/2.jpg',
    },
    {
      id: 'event-3-expensive',
      name: 'Pop Extravaganza VIP',
      artistNames: ['Diva Star'],
      genres: ['pop'],
      startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(),
      venue: {
        name: 'Arena Milano',
        city: 'Milano',
        lat: 45.4700,
        lon: 9.1700,
        isOutdoor: true,
        country: 'IT',
      },
      priceRange: { min: 120, max: 250, currency: 'EUR' },
      priceStatus: 'AVAILABLE',
      ticketUrl: 'https://ticketmaster.ev/3',
      imageUrl: 'https://images.ev/3.jpg',
    },
    {
      id: 'event-4-unpriced',
      name: 'Underground Jazz Jam',
      artistNames: ['Milano Jazz Collective'],
      genres: ['jazz'],
      startDateTime: new Date(Date.now() + 1 * 86400000).toISOString(),
      venue: {
        name: 'Blue Note',
        city: 'Milano',
        lat: 45.4880,
        lon: 9.1910,
        isOutdoor: false,
        country: 'IT',
      },
      priceStatus: 'UNAVAILABLE',
      ticketUrl: 'https://ticketmaster.ev/4',
      imageUrl: 'https://images.ev/4.jpg',
    },
  ];

  // Context Vector (Active Session)
  const activeContext = {
    sessionIdHash: 'test_hash',
    sessionTags: [
      { name: 'rock', weight: 1.0 },
      { name: 'indie rock', weight: 0.8 },
    ],
    sessionArtists: ['The Smile', 'Thom Yorke'],
    isSessionEmpty: false,
    timeSlot: {
      dayOfWeek: 5,
      hourOfDay: 21,
      isWeekend: true,
      isEvening: true,
    },
    userLocation: { lat: 45.4642, lon: 9.1900 }, // Milan center
    weather: {
      wmoCode: 61,
      precipMm: 3.5,
      tempC: 15.0,
      isAdverse: true,
      isAvailable: true,
    },
    maxPrice: 60,
    includeUnpriced: true,
  };

  // Test Context-Driven Mode
  const rankRes = await app.inject({
    method: 'POST',
    url: '/internal/recommendations/rank',
    payload: {
      context: activeContext,
      events: mockEvents,
      sortBy: 'relevance',
    },
  });

  if (rankRes.statusCode !== 200) {
    throw new Error(`Ranking endpoint failed: ${rankRes.statusCode} - ${rankRes.payload}`);
  }

  const rankData = JSON.parse(rankRes.payload);
  if (rankData.scoringMode !== 'context_driven') {
    throw new Error(`Expected mode context_driven, got ${rankData.scoringMode}`);
  }

  // event-3-expensive (min: 120) should have been filtered out by maxPrice: 60
  const matchIds = rankData.matches.map((m) => m.event.id);
  if (matchIds.includes('event-3-expensive')) {
    throw new Error('Price filter failed: expensive event (>60 EUR) was not filtered out');
  }
  if (!matchIds.includes('event-1-direct-match') || !matchIds.includes('event-4-unpriced')) {
    throw new Error('Expected candidate events were filtered out incorrectly');
  }

  // Top result should be event-1-direct-match (Artist match + rock + near + indoor rain bonus)
  const topMatch = rankData.matches[0];
  if (topMatch.event.id !== 'event-1-direct-match') {
    throw new Error(`Expected top match to be event-1-direct-match, got ${topMatch.event.id}`);
  }
  if (topMatch.subScores.semanticSim !== 1.0) {
    throw new Error(`Expected semanticSim 1.0, got ${topMatch.subScores.semanticSim}`);
  }
  if (topMatch.subScores.weatherCompatibility !== 1.0) {
    throw new Error(`Expected weatherCompatibility 1.0, got ${topMatch.subScores.weatherCompatibility}`);
  }
  if (!topMatch.reasons || topMatch.reasons.length === 0 || !topMatch.naturalLanguageReason) {
    throw new Error('Explainability reasons missing in top match');
  }

  console.log('✅ Context-Driven ranking verified:');
  console.log(`   - Mode: ${rankData.scoringMode}`);
  console.log(`   - Top Match: "${topMatch.event.name}" (Score: ${topMatch.score}/100)`);
  console.log(`   - SubScores: sem=${topMatch.subScores.semanticSim}, time=${topMatch.subScores.timeCongruence}, dist=${topMatch.subScores.spatialDecay}, weather=${topMatch.subScores.weatherCompatibility}`);
  console.log(`   - Explanation: "${topMatch.naturalLanguageReason}"`);

  // 3. Fallback Mode Verification (Missing Context: isSessionEmpty = true)
  console.log('\n--- 3. Missing Context Fallback Mode Verification ---');
  const fallbackContext = {
    ...activeContext,
    isSessionEmpty: true,
    sessionTags: [],
    sessionArtists: [],
    maxPrice: undefined,
  };

  const fallbackRes = await app.inject({
    method: 'POST',
    url: '/internal/recommendations/rank',
    payload: {
      context: fallbackContext,
      events: mockEvents,
      sortBy: 'relevance',
    },
  });

  const fallbackData = JSON.parse(fallbackRes.payload);
  if (fallbackData.scoringMode !== 'spatio_temporal_fallback') {
    throw new Error(`Expected mode spatio_temporal_fallback, got ${fallbackData.scoringMode}`);
  }
  const fallbackTop = fallbackData.matches[0];
  if (fallbackTop.subScores.semanticSim !== 0.0) {
    throw new Error(`In fallback mode, semanticSim must be 0.0, got ${fallbackTop.subScores.semanticSim}`);
  }
  if (!fallbackTop.reasons.some((r) => r.includes('vicinanza') || r.includes('popolarità'))) {
    throw new Error(`Fallback explainability missing proximity/popularity reason: ${fallbackTop.reasons}`);
  }
  console.log(`✅ Fallback Mode verified: mode=${fallbackData.scoringMode}, semanticSim=${fallbackTop.subScores.semanticSim}`);
  console.log(`   - Fallback Explanation: "${fallbackTop.naturalLanguageReason}"`);

  // 4. Sorting Verification
  console.log('\n--- 4. Sorting Criteria Verification ---');
  const sortByDate = scoringEngine.rankEvents(activeContext, mockEvents, 'date');
  for (let i = 0; i < sortByDate.matches.length - 1; i++) {
    const d1 = new Date(sortByDate.matches[i].event.startDateTime).getTime();
    const d2 = new Date(sortByDate.matches[i + 1].event.startDateTime).getTime();
    if (d1 > d2) throw new Error('Sort by date failed');
  }
  console.log('✅ Sort by date verified');

  const sortByDist = scoringEngine.rankEvents(activeContext, mockEvents, 'distance');
  for (let i = 0; i < sortByDist.matches.length - 1; i++) {
    if (sortByDist.matches[i].distanceKm > sortByDist.matches[i + 1].distanceKm) {
      throw new Error('Sort by distance failed');
    }
  }
  console.log('✅ Sort by distance verified');

  console.log('\n🎉 ALL RECOMMENDATION ENGINE TESTS PASSED SUCCESSFULLY! 🚀');
}

testRecommendationService().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
