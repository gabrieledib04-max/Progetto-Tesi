import { FastifyPluginAsync } from 'fastify';
import { sessionService } from '../services/session.service.js';
import { config } from '../config.js';
import { MatchesResponse } from '@eventspot/shared';

export const matchesRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/matches
   * Main Context-Driven recommendation endpoint (PRD FR-05, FR-06, FR-07, FR-08)
   */
  app.get('/matches', {
    schema: {
      tags: ['Recommendation'],
      summary: 'Get Context-Driven live music recommendations',
      description:
        'Orchestrates session context from ingestion-service, searches Ticketmaster events, and computes context-driven scoring.',
      querystring: {
        type: 'object',
        required: ['lat', 'lon'],
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
          radiusKm: { type: 'integer', minimum: 10, maximum: 200, default: 50 },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' },
          maxPrice: { type: 'number', minimum: 0 },
          includeUnpriced: { type: 'boolean', default: true },
          sortBy: {
            type: 'string',
            enum: ['relevance', 'date', 'distance', 'price'],
            default: 'relevance',
          },
        },
      },
    },
  }, async (req, reply) => {
    const startTime = Date.now();
    const query = req.query as {
      lat: number;
      lon: number;
      radiusKm?: number;
      dateFrom?: string;
      dateTo?: string;
      maxPrice?: number;
      includeUnpriced?: boolean;
      sortBy?: 'relevance' | 'date' | 'distance' | 'price';
    };

    const lat = Number(query.lat);
    const lon = Number(query.lon);
    const radiusKm = Number(query.radiusKm) || 50;
    const sortBy = query.sortBy || 'relevance';
    const includeUnpriced = query.includeUnpriced !== false;

    // 1. Resolve session if cookie present
    const cookieVal = req.cookies['eventspot_session'];
    let sessionData: { sessionIdHash: string; accessToken: string } | null = null;

    if (cookieVal) {
      try {
        const validated = await sessionService.resolveValidSession(cookieVal);
        if (validated) {
          sessionData = {
            sessionIdHash: validated.sessionIdHash,
            accessToken: validated.accessToken,
          };
        }
      } catch (err: any) {
        req.log.warn({ err }, 'Session invalid or refresh failed');
      }
    }

    const correlationId = (req as any).correlationId;

    // 2. Build context via ingestion-service
    const contextRes = await fetch(`${config.ingestionServiceUrl}/internal/context/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(sessionData ? { 'x-access-token': sessionData.accessToken } : {}),
      },
      body: JSON.stringify({
        sessionIdHash: sessionData?.sessionIdHash,
        lat,
        lon,
        maxPrice: query.maxPrice,
        includeUnpriced,
      }),
    });

    if (!contextRes.ok) {
      throw new Error(`Ingestion service context build failed: ${await contextRes.text()}`);
    }

    const contextVector: any = await contextRes.json();

    // 3. Search candidate events via ingestion-service
    const eventsQuery = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radiusKm: radiusKm.toString(),
      ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo ? { dateTo: query.dateTo } : {}),
    });

    const eventsRes = await fetch(
      `${config.ingestionServiceUrl}/internal/events/search?${eventsQuery.toString()}`,
      {
        headers: { 'x-correlation-id': correlationId },
      }
    );

    if (!eventsRes.ok) {
      throw new Error(`Ingestion service event search failed: ${await eventsRes.text()}`);
    }

    const eventsData: any = await eventsRes.json();
    const candidateEvents = eventsData.events || [];
    const isEventsCacheStale = Boolean(eventsData.isStale);

    // 4. Rank candidates via recommendation-service
    const rankRes = await fetch(`${config.recommendationServiceUrl}/internal/recommendations/rank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        context: contextVector,
        events: candidateEvents,
        sortBy,
      }),
    });

    if (!rankRes.ok) {
      throw new Error(`Recommendation service ranking failed: ${await rankRes.text()}`);
    }

    const rankData: any = await rankRes.json();
    const scoredMatches = rankData.matches || [];
    const scoringMode = rankData.scoringMode || (contextVector.isSessionEmpty ? 'spatio_temporal_fallback' : 'context_driven');

    const responseTimeMs = Date.now() - startTime;

    // Build standardized response
    const responsePayload: MatchesResponse = {
      success: true,
      meta: {
        totalMatches: scoredMatches.length,
        responseTimeMs,
        scoringMode,
        isEventsCacheStale,
        searchContext: {
          lat,
          lon,
          radiusKm,
          dateFrom: query.dateFrom || new Date().toISOString(),
          dateTo: query.dateTo || new Date(Date.now() + 30 * 86400000).toISOString(),
          maxPrice: query.maxPrice,
        },
      },
      contextSummary: {
        sessionTags: contextVector.sessionTags || [],
        weather: {
          tempC: contextVector.weather?.tempC || 18,
          isAdverse: Boolean(contextVector.weather?.isAdverse),
          description: contextVector.weather?.isAdverse ? 'Condizioni avverse' : 'Meteo favorevole',
        },
        timeSlot: contextVector.timeSlot || {
          dayOfWeek: new Date().getDay(),
          hourOfDay: new Date().getHours(),
          isWeekend: [0, 6].includes(new Date().getDay()),
          isEvening: new Date().getHours() >= 18,
        },
      },
      matches: scoredMatches,
    };

    reply.header('x-response-time-ms', responseTimeMs.toString());
    reply.header('x-data-degraded', isEventsCacheStale ? 'true' : 'false');
    return reply.send(responsePayload);
  });

  /**
   * GET /v1/events (Discovery search without personalization)
   */
  app.get('/events', {
    schema: {
      tags: ['Discovery'],
      summary: 'Search live events without user session personalization',
      querystring: {
        type: 'object',
        required: ['lat', 'lon'],
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          radiusKm: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req, reply) => {
    const query = req.query as any;
    const correlationId = (req as any).correlationId;

    const eventsRes = await fetch(
      `${config.ingestionServiceUrl}/internal/events/search?lat=${query.lat}&lon=${query.lon}&radiusKm=${query.radiusKm || 50}`,
      { headers: { 'x-correlation-id': correlationId } }
    );

    if (!eventsRes.ok) {
      throw new Error(`Discovery search failed: ${await eventsRes.text()}`);
    }

    const data = await eventsRes.json();
    return reply.send(data);
  });

  /**
   * GET /v1/events/:eventId (Normalized event detail)
   */
  app.get('/events/:eventId', {
    schema: {
      tags: ['Discovery'],
      summary: 'Get details of a single event by ID',
      params: {
        type: 'object',
        required: ['eventId'],
        properties: {
          eventId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const correlationId = (req as any).correlationId;

    const res = await fetch(`${config.ingestionServiceUrl}/internal/events/${eventId}`, {
      headers: { 'x-correlation-id': correlationId },
    });

    if (res.status === 404) {
      reply.status(404);
      throw new Error(`Event ${eventId} not found`);
    }

    const event = await res.json();
    return reply.send({ success: true, event });
  });
};
