import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';

dotenv.config();

const port = parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

export async function buildGatewayApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'eventspot_cookie_secret_dev_32_chars_min',
    hook: 'onRequest',
  });

  // Health check endpoint
  app.get('/v1/health', async (_req, _reply) => {
    return {
      status: 'UP',
      service: 'api-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  });

  app.get('/health', async (_req, _reply) => {
    return { status: 'UP', service: 'api-gateway' };
  });

  return app;
}

async function start() {
  try {
    const app = await buildGatewayApp();
    await app.listen({ port, host });
    app.log.info(`[api-gateway] Running at http://${host}:${port}`);
  } catch (err) {
    console.error('Fatal error starting api-gateway:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('server')) {
  start();
}
