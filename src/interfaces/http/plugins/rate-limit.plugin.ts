import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

export interface RateLimitOptions {
  authMaxRequests?: number;
  authTimeWindowSeconds?: number;
  standardMaxRequests?: number;
}

export async function registerRateLimit(
  fastify: FastifyInstance,
  opts: RateLimitOptions = {}
): Promise<void> {
  const authMax = opts.authMaxRequests ?? 5;
  const authTimeWindow = (opts.authTimeWindowSeconds ?? 60) * 1000;
  const standardMax = opts.standardMaxRequests ?? 120;

  await fastify.register(rateLimit, {
    global: true,
    max: (req) => {
      if (req.url.startsWith("/api/v1/auth")) {
        return authMax;
      }
      if (
        req.url.startsWith("/api/v1/measurements") ||
        (req.url.startsWith("/api/v1/boardview") && req.method === "POST") ||
        (req.url.startsWith("/api/v1/schematics") && req.method === "POST")
      ) {
        return 30;
      }
      return standardMax;
    },
    timeWindow: (req) => {
      if (req.url.startsWith("/api/v1/auth")) {
        return authTimeWindow;
      }
      return 60 * 1000;
    },
    errorResponseBuilder: (req, context) => {
      const retryAfterSeconds = Math.ceil(context.ttl / 1000);
      return {
        type: "https://boardforge.io/errors/rate-limit",
        title: "Too Many Requests",
        status: 429,
        detail: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        instance: req.url,
        invalidParams: [],
      };
    },
  });
}
