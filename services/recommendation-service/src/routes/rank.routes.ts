import { FastifyPluginAsync } from 'fastify';
import { ContextVector, NormalizedEvent } from '@eventspot/shared';
import { scoringEngine } from '../engine/scoring.js';

interface RankBody {
  context: ContextVector;
  events: NormalizedEvent[];
  sortBy?: 'relevance' | 'date' | 'distance' | 'price';
}

export const rankRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /internal/recommendations/rank
   * Purely stateless Context-Driven scoring and ranking engine (TRD Section 3)
   */
  app.post<{ Body: RankBody }>(
    '/internal/recommendations/rank',
    {
      schema: {
        body: {
          type: 'object',
          required: ['context', 'events'],
          properties: {
            context: {
              type: 'object',
              required: ['userLocation', 'timeSlot', 'weather'],
              properties: {
                sessionIdHash: { type: 'string' },
                userLocation: {
                  type: 'object',
                  required: ['lat', 'lon'],
                  properties: {
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                  },
                },
                timeSlot: {
                  type: 'object',
                  required: ['dayOfWeek', 'hourOfDay', 'isWeekend', 'isEvening'],
                  properties: {
                    dayOfWeek: { type: 'integer' },
                    hourOfDay: { type: 'integer' },
                    isWeekend: { type: 'boolean' },
                    isEvening: { type: 'boolean' },
                  },
                },
                weather: {
                  type: 'object',
                  required: ['isAvailable', 'isAdverse', 'tempC', 'precipMm'],
                  properties: {
                    isAvailable: { type: 'boolean' },
                    isAdverse: { type: 'boolean' },
                    tempC: { type: 'number' },
                    precipMm: { type: 'number' },
                    wmoCode: { type: 'number' },
                  },
                },
                sessionTags: { type: 'array' },
                sessionArtists: { type: 'array' },
                isSessionEmpty: { type: 'boolean' },
                maxPrice: { type: 'number' },
                includeUnpriced: { type: 'boolean' },
              },
            },
            events: {
              type: 'array',
            },
            sortBy: {
              type: 'string',
              enum: ['relevance', 'date', 'distance', 'price'],
              default: 'relevance',
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { context, events, sortBy = 'relevance' } = req.body;

      const ranked = scoringEngine.rankEvents(context, events || [], sortBy);

      return reply.code(200).send(ranked);
    }
  );
};
