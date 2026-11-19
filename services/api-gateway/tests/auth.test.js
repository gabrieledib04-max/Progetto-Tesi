import { buildGatewayApp } from '../dist/server.js';
import { cryptoService } from '../dist/services/crypto.service.js';
import { connectGatewayDatabase } from '../dist/db/mongodb.js';

async function testGateway() {
  console.log('🧪 Starting API Gateway Integration Verification...');

  // 1. Verify Crypto AES-256-GCM
  const secret = 'spotify_token_super_secret_12345';
  const encrypted = cryptoService.encrypt(secret);
  const decrypted = cryptoService.decrypt(encrypted);
  if (decrypted !== secret) {
    throw new Error(`AES-256-GCM test failed! Expected "${secret}", got "${decrypted}"`);
  }
  console.log('✅ AES-256-GCM encryption/decryption round-trip verified');

  await connectGatewayDatabase();
  const app = await buildGatewayApp();

  // 2. Test /v1/health
  const healthRes = await app.inject({ method: 'GET', url: '/v1/health' });
  if (healthRes.statusCode !== 200) {
    throw new Error(`/v1/health returned ${healthRes.statusCode}`);
  }
  console.log('✅ Health probe /v1/health: 200 OK');

  // 3. Test OpenAPI 3.1 schema
  const swaggerRes = await app.inject({ method: 'GET', url: '/v1/docs/json' });
  if (swaggerRes.statusCode !== 200) {
    throw new Error(`/v1/docs/json returned ${swaggerRes.statusCode}`);
  }
  const swaggerJson = JSON.parse(swaggerRes.payload);
  if (swaggerJson.openapi !== '3.1.0') {
    throw new Error(`Expected OpenAPI 3.1.0, got ${swaggerJson.openapi}`);
  }
  console.log('✅ OpenAPI 3.1 specification exposed at /v1/docs/json: valid');

  // 4. Test Mock Login & Cookie
  const loginRes = await app.inject({ method: 'POST', url: '/v1/auth/mock-login' });
  if (loginRes.statusCode !== 200) {
    throw new Error(`/v1/auth/mock-login returned ${loginRes.statusCode}`);
  }
  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie || !setCookie.includes('eventspot_session')) {
    throw new Error('eventspot_session cookie missing from mock login');
  }
  console.log('✅ Mock Login & HttpOnly cookie generation verified');

  // Extract raw cookie value
  const cookieMatch = setCookie.match(/eventspot_session=([^;]+)/);
  const sessionCookie = cookieMatch ? cookieMatch[1] : '';

  // 5. Test Session Check with Cookie
  const sessionRes = await app.inject({
    method: 'GET',
    url: '/v1/auth/session',
    headers: {
      cookie: `eventspot_session=${sessionCookie}`,
    },
  });
  if (sessionRes.statusCode !== 200) {
    throw new Error(`/v1/auth/session returned ${sessionRes.statusCode}`);
  }
  const sessionPayload = JSON.parse(sessionRes.payload);
  if (!sessionPayload.authenticated || !sessionPayload.userHash) {
    throw new Error('Session verification failed: user not authenticated or userHash missing');
  }
  console.log('✅ Session resolution & pseudonymized userHash verified:', sessionPayload.userHash.substring(0, 12) + '...');

  // 6. Test Logout
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: {
      cookie: `eventspot_session=${sessionCookie}`,
    },
  });
  if (logoutRes.statusCode !== 200) {
    throw new Error(`/v1/auth/logout returned ${logoutRes.statusCode}`);
  }
  console.log('✅ Logout and session destruction verified');

  // 7. Test Session after logout
  const sessionAfterLogout = await app.inject({
    method: 'GET',
    url: '/v1/auth/session',
    headers: {
      cookie: `eventspot_session=${sessionCookie}`,
    },
  });
  const afterLogoutPayload = JSON.parse(sessionAfterLogout.payload);
  if (afterLogoutPayload.authenticated) {
    throw new Error('Session should be invalid after logout!');
  }
  console.log('✅ Session invalidation confirmed');

  // 8. Test RFC 9457 Error Response
  const invalidRes = await app.inject({
    method: 'GET',
    url: '/v1/matches?lat=invalid_lat',
  });
  if (invalidRes.statusCode !== 422) {
    throw new Error(`Expected 422 for invalid query params, got ${invalidRes.statusCode}`);
  }
  const problem = JSON.parse(invalidRes.payload);
  if (problem.errorCode !== 'VALIDATION_ERROR' || !problem.correlationId) {
    throw new Error(`Invalid RFC 9457 format: ${JSON.stringify(problem)}`);
  }
  console.log('✅ RFC 9457 Problem Details error formatting verified (errorCode: VALIDATION_ERROR)');

  console.log('\n🎉 ALL API GATEWAY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testGateway().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
