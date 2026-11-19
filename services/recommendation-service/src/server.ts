import Fastify from 'fastify';
import dotenv from 'dotenv';
import { rankRoutes } from './routes/rank.routes.js';
import { config } from './config.js';

dotenv.config();

export async function buildRecommendationApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Health check
  app.get('/health', async (_req, _reply) => {
    return {
      status: 'UP',
      service: 'recommendation-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  });

  // Register internal ranking routes
  await app.register(rankRoutes);

  return app;
}

async function start() {
  try {
    const app = await buildRecommendationApp();
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`[recommendation-service] Running at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('Fatal error starting recommendation-service:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  start();
}
