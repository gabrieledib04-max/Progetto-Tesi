import { FastifyPluginAsync } from 'fastify';
import { spotifyAdapter } from '../adapters/spotify.adapter.js';
import { openMeteoAdapter } from '../adapters/open-meteo.adapter.js';
import { ticketmasterAdapter } from '../adapters/ticketmaster.adapter.js';
import { ContextVector, TimeSlot } from '@eventspot/shared';

export const internalRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /internal/context/build
   * Builds Context State Vector C combining Spotify session, time discretization and Open-Meteo weather
   */
  app.post('/context/build', {
    schema: {
      body: {
        type: 'object',
        required: ['lat', 'lon'],
        properties: {
          sessionIdHash: { type: 'string' },
          lat: { type: 'number' },
          lon: { type: 'number' },
          maxPrice: { type: 'number' },
          includeUnpriced: { type: 'boolean', default: true },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      sessionIdHash?: string;
      lat: number;
      lon: number;
      maxPrice?: number;
      includeUnpriced?: boolean;
    };

    const accessToken = req.headers['x-access-token'] as string | undefined;

    // 1. Time Discretization into weekday-hour pattern (Huang et al., 2020)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hourOfDay = now.getHours();
    const timeSlot: TimeSlot = {
      dayOfWeek,
      hourOfDay,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6, // Friday, Saturday, Sunday
      isEvening: hourOfDay >= 18,
    };

    // 2. Parallel fetch of Spotify session context & Open-Meteo weather
    const [sessionContext, weather] = await Promise.all([
      spotifyAdapter.getSessionContext(body.sessionIdHash, accessToken),
      openMeteoAdapter.getWeather(body.lat, body.lon),
    ]);

    const contextVector: ContextVector = {
      sessionTags: sessionContext.sessionTags,
      sessionArtists: sessionContext.sessionArtists,
      isSessionEmpty: sessionContext.isSessionEmpty,
      timeSlot,
      userLocation: {
        lat: body.lat,
        lon: body.lon,
      },
      weather,
      maxPrice: body.maxPrice,
      includeUnpriced: body.includeUnpriced !== false,
    };

    return reply.send(contextVector);
  });

  /**
   * GET /internal/events/search
   * Returns candidate live events from Ticketmaster with caching
   */
  app.get('/events/search', {
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lon'],
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          radiusKm: { type: 'integer', default: 50 },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const query = req.query as {
      lat: number;
      lon: number;
      radiusKm?: number;
      dateFrom?: string;
      dateTo?: string;
    };

    const result = await ticketmasterAdapter.searchEvents({
      lat: Number(query.lat),
      lon: Number(query.lon),
      radiusKm: Number(query.radiusKm) || 50,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    return reply.send(result);
  });

  /**
   * GET /internal/events/:eventId
   * Returns details for a single normalized event
   */
  app.get('/events/:eventId', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = await ticketmasterAdapter.getEventById(eventId);
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }
    return reply.send(event);
  });

  /**
   * DELETE /internal/context/cache/:sessionIdHash
   * Purges cached session context (GDPR compliance)
   */
  app.delete('/context/cache/:sessionIdHash', async (req, reply) => {
    const { sessionIdHash } = req.params as { sessionIdHash: string };
    await spotifyAdapter.purgeSessionContext(sessionIdHash);
    return reply.send({ success: true, message: 'Session context cache purged' });
  });
};
