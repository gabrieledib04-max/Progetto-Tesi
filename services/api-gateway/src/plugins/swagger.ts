import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from '../config.js';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'EventSpot API — Context-Driven Live Music Recommender',
        description:
          'API Gateway orchestrating Spotify session-based context ingestion, Ticketmaster live event catalog, Open-Meteo weather and Context-Driven deterministic ranking.',
        version: '2.1.0',
        contact: {
          name: 'EventSpot Team - Politecnico di Bari',
          email: 'support@eventspot.poliba.it',
        },
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Authentication', description: 'Spotify OAuth 2.0 PKCE and session lifecycle' },
        { name: 'Recommendation', description: 'Context-Driven live music recommendations' },
        { name: 'Discovery', description: 'Catalog event search without personalization' },
        { name: 'GDPR & Privacy', description: 'Privacy-by-Design and user right to erasure' },
        { name: 'Health', description: 'Service liveness and readiness probes' },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'eventspot_session',
            description: 'Encrypted HttpOnly session cookie',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/v1/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
