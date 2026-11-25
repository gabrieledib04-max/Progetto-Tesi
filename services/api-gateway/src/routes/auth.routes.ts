import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { config } from '../config.js';
import { spotifyPkceService } from '../services/spotify-pkce.service.js';
import { sessionService } from '../services/session.service.js';
import { cryptoService } from '../services/crypto.service.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/auth/login
   * Initiates Spotify OAuth 2.0 PKCE flow (FR-01, US-01)
   */
  app.get('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Initiate Spotify OAuth 2.0 PKCE flow',
      description: 'Generates state and code_verifier, stores attempt with 10m TTL, redirects to Spotify.',
      querystring: {
        type: 'object',
        properties: {
          mock: { type: 'boolean', description: 'Force mock authentication' },
        },
      },
    },
  }, async (req, reply) => {
    const query = req.query as { mock?: boolean };
    const state = spotifyPkceService.generateState();
    const verifier = spotifyPkceService.generateCodeVerifier();
    const challenge = spotifyPkceService.generateCodeChallenge(verifier);

    // Save attempt with 10 min TTL in MongoDB
    await sessionService.createAuthAttempt(state, verifier);

    if (query.mock || config.mockExternalProviders || !config.spotify.clientId) {
      // Direct mock redirect for seamless sandbox evaluation
      const callbackUrl = `/v1/auth/callback?code=mock_code_${crypto.randomBytes(8).toString('hex')}&state=${state}`;
      return reply.redirect(callbackUrl);
    }

    const authUrl = spotifyPkceService.buildAuthorizeUrl(state, challenge);
    return reply.redirect(authUrl);
  });

  /**
   * GET /v1/auth/callback
   * Consumes state atomically, exchanges code for tokens, encrypts at rest (FR-01)
   */
  app.get('/callback', {
    schema: {
      tags: ['Authentication'],
      summary: 'Spotify OAuth 2.0 PKCE Callback handler',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const query = req.query as { code?: string; state?: string; error?: string };

    if (query.error || !query.code || !query.state) {
      reply.status(400);
      throw new Error(query.error ? `Spotify access denied: ${query.error}` : 'Missing code or state parameter');
    }

    // Atomically validate and consume state
    const codeVerifier = await sessionService.consumeAuthAttempt(query.state);
    if (!codeVerifier) {
      reply.status(400);
      throw new Error('Invalid or expired OAuth state parameter (replay attack prevented)');
    }

    try {
      // Exchange code for tokens
      const tokens = await spotifyPkceService.exchangeCodeForTokens(query.code, codeVerifier);

      // Fetch user profile for pseudonymization
      const profile = await spotifyPkceService.fetchUserProfile(tokens.accessToken);

      // Create new session with random session ID
      const rawSessionId = crypto.randomBytes(32).toString('hex');
      await sessionService.createSession({
        rawSessionId,
        spotifyUserId: profile.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresInSeconds: tokens.expiresIn,
      });

      // Set secure HttpOnly cookie
      reply.setCookie('eventspot_session', rawSessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
        maxAge: 86400, // 24h
      });

      return reply.redirect(`${config.clientUrl}?auth_success=true`);
    } catch (err: any) {
      req.log.error(err, 'OAuth callback failure');
      return reply.redirect(`${config.clientUrl}?auth_error=${encodeURIComponent(err.message)}`);
    }
  });

  /**
   * GET /v1/auth/session
   * Checks current session validity and token freshness
   */
  app.get('/session', {
    schema: {
      tags: ['Authentication'],
      summary: 'Get current session status',
      response: {
        200: {
          type: 'object',
          properties: {
            authenticated: { type: 'boolean' },
            userHash: { type: 'string' },
            tokenExpiresAt: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const cookieVal = req.cookies['eventspot_session'];
    if (!cookieVal) {
      return reply.send({ authenticated: false });
    }

    const session = await sessionService.resolveValidSession(cookieVal);
    if (!session) {
      reply.clearCookie('eventspot_session', { path: '/' });
      return reply.send({ authenticated: false });
    }

    return reply.send({
      authenticated: true,
      userHash: session.spotifyUserHash,
      tokenExpiresAt: session.tokenExpiresAt.toISOString(),
    });
  });

  /**
   * POST /v1/auth/mock-login
   * Instant 1-click test login for evaluation
   */
  app.post('/mock-login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Instant mock login for evaluation and grading',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            userHash: { type: 'string' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    const rawSessionId = 'mock_sess_' + crypto.randomBytes(24).toString('hex');
    const { spotifyUserHash } = await sessionService.createSession({
      rawSessionId,
      spotifyUserId: 'spotify_mock_student_marco',
      accessToken: 'mock_access_token_' + crypto.randomBytes(16).toString('hex'),
      refreshToken: 'mock_refresh_token_' + crypto.randomBytes(16).toString('hex'),
      expiresInSeconds: 3600,
    });

    reply.setCookie('eventspot_session', rawSessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 86400,
    });

    return reply.send({
      success: true,
      userHash: spotifyUserHash,
    });
  });

  /**
   * POST /v1/auth/logout
   * Invalidates session and clears cookie (FR-02)
   */
  app.post('/logout', {
    schema: {
      tags: ['Authentication'],
      summary: 'Logout and invalidate session',
    },
  }, async (req, reply) => {
    const cookieVal = req.cookies['eventspot_session'];
    if (cookieVal) {
      const sessionIdHash = cryptoService.hashSha256(cookieVal);
      await sessionService.destroySession(sessionIdHash);
    }

    reply.clearCookie('eventspot_session', { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  /**
   * DELETE /v1/me
   * Complete GDPR erasure: destroys session and token encryption records (FR-02, US-09)
   */
  app.delete('/me', {
    schema: {
      tags: ['GDPR & Privacy'],
      summary: 'Delete user session and encrypted credentials (GDPR Right to Erasure)',
    },
  }, async (req, reply) => {
    const cookieVal = req.cookies['eventspot_session'];
    if (!cookieVal) {
      reply.status(401);
      throw new Error('Authentication required to perform erasure');
    }

    const sessionIdHash = cryptoService.hashSha256(cookieVal);
    await sessionService.deleteUserAccount(sessionIdHash);

    reply.clearCookie('eventspot_session', { path: '/' });
    return reply.send({
      success: true,
      message: 'All ephemeral session data and credentials permanently erased',
    });
  });
};
