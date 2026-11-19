import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { connectGatewayDatabase } from './db/mongodb.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { matchesRoutes } from './routes/matches.routes.js';

export async function buildGatewayApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  // Security headers & CORS
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Cookie management
  await app.register(cookie, {
    secret: config.cookieSecret,
    hook: 'onRequest',
  });

  // OpenAPI 3.1 Swagger & Swagger UI (O-5, US-10)
  await registerSwagger(app);

  // RFC 9457 Problem Details Error Handler (NFR-R8)
  registerErrorHandler(app);

  // Health probe
  app.get('/v1/health', {
    schema: {
      tags: ['Health'],
      summary: 'API Gateway liveness and readiness probe',
    },
  }, async (_req, _reply) => {
    return {
      status: 'UP',
      service: 'api-gateway',
      version: '2.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      mockProviders: config.mockExternalProviders,
    };
  });

  app.get('/health', async (_req, _reply) => {
    return { status: 'UP', service: 'api-gateway' };
  });

  // Register public API v1 routes
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(matchesRoutes, { prefix: '/v1' });

  return app;
}

async function start() {
  try {
    await connectGatewayDatabase();
    const app = await buildGatewayApp();

    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 [api-gateway] Running at http://${config.host}:${config.port}`);
    console.log(`📖 [api-gateway] OpenAPI 3.1 Interactive Docs at http://${config.host}:${config.port}/v1/docs`);
  } catch (err) {
    console.error('Fatal error starting api-gateway:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  start();
}
