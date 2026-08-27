import { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";

export async function registerSecurityHeaders(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
    xContentTypeOptions: true, // nosniff
    xFrameOptions: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  });
}
