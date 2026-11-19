import Fastify from 'fastify';
import { config } from './config.js';
import { connectIngestionDatabase } from './db/mongodb.js';
import { internalRoutes } from './routes/internal.routes.js';

export async function buildIngestionApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers["x-access-token"]'],
    },
  });

  // Health probe
  app.get('/health', async (_req, _reply) => {
    return {
      status: 'UP',
      service: 'ingestion-service',
      version: '2.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      mockProviders: config.mockExternalProviders,
    };
  });

  // Internal endpoints
  await app.register(internalRoutes, { prefix: '/internal' });

  return app;
}

async function start() {
  try {
    await connectIngestionDatabase();
    const app = await buildIngestionApp();

    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 [ingestion-service] Running at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('Fatal error starting ingestion-service:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  start();
}
