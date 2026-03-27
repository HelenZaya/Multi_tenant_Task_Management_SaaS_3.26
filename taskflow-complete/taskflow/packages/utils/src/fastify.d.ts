declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    userRole?: string;
    correlationId?: string;
    _traceId?: string;
    _startTime?: bigint;
  }
}

export {};
