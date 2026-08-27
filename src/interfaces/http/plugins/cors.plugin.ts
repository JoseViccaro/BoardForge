import { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export interface CorsOptions {
  origins?: string[];
}

export async function registerCors(fastify: FastifyInstance, opts: CorsOptions = {}): Promise<void> {
  const allowedOrigins = opts.origins ?? ["http://localhost:3000", "http://localhost:5173"];

  if (allowedOrigins.includes("*")) {
    throw new Error("Wildcard CORS origin (*) with credentials is not permitted under ASVS L2.");
  }

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // allow requests with no origin (like mobile apps or inject)
      if (!origin) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie", "Retry-After"],
  });
}
