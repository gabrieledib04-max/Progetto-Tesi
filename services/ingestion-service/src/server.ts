import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const port = parseInt(process.env.PORT || process.env.INGESTION_PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

export async function buildIngestionApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  app.get('/health', async (_req, _reply) => {
    return {
      status: 'UP',
      service: 'ingestion-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  });

  return app;
}

async function start() {
  try {
    const app = await buildIngestionApp();
    await app.listen({ port, host });
    app.log.info(`[ingestion-service] Running at http://${host}:${port}`);
  } catch (err) {
    console.error('Fatal error starting ingestion-service:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  start();
}
