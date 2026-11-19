import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { RFC9457Problem } from '@eventspot/shared';

export function registerErrorHandler(app: FastifyInstance) {
  // Ensure correlation ID on every request
  app.addHook('onRequest', async (req, reply) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    (req as any).correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  // Global RFC 9457 Problem Details Handler
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.validation ? 422 : (error.statusCode || 500);
    const correlationId = (request as any).correlationId || crypto.randomUUID();

    let errorCode = error.code || 'INTERNAL_ERROR';
    if (error.validation) {
      errorCode = 'VALIDATION_ERROR';
    } else if (statusCode === 401) {
      errorCode = 'SESSION_REAUTH_REQUIRED';
    } else if (statusCode === 403) {
      errorCode = 'FORBIDDEN';
    } else if (statusCode === 404) {
      errorCode = 'NOT_FOUND';
    }

    const problem: RFC9457Problem = {
      type: `https://eventspot.poliba.it/problems/${errorCode.toLowerCase().replace(/_/g, '-')}`,
      title: error.name || (statusCode === 422 ? 'Unprocessable Entity' : 'Server Error'),
      status: statusCode,
      detail: error.message || 'An unexpected error occurred.',
      errorCode,
      instance: request.raw.url,
      correlationId,
      invalidParams: error.validation
        ? error.validation.map((v: any) => ({
            name: v.instancePath || v.params?.missingProperty || 'field',
            reason: v.message,
          }))
        : undefined,
    };

    request.log.error({ err: error, correlationId }, 'API Gateway Error');

    reply
      .status(statusCode)
      .type('application/problem+json')
      .header('x-correlation-id', correlationId)
      .send(problem);
  });
}
