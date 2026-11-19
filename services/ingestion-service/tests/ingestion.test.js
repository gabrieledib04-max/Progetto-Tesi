import { buildIngestionApp } from '../dist/server.js';
import { connectIngestionDatabase } from '../dist/db/mongodb.js';
import { encodeGeohash, bucketRadius } from '../dist/utils/geohash.js';

async function testIngestion() {
  console.log('🧪 Starting Ingestion Service Integration Verification...');

  // 1. Verify Geohash & Radius Bucketing
  const gh5 = encodeGeohash(45.4642, 9.1900, 5);
  const gh4 = encodeGeohash(45.4642, 9.1900, 4);
  if (!gh5 || gh5.length !== 5 || !gh4 || gh4.length !== 4) {
    throw new Error(`Geohash encoding error: gh5=${gh5}, gh4=${gh4}`);
  }
  if (bucketRadius(18) !== 25 || bucketRadius(45) !== 50 || bucketRadius(150) !== 200) {
    throw new Error('Radius bucketing error');
  }
  console.log(`✅ Geohash encoding (Milan: ${gh5}) & Radius bucketing verified`);

  await connectIngestionDatabase();
  const app = await buildIngestionApp();

  // 2. Health check
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  if (healthRes.statusCode !== 200) {
    throw new Error(`/health returned ${healthRes.statusCode}`);
  }
  console.log('✅ Health check /health: 200 OK');

  // 3. Build Context Vector
  const contextRes = await app.inject({
    method: 'POST',
    url: '/internal/context/build',
    payload: {
      sessionIdHash: 'test_session_hash_123',
      lat: 45.4642,
      lon: 9.1900,
      maxPrice: 50,
      includeUnpriced: true,
    },
  });
  if (contextRes.statusCode !== 200) {
    throw new Error(`/internal/context/build returned ${contextRes.statusCode}: ${contextRes.payload}`);
  }
  const context = JSON.parse(contextRes.payload);
  if (!context.sessionTags || context.sessionTags.length === 0) {
    throw new Error('Context sessionTags should not be empty in mock mode');
  }
  if (!context.timeSlot || typeof context.timeSlot.dayOfWeek !== 'number') {
    throw new Error('TimeSlot weekday-hour discretization missing');
  }
  if (!context.weather || typeof context.weather.isAdverse !== 'boolean') {
    throw new Error('Weather condition missing');
  }
  console.log('✅ Context build verified:');
  console.log(`   - TimeSlot: day=${context.timeSlot.dayOfWeek}, hour=${context.timeSlot.hourOfDay}, isWeekend=${context.timeSlot.isWeekend}`);
  console.log(`   - Session Tags (top 3): ${context.sessionTags.slice(0, 3).map((t) => `${t.name} (${t.weight})`).join(', ')}`);
  console.log(`   - Weather: temp=${context.weather.tempC}°C, isAdverse=${context.weather.isAdverse}`);

  // 4. Search Candidate Events
  const eventsRes = await app.inject({
    method: 'GET',
    url: '/internal/events/search?lat=45.4642&lon=9.1900&radiusKm=50',
  });
  if (eventsRes.statusCode !== 200) {
    throw new Error(`/internal/events/search returned ${eventsRes.statusCode}`);
  }
  const eventsPayload = JSON.parse(eventsRes.payload);
  if (!eventsPayload.events || eventsPayload.events.length === 0) {
    throw new Error('Events search returned 0 events');
  }
  console.log(`✅ Candidate events search verified: ${eventsPayload.events.length} events found (cacheHit: ${eventsPayload.cacheHit})`);

  // Verify second call hits cache
  const eventsCachedRes = await app.inject({
    method: 'GET',
    url: '/internal/events/search?lat=45.4642&lon=9.1900&radiusKm=50',
  });
  const cachedPayload = JSON.parse(eventsCachedRes.payload);
  if (!cachedPayload.cacheHit) {
    throw new Error('Second call for identical parameters should hit cache!');
  }
  console.log('✅ Events cache hit verified (cache-aside with fresh/stale TTL)');

  // 5. Get Single Event by ID
  const eventId = eventsPayload.events[0].id;
  const singleEventRes = await app.inject({
    method: 'GET',
    url: `/internal/events/${eventId}`,
  });
  if (singleEventRes.statusCode !== 200) {
    throw new Error(`/internal/events/${eventId} returned ${singleEventRes.statusCode}`);
  }
  const singleEvent = JSON.parse(singleEventRes.payload);
  if (singleEvent.id !== eventId) {
    throw new Error('Single event lookup returned mismatching ID');
  }
  console.log(`✅ Single event lookup verified: ${singleEvent.name} (venue: ${singleEvent.venue.name}, outdoor: ${singleEvent.venue.isOutdoor})`);

  // 6. Purge session context cache
  const purgeRes = await app.inject({
    method: 'DELETE',
    url: '/internal/context/cache/test_session_hash_123',
  });
  if (purgeRes.statusCode !== 200) {
    throw new Error(`/internal/context/cache returned ${purgeRes.statusCode}`);
  }
  console.log('✅ Session context cache purge verified (GDPR Right to Erasure)');

  console.log('\n🎉 ALL INGESTION SERVICE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testIngestion().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
